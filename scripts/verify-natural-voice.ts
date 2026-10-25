import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { measureRealtime } from "./realtime-latency";
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

  const reports: object[] = [];
  try {
    const a = await account("black_cat"),
      b = await account("white_cat");
    const config = await (await a.call("voice/config")).json();
    assert.equal(config.quickResponses, false);
    assert.deepEqual(config.quickAssets, []);
    assert(config.realtime && config.streaming);
    const grant = await a.call("voice/realtime-session", { language: "en-US" });
    assert.equal(grant.status, 200);
    const result = await measureRealtime(
      await readFile("/tmp/haven-latency-input.wav"),
      await grant.json(),
    );
    assert(result.text.toLowerCase().includes("listen"));
    assert(/(?:don't|do not|don’t).*advice/i.test(result.text));
    reports.push({
      recognition: "ink-2",
      finalAfterLastAudioPacketMs: Math.round(
        result.finalAfterLastAudioPacketMs,
      ),
      firstInterimFromConnectMs: Math.round(result.firstInterimFromConnectMs),
      syntheticWordCount: result.text.split(/\s+/).length,
    });
    const requestId = randomUUID(),
      callId = randomUUID();
    const started = performance.now();
    const body = {
      voice: true,
      language: "en-US",
      message: result.text,
      requestId,
      callId,
      quickResponses: true,
      readyAudioKeys: ["a".repeat(64)],
    };
    const response = await a.call("chat", body);
    assert.equal(response.status, 200);
    const events = (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert(!events.some((e) => e.type === "quick"));
    assert(events.some((e) => e.type === "delta"));
    assert.equal(events.find((e) => e.type === "route").path, "claude");
    const cid = events.find((e) => e.type === "meta").conversationId;
    assert.equal((await a.call("chat", body)).status, 409);
    const rows = await (await a.call("conversations/" + cid)).json();
    assert.equal(rows.length, 2);
    assert.equal(rows[0].data.text, result.text);
    assert(rows[1].data.text);
    assert.equal((await b.call("conversations/" + cid)).status, 404);
    assert.equal(
      (await b.call("voice/playback", { requestId, state: "started" })).status,
      404,
    );
    assert.equal(
      (await a.call("voice/playback", { requestId, state: "started" })).status,
      200,
    );
    assert.equal(
      (
        await a.call("voice/playback", {
          requestId,
          state: "interrupted",
          playedMs: 300,
        })
      ).status,
      200,
    );
    const saved = await (await a.call("conversations/" + cid)).json();
    assert.equal(saved[1].data.state, "interrupted");
    const second = await a.call("chat", {
      voice: true,
      language: "en-US",
      message: "Please no more questions. I just want some quiet company.",
      requestId: randomUUID(),
      callId,
      conversationId: cid,
    });
    assert.equal(second.status, 200);
    const ev = (await second.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    const text = ev
      .filter((e) => e.type === "delta")
      .map((e) => e.text)
      .join("");
    assert(text);
    assert(!text.includes("?"), "No-question preference must be respected");
    assert(!ev.some((e) => e.type === "quick"));
    const speech = await a.call("voice/speech", {
      text: "We can keep this easy.",
      character: "black_cat",
      language: "en-US",
      stream: true,
    });
    assert.equal(speech.status, 200);
    assert.equal(speech.headers.get("Content-Type"), "audio/pcm");
    assert((await speech.arrayBuffer()).byteLength > 1000);
    assert.equal(
      (await a.call("voice/quick-audio/" + "a".repeat(64))).status,
      404,
    );
    reports.push({
      contextualResponse: true,
      scenarioCompleteMs: Math.round(performance.now() - started),
      libraryCannotBeReenabledByClient: true,
      history: true,
      interruptedState: true,
      ownerIsolation: true,
      noQuestionPreference: true,
      liveCartesiaPcm: true,
    });
    await mkdir("artifacts", { recursive: true });
    await writeFile(
      "artifacts/voice-natural-checks.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          reports,
          note: "Real authenticated APIs, synthetic public audio, Claude and Cartesia. Not a phone or clinical accuracy benchmark.",
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS retired library, live realtime recognition, contextual Claude, no questions, history, deduplication, interruption, account isolation and live PCM speech.",
    );
  } finally {
    for (const id of ids) {
      const r = await admin.auth.admin.deleteUser(id);
      assert.ifError(r.error);
    }
    console.log("Disposable test accounts removed.");
  }
}
main().catch((e) => {
  console.error("Natural voice verification failed:", e.message);
  process.exitCode = 1;
});
