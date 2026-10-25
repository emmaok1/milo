import { loadEnvConfig } from "@next/env";
import { readFile, writeFile } from "node:fs/promises";
loadEnvConfig(process.cwd());
async function main() {
  const headers = {
    Authorization: `Bearer ${process.env.CARTESIA_API_KEY}`,
    "Cartesia-Version": "2026-08-14",
    "Content-Type": "application/json",
  };
  const responses = await Promise.all([
    fetch("https://api.cartesia.ai/voices?q=calm&limit=100", { headers }),
    fetch("https://api.cartesia.ai/access-token", {
      method: "POST",
      headers,
      body: JSON.stringify({ grants: { stt: true }, expires_in: 300 }),
    }),
  ]);
  const voices = await responses[0].json();
  console.log(
    "VOICE_CATALOG",
    responses[0].status,
    JSON.stringify(
      (voices.data || [])
        .map((v: Record<string, unknown>) => ({
          id: v.id,
          name: v.name,
          description: v.description,
          gender: v.gender,
          language: v.language,
        }))
        .slice(0, 20),
    ),
  );
  const grant = await responses[1].json();
  console.log(
    "STT_TOKEN",
    responses[1].status,
    typeof grant.token === "string",
  );
  if (!grant.token) return;
  const url = new URL("wss://api.cartesia.ai/stt/turns/websocket");
  for (const [k, v] of Object.entries({
    access_token: grant.token,
    model: "ink-2",
    encoding: "pcm_s16le",
    sample_rate: "16000",
    cartesia_version: "2026-08-14",
    turn_end_timeout_ms: "1600",
  }))
    url.searchParams.set(k, String(v));
  const input = await readFile("/tmp/haven-latency-input.wav");
  let data = Buffer.alloc(0),
    rate = 24000;
  for (let p = 12; p + 8 <= input.length;) {
    const n = input.readUInt32LE(p + 4);
    if (input.toString("ascii", p, p + 4) === "fmt ")
      rate = input.readUInt32LE(p + 12);
    if (input.toString("ascii", p, p + 4) === "data") {
      data = input.subarray(p + 8, p + 8 + n);
      break;
    }
    p += 8 + n + (n % 2);
  }
  const frames = Math.floor(data.length / 2),
    out = Buffer.alloc(Math.floor((frames * 16000) / rate) * 2);
  for (let i = 0; i < out.length / 2; i++)
    out.writeInt16LE(
      data.readInt16LE(
        Math.min(frames - 1, Math.floor((i * rate) / 16000)) * 2,
      ),
      i * 2,
    );
  const started = performance.now();
  let lastSent = 0,
    firstUpdate = 0,
    ended = 0,
    words = 0,
    feedDone = false;
  const events: object[] = [];
  const ws = new WebSocket(url);
  let timer: ReturnType<typeof setTimeout>;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Realtime probe timed out."));
    }, 25000);
    ws.onopen = async () => {
      console.log(
        "STT_SOCKET_OPEN_MS",
        Math.round(performance.now() - started),
      );
      for (let i = 0; i < out.length && ws.readyState === 1; i += 3200) {
        ws.send(out.subarray(i, i + 3200));
        lastSent = performance.now();
        await new Promise((r) => setTimeout(r, 100));
      }
      feedDone = true;
      for (let i = 0; i < 25 && ws.readyState === 1; i++) {
        ws.send(new Uint8Array(3200));
        await new Promise((r) => setTimeout(r, 100));
      }
    };
    ws.onmessage = (e) => {
      const event = JSON.parse(String(e.data));
      if (event.type !== "connected")
        events.push({
          type: event.type,
          text: event.transcript,
          at: Math.round(performance.now() - started),
        });
      if (event.type === "error") {
        clearTimeout(timeout);
        ws.close();
        reject(
          new Error("Realtime provider rejected request: " + event.error_code),
        );
      }
      if (event.type === "turn.update" && !firstUpdate)
        firstUpdate = performance.now();
      if (event.type === "turn.end") {
        ended = performance.now();
        words = String(event.transcript || "").split(/\s+/).length;
        clearTimeout(timer);
        timer = setTimeout(
          () => {
            clearTimeout(timeout);
            ws.close();
            resolve();
          },
          feedDone ? 800 : 4000,
        );
      }
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Realtime connection failed."));
    };
  });
  await writeFile(
    "/tmp/haven-synthetic-stt-events.json",
    JSON.stringify(events, null, 2),
  );
  const result = {
    at: new Date().toISOString(),
    firstUpdateFromConnectMs: Math.round(firstUpdate - started),
    finalAfterLastAudioPacketMs: Math.round(ended - lastSent),
    syntheticAudioDurationMs: Math.round(out.length / 32),
    wordCount: words,
    note: "Real Cartesia Ink-2, synthetic public audio sent at real-time pacing; not phone speech-to-ear latency.",
  };
  await writeFile(
    "artifacts/voice-realtime-probe.json",
    JSON.stringify(result, null, 2),
  );
  console.log("REALTIME_RESULT", JSON.stringify(result));
}
main().catch((e) => {
  console.error("Probe failed:", e.message);
  process.exitCode = 1;
});
