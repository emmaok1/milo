import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";

loadEnvConfig(process.cwd());
async function main() {
  const base = process.env.VOICE_TEST_URL || "http://127.0.0.1:3000",
    origin = process.env.APP_ORIGIN || base;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const ids: string[] = [];
  async function account(character: string) {
    const email = `haven-quick-${randomUUID()}@example.com`,
      password = randomBytes(24).toString("base64url");
    const made = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { havenCharacter: character },
    });
    assert.ifError(made.error);
    ids.push(made.data.user!.id);
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(r.status, 200);
    const headers = {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    };
    const call = (
      path: string,
      body?: unknown,
      method = body ? "POST" : "GET",
    ) =>
      fetch(base + "/api/" + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const p = await call(
      "profile",
      { memoryMode: "manual", onboarded: true },
      "PATCH",
    );
    assert.equal(p.status, 200);
    return { call, headers };
  }

  try {
    const a = await account("black_cat"),
      b = await account("white_cat");
    const config = await (await a.call("voice/config")).json();
    assert(config.speculative);
    const callId = randomUUID(),
      turnId = randomUUID();
    const text = "I had a long day and just want some quiet company.";
    const start = performance.now();
    const prepared = await a.call("voice/prepare", {
      callId,
      turnId,
      revision: 1,
      text,
      language: "en-US",
    });
    assert.equal(prepared.status, 200, await prepared.text());
    assert.equal(
      (await (await a.call("conversations")).json()).length,
      0,
      "Interim generation must not create conversations or messages",
    );
    await new Promise((r) => setTimeout(r, 2000));
    const finalStart = performance.now();
    const response = await a.call("chat", {
      message: text,
      requestId: turnId,
      callId,
      voice: true,
      language: "en-US",
      replyStyle: "Short",
      preparation: { turnId, revision: 1 },
    });
    assert.equal(response.status, 200);
    const reader = response.body!.getReader(),
      decoder = new TextDecoder();
    let buffer = "",
      firstDeltaMs = 0;
    const events: Record<string, unknown>[] = [];
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value || new Uint8Array(), {
        stream: !chunk.done,
      });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines.filter(Boolean)) {
        const e = JSON.parse(line);
        events.push(e);
        if (e.type === "delta" && !firstDeltaMs)
          firstDeltaMs = performance.now() - finalStart;
      }
      if (chunk.done) break;
    }
    assert.equal(
      events.find((e) => e.type === "preparation")?.reused,
      true,
      "Matching speculative generation should be reused",
    );
    const cid = events.find((e) => e.type === "meta")!.conversationId;
    const messages = await (await a.call("conversations/" + cid)).json();
    assert.equal(messages.length, 2);
    assert.equal(messages[0].data.text, text);
    assert(messages[1].data.text);
    assert(
      !messages[1].data.text.includes("?"),
      "Quiet company must override the usual question style",
    );
    assert.equal((await b.call("conversations/" + cid)).status, 404);
    const foreign = await b.call("chat", {
      message: text,
      requestId: turnId,
      callId,
      voice: true,
      language: "en-US",
      replyStyle: "Short",
      preparation: { turnId, revision: 1 },
    });
    assert.equal(foreign.status, 200);
    const fEvents = (await foreign.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(
      fEvents.find((e) => e.type === "preparation").reused,
      false,
      "Other accounts cannot claim prepared generation",
    );
    const sensitive = await a.call("voice/prepare", {
      callId,
      turnId: randomUUID(),
      revision: 1,
      text: "Please stay with me because I feel faint.",
      language: "en-US",
    });
    assert.equal(
      sensitive.status,
      409,
      "Sensitive partials must bypass speculation",
    );
    const cancelTurn = randomUUID();
    const p2 = await a.call("voice/prepare", {
      callId,
      turnId: cancelTurn,
      revision: 1,
      text: "I have something else on my mind today.",
      language: "en-US",
    });
    assert.equal(p2.status, 200);
    const canceled = await a.call(
      "voice/prepare",
      { callId, turnId: cancelTurn, revision: 1 },
      "DELETE",
    );
    assert.equal(canceled.status, 200);
    await mkdir("artifacts", { recursive: true });
    await writeFile(
      "artifacts/voice-preparation-live.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          preparationReused: true,
          noInterimHistory: true,
          savedFinalMessages: 2,
          crossAccountClaimDenied: true,
          sensitivePartialsBypass: true,
          cancellation: true,
          preparationToFinalCompleteMs: Math.round(performance.now() - start),
          finalToFirstTextMs: Math.round(firstDeltaMs),
          note: "Real authenticated Claude and storage. Two seconds of synthetic user-thinking time preceded final submission. No microphone, audio output or phone latency measurement.",
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS live speculative reuse, no interim persistence, single final reply, owner isolation, quiet-company prompt and sensitive bypass; final-to-first-text:",
      Math.round(firstDeltaMs),
      "ms",
    );
  } finally {
    for (const id of ids) {
      await admin.auth.admin.deleteUser(id);
    }
    console.log("Disposable accounts removed.");
  }
}
main().catch((e) => {
  console.error("Voice preparation verification failed:", e.message);
  process.exitCode = 1;
});
