import { measureRealtime } from "./realtime-latency";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { cartesiaSpeech } from "../src/lib/cartesia";
import { takeSpeech } from "../src/lib/voice";
loadEnvConfig(process.cwd());
const base = process.env.VOICE_TEST_URL || "http://127.0.0.1:3000";
const origin = process.env.APP_ORIGIN || base;
async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const email = `haven-latency-${randomUUID()}@example.com`,
    password = randomBytes(24).toString("base64url");
  const made = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { havenCharacter: "black_cat" },
  });
  assert.ifError(made.error);
  const results: object[] = [];
  const after = process.argv.includes("--after");
  try {
    const login = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.status, 200);
    const headers = {
      Origin: origin,
      Cookie: login.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
      "Content-Type": "application/json",
    };
    let readyAudioKeys: string[] = [];
    let preloadMs = 0;
    if (after) {
      const config = await (
        await fetch(base + "/api/voice/config", { headers })
      ).json();
      const pt = performance.now();
      for (const asset of config.quickAssets || []) {
        const r = await fetch(base + asset.url, { headers });
        assert.equal(r.status, 200);
        await r.arrayBuffer();
        readyAudioKeys.push(asset.key);
      }
      preloadMs = performance.now() - pt;
    }
    // Reusable synthetic input only. Never benchmark on a real user's recordings.
    let input: Buffer;
    try {
      input = await readFile("/tmp/haven-latency-input.wav");
    } catch {
      const stream = await cartesiaSpeech(
        "Please just listen. I don't want advice.",
        "en-US",
        "black_cat",
      );
      input = Buffer.from(await new Response(stream).arrayBuffer());
      await writeFile("/tmp/haven-latency-input.wav", input);
    }
    const realtime = process.argv.includes("--realtime");
    let sttMs = 0,
      recognized = "",
      firstInterimMs: number | undefined;
    if (realtime) {
      const r = await fetch(base + "/api/voice/realtime-session", {
        method: "POST",
        headers,
        body: JSON.stringify({ language: "en-US" }),
      });
      assert.equal(r.status, 200);
      const result = await measureRealtime(input, await r.json());
      sttMs = result.finalAfterLastAudioPacketMs;
      recognized = result.text;
      firstInterimMs = result.firstInterimFromConnectMs;
    } else {
      const ts = performance.now();
      const tr = await fetch(base + "/api/voice/transcribe?language=en-US", {
        method: "POST",
        headers: { ...headers, "Content-Type": "audio/wav" },
        body: new Uint8Array(input),
      });
      assert.equal(tr.status, 200);
      await tr.json();
      sttMs = performance.now() - ts;
    }
    for (const [index, message] of [
      recognized || "Please just listen. I don't want advice.",
      "Please tell me a short comforting story about a cat.",
    ].entries()) {
      const t = performance.now();
      let firstTextMs = 0,
        firstPhraseMs = 0,
        firstAudioByteMs = 0,
        completeAudioMs = 0,
        reply = "",
        pending = "",
        audioTask: Promise<void> | undefined;
      let path = "claude",
        routerMs = 0,
        quick = false;
      const response = await fetch(base + "/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          requestId: randomUUID(),
          message,
          voice: true,
          temporary: true,
          language: "en-US",
          replyStyle: "Short",
          quickResponses: after,
          readyAudioKeys,
          callId: randomUUID(),
        }),
      });
      assert.equal(response.status, 200);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const synth = (text: string) => {
        firstPhraseMs = performance.now() - t;
        audioTask = (async () => {
          const r = await fetch(base + "/api/voice/speech", {
            method: "POST",
            headers,
            body: JSON.stringify({
              text,
              language: "en-US",
              character: "black_cat",
              stream: after,
            }),
          });
          assert.equal(r.status, 200);
          const ar = r.body!.getReader();
          let bytes = 0;
          while (true) {
            const c = await ar.read();
            if (c.done) break;
            if (!bytes) firstAudioByteMs = performance.now() - t;
            bytes += c.value.length;
          }
          assert(bytes > 44);
          completeAudioMs = performance.now() - t;
        })();
      };
      while (true) {
        const c = await reader.read();
        buffer += decoder.decode(c.value || new Uint8Array(), {
          stream: !c.done,
        });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines.filter(Boolean)) {
          const e = JSON.parse(line);
          if (e.type === "route") {
            path = e.path;
            routerMs = e.routerMs;
          }
          if (e.type === "quick") {
            quick = true;
            firstTextMs = performance.now() - t;
            firstPhraseMs = firstTextMs;
            firstAudioByteMs = firstTextMs;
            completeAudioMs = firstTextMs;
          }
          if (e.type === "delta") {
            if (!firstTextMs) firstTextMs = performance.now() - t;
            reply += e.text;
            pending += e.text;
            if (!audioTask) {
              const parts = takeSpeech(pending, false, true);
              if (parts.sentences[0]) synth(parts.sentences[0]);
            }
          }
          if (e.type === "error") throw new Error(e.error);
        }
        if (c.done) break;
      }
      if (!audioTask && reply) synth(reply);
      await audioTask;
      const result = {
        sample: index + 1,
        path,
        routerMs,
        preloadMs: Math.round(preloadMs),
        mode: after
          ? quick
            ? "preloaded-static-audio"
            : "progressive-pcm-playback"
          : "existing-blob-playback",
        sttMs: Math.round(sttMs),
        recognitionMode: realtime ? "cartesia-ink-2-realtime" : "local-batch",
        recognitionTiming: realtime
          ? "final after last synthetic speech packet; includes provider end detection"
          : "post-upload batch transcription; excludes local end detection",
        recognitionSampleReused: index > 0,
        firstInterimFromConnectMs: firstInterimMs
          ? Math.round(firstInterimMs)
          : undefined,
        endSilenceMs: realtime ? undefined : 750,
        chatFirstTextMs: Math.round(firstTextMs),
        chatFirstPhraseMs: Math.round(firstPhraseMs),
        chatToFirstAudioByteMs: Math.round(firstAudioByteMs),
        chatToCompleteAudioMs: Math.round(completeAudioMs),
        note: after
          ? quick
            ? "Real HTTP timings. Static audio was preloaded; firstAudioByte means selection arrived, not playback."
            : "Real HTTP recognition and contextual generation/TTS timings. Streaming first byte excludes browser decoding/scheduling and physical audio output."
          : "Server HTTP timing; complete audio is when the old Blob player could decode/start. No microphone or physical playback measurement.",
      };
      results.push(result);
      console.log(JSON.stringify(result));
    }
    await mkdir("artifacts", { recursive: true });
    await writeFile(
      process.argv.includes("--natural")
        ? "artifacts/voice-natural-latency.json"
        : realtime
          ? "artifacts/voice-refresh-after.json"
          : after
            ? "artifacts/voice-latency-after.json"
            : "artifacts/voice-latency-before.json",
      JSON.stringify(
        { measuredAt: new Date().toISOString(), samples: results },
        null,
        2,
      ),
    );
  } finally {
    await admin.auth.admin.deleteUser(made.data.user!.id);
  }
}
main().catch((e) => {
  console.error("Latency check failed:", e.message);
  process.exitCode = 1;
});
