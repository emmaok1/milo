/** Synthetic public audio only; never print provider grants or transcripts. */
export async function measureRealtime(
  input: Buffer,
  grant: {
    token: string;
    model: string;
    version: string;
    endTimeoutMs: number;
    startThreshold?: number;
    eagerEndThreshold?: number;
    endThreshold?: number;
  },
) {
  let data: Buffer = Buffer.alloc(0),
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
  const frames = data.length / 2,
    pcm = Buffer.alloc(Math.floor((frames * 16000) / rate) * 2);
  for (let i = 0; i < pcm.length / 2; i++)
    pcm.writeInt16LE(
      data.readInt16LE(
        Math.min(frames - 1, Math.floor((i * rate) / 16000)) * 2,
      ),
      i * 2,
    );
  const url = new URL("wss://api.cartesia.ai/stt/turns/websocket");
  for (const [k, v] of Object.entries({
    access_token: grant.token,
    model: grant.model,
    encoding: "pcm_s16le",
    sample_rate: 16000,
    cartesia_version: grant.version,
    turn_end_timeout_ms: grant.endTimeoutMs,
    turn_start_threshold: grant.startThreshold ?? 0.75,
    turn_eager_end_threshold: grant.eagerEndThreshold ?? 0.55,
    turn_end_threshold: grant.endThreshold ?? 0.3,
  }))
    url.searchParams.set(k, String(v));
  let lastAudio = 0,
    feedDone = false,
    firstInterim = 0;
  const started = performance.now();
  const ws = new WebSocket(url);
  let finished = false;
  return await new Promise<{
    text: string;
    finalAfterLastAudioPacketMs: number;
    firstInterimFromConnectMs: number;
  }>((resolve, reject) => {
    const finish = (error?: Error, text = "") => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      ws.close();
      error
        ? reject(error)
        : resolve({
            text,
            finalAfterLastAudioPacketMs: performance.now() - lastAudio,
            firstInterimFromConnectMs: firstInterim - started,
          });
    };
    const timeout = setTimeout(
      () => finish(new Error("Realtime latency probe timed out.")),
      25000,
    );
    ws.onopen = () => {
      void (async () => {
        for (let i = 0; i < pcm.length && !finished; i += 3200) {
          ws.send(pcm.subarray(i, i + 3200));
          lastAudio = performance.now();
          await new Promise((r) => setTimeout(r, 100));
        }
        feedDone = true;
        for (let i = 0; i < 40 && !finished; i++) {
          ws.send(new Uint8Array(3200));
          await new Promise((r) => setTimeout(r, 100));
        }
      })().catch(() => finish(new Error("Realtime audio could not be sent.")));
    };
    ws.onmessage = (e) => {
      const data = JSON.parse(String(e.data));
      if (data.type === "turn.update" && !firstInterim)
        firstInterim = performance.now();
      if (data.type === "error")
        finish(new Error("Realtime provider rejected audio."));
      if (data.type === "turn.end" && feedDone)
        finish(undefined, String(data.transcript || ""));
    };
    ws.onerror = () => finish(new Error("Realtime connection failed."));
  });
}
