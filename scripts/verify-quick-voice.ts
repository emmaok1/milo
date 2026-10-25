import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import { quickResponseById } from "../src/lib/quick-responses/library";
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
    assert(config.quickResponses && config.streaming && config.realtime);
    const grant = await a.call("voice/realtime-session", { language: "en-US" });
    assert.equal(grant.status, 200);
    const scoped = await grant.json();
    assert.equal(typeof scoped.token, "string");
    assert.equal(scoped.model, "ink-2");
    assert.equal(grant.headers.get("Cache-Control"), "no-store");
    const hello = await a.call("voice/speech", {
      text: "Welcome home. Meow.",
      language: "en-US",
      character: "black_cat",
    });
    assert.equal(hello.status, 200);
    assert.equal(
      Buffer.from(await hello.arrayBuffer()).toString("ascii", 0, 4),
      "RIFF",
    );
    assert.equal(config.quickAssets.length, 3);
    const readyAudioKeys = config.quickAssets.map(
      (a: { key: string }) => a.key,
    );
    async function turn(account: typeof a, body: Record<string, unknown>) {
      const t = performance.now();
      const r = await account.call("chat", {
        voice: true,
        language: "en-US",
        replyStyle: "Short",
        quickResponses: true,
        readyAudioKeys,
        ...body,
      });
      assert.equal(
        r.status,
        200,
        await (!r.ok ? r.text() : Promise.resolve("")),
      );
      const events = (await r.text())
        .trim()
        .split("\n")
        .map((s) => JSON.parse(s));
      assert(events.some((e) => e.type === "done" && e.state === "completed"));
      return {
        events,
        ms: Math.round(performance.now() - t),
        cid: events.find((e) => e.type === "meta")?.conversationId,
        route: events.find((e) => e.type === "route"),
      };
    }
    const requestId = randomUUID(),
      callId = randomUUID();
    const first = await turn(a, {
      requestId,
      callId,
      message: "Please just listen. I don't want advice.",
    });
    assert.equal(
      first.events.find((e) => e.type === "quick")?.responseId,
      "047",
    );
    assert(!first.events.some((e) => e.type === "delta"));
    reports.push({
      path: "prerecorded",
      httpCompleteMs: first.ms,
      routerMs: first.route.routerMs,
      cacheHit: true,
    });
    const rows = await (await a.call("conversations/" + first.cid)).json();
    assert.equal(rows.length, 2);
    assert.equal(rows[1].data.text, quickResponseById.get("047")!.responseText);
    assert.equal(rows[1].data.playbackState, "pending");
    assert.equal(
      (
        await a.call("chat", {
          voice: true,
          language: "en-US",
          requestId,
          callId,
          conversationId: first.cid,
          message: "Please just listen. I don't want advice.",
        })
      ).status,
      409,
    );
    assert.equal((await b.call("conversations/" + first.cid)).status, 404);
    assert.equal(
      (await b.call("voice/playback", { requestId, state: "started" })).status,
      404,
    );
    assert.equal(
      (
        await a.call("voice/playback", {
          requestId,
          state: "interrupted",
          playedMs: 0,
        })
      ).status,
      200,
    );
    const interrupted = await (
      await a.call("conversations/" + first.cid)
    ).json();
    assert.equal(interrupted[1].data.state, "interrupted");
    assert.equal(
      interrupted[1].data.intendedText,
      quickResponseById.get("047")!.responseText,
    );
    const audioKey = config.quickAssets.find(
      (a: { id: string }) => a.id === "047",
    ).key;
    const audio = await a.call("voice/quick-audio/" + audioKey);
    assert.equal(audio.status, 200);
    assert.equal(
      Buffer.from(await audio.arrayBuffer()).toString("ascii", 0, 4),
      "RIFF",
    );
    assert.equal((await b.call("voice/quick-audio/" + audioKey)).status, 404);
    const tempId = randomUUID(),
      tempCall = randomUUID();
    const temp = await turn(a, {
      requestId: tempId,
      callId: tempCall,
      temporary: true,
      message: "Please no more questions.",
    });
    assert.equal(temp.cid, null);
    assert.equal(
      temp.events.find((e) => e.type === "quick")?.responseId,
      "090",
    );
    assert.equal(
      (await a.call("voice/playback", { requestId: tempId, state: "started" }))
        .status,
      200,
    );
    assert.equal(
      (
        await a.call("chat", {
          requestId: tempId,
          callId: tempCall,
          voice: true,
          temporary: true,
          resumeQuick: true,
          message: "Please no more questions.",
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await a.call("voice/playback", {
          requestId: tempId,
          state: "completed",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await (
          await a.call("voice/playback", {
            requestId: tempId,
            state: "started",
          })
        ).json()
      ).state,
      "completed",
    );
    const whiteConfig = await (await b.call("voice/config")).json();
    assert(
      whiteConfig.quickAssets.every(
        (w: { key: string }) => !readyAudioKeys.includes(w.key),
      ),
    );
    const profile = await a.call(
      "profile",
      { companion: "white_cat" },
      "PATCH",
    );
    assert.equal(profile.status, 200);
    assert.equal((await a.call("voice/quick-audio/" + audioKey)).status, 404);
    await a.call("profile", { companion: "black_cat" }, "PATCH");
    console.log(
      "PASS authenticated quick replies, one response path, history, duplicate requests, interruption, temporary calls, account isolation, selected voice and terminal-state fencing",
    );
    if (process.argv.includes("--smoke")) {
      // A genuine pre-start playback failure can resume exactly the saved turn through Claude.
      const fallbackId = randomUUID(),
        fallbackCall = randomUUID();
      const initial = await turn(a, {
        requestId: fallbackId,
        callId: fallbackCall,
        message: "Please just listen. I don't want advice.",
      });
      assert(initial.events.some((e) => e.type === "quick"));
      const fallback = await turn(a, {
        requestId: fallbackId,
        callId: fallbackCall,
        conversationId: initial.cid,
        resumeQuick: true,
        message: "Please just listen. I don't want advice.",
      });
      assert(fallback.events.some((e) => e.type === "delta"));
      assert(!fallback.events.some((e) => e.type === "quick"));
      const saved = await (await a.call("conversations/" + initial.cid)).json();
      assert.equal(saved.length, 2);
      assert.equal(
        saved.filter((m: { data: { role: string } }) => m.data.role === "user")
          .length,
        1,
      );
      const noQuestions = await turn(a, {
        requestId: randomUUID(),
        callId: tempCall,
        temporary: true,
        voiceHistory: [
          { role: "user", text: "Please no more questions." },
          {
            role: "assistant",
            text: quickResponseById.get("090")!.responseText,
            responseId: "090",
          },
        ],
        message: "I feel guilty after eating.",
      });
      assert.equal(noQuestions.route.path, "claude");
      const reply = noQuestions.events
        .filter((e) => e.type === "delta")
        .map((e) => e.text)
        .join("");
      assert(!reply.includes("?"));
      reports.push({
        path: "claude",
        httpCompleteMs: noQuestions.ms,
        routerMs: noQuestions.route.routerMs,
        reason: noQuestions.route.reason,
      });
      const streamed = await a.call("voice/speech", {
        text: "We can take this at your pace.",
        language: "en-US",
        character: "black_cat",
        stream: true,
      });
      assert.equal(streamed.status, 200);
      assert.equal(streamed.headers.get("Content-Type"), "audio/pcm");
      const reader = streamed.body!.getReader();
      let bytes = 0,
        chunks = 0;
      while (true) {
        const c = await reader.read();
        if (c.done) break;
        bytes += c.value.length;
        chunks++;
      }
      assert(bytes > 1000);
      assert.equal(bytes % 2, 0);
      console.log(
        "PASS live Claude fallback without duplicate messages, no-question preference and live Cartesia PCM stream",
        { bytes, chunks },
      );
    }
    await mkdir("artifacts", { recursive: true });
    await writeFile(
      process.argv.includes("--smoke")
        ? "artifacts/voice-live-checks-smoke.json"
        : "artifacts/voice-live-checks.json",
      JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          reports,
          note: "Real HTTP/auth/storage/provider checks; not microphone-to-ear measurements.",
        },
        null,
        2,
      ),
    );
  } finally {
    for (const id of ids) {
      const r = await admin.auth.admin.deleteUser(id);
      assert.ifError(r.error);
    }
    console.log("Disposable voice accounts removed.");
  }
}
main().catch((e) => {
  console.error("Quick voice verification failed:", e.message);
  process.exitCode = 1;
});
