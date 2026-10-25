import test from "node:test";
import assert from "node:assert/strict";
import { VoiceAudioPlayer } from "../src/lib/voice-audio";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
function fakeContext() {
  const started = performance.now();
  const sources: { stopped: boolean; disconnected: boolean }[] = [];
  const ctx = {
    state: "running",
    get currentTime() {
      return (performance.now() - started) / 1000;
    },
    destination: {},
    resume: async () => {},
    close: async () => {
      ctx.state = "closed";
    },
    createBuffer: (_channels: number, frames: number, rate: number) => ({
      duration: frames / rate,
      copyToChannel: () => {},
    }),
    decodeAudioData: async (data: ArrayBuffer) => {
      if (data.byteLength < 4) throw new Error("Bad audio");
      return { duration: 0.12 };
    },
    createBufferSource: () => {
      let timer: ReturnType<typeof setTimeout>;
      const node = {
        buffer: null as { duration: number } | null,
        onended: null as (() => void) | null,
        stopped: false,
        disconnected: false,
        connect: () => {},
        disconnect() {
          this.disconnected = true;
        },
        start(at: number) {
          timer = setTimeout(
            () => node.onended?.(),
            Math.max(
              0,
              (at - ctx.currentTime + (node.buffer?.duration || 0)) * 1000,
            ),
          );
        },
        stop() {
          node.stopped = true;
          clearTimeout(timer);
        },
      };
      sources.push(node);
      return node;
    },
  };
  return { ctx: ctx as unknown as AudioContext, sources };
}
test("ready assets require successful fetch and decode; a voice-key change cannot reuse old audio", async () => {
  const original = globalThis.fetch;
  let count = 0;
  globalThis.fetch = async (input) => {
    count++;
    if (String(input).includes("missing"))
      return new Response("", { status: 404 });
    return new Response(String(input).includes("bad") ? "x" : "audio");
  };
  const { ctx } = fakeContext();
  const p = new VoiceAudioPlayer(() => ctx);
  try {
    await p.open();
    await p.preload([
      { id: "047", key: "voice-a" },
      { id: "090", key: "missing" },
      { id: "021", key: "bad" },
    ]);
    assert.deepEqual(p.readyKeys(), ["voice-a"]);
    assert(!p.has("voice-b"));
    await p.preload([{ id: "047", key: "voice-a" }]);
    assert.equal(count, 3);
    await assert.rejects(
      p.playCached("voice-b", new AbortController().signal, () => {}),
    );
  } finally {
    p.close();
    globalThis.fetch = original;
  }
});
test("interrupting cached playback stops scheduled audio and rejects pending work", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response("audio");
  const { ctx, sources } = fakeContext();
  const p = new VoiceAudioPlayer(() => ctx);
  const ac = new AbortController();
  let began = false;
  try {
    await p.open();
    await p.preload([{ id: "047", key: "cached" }]);
    const playing = p.playCached("cached", ac.signal, () => {
      began = true;
      ac.abort();
    });
    await assert.rejects(playing, /Canceled/);
    assert(began);
    assert(sources.every((n) => n.stopped && n.disconnected));
  } finally {
    p.close();
    globalThis.fetch = original;
  }
});
test("stale/canceled turns and teardown cannot start delayed audio", async () => {
  const { ctx, sources } = fakeContext();
  const p = new VoiceAudioPlayer(() => ctx);
  const ac = new AbortController();
  ac.abort();
  let starts = 0;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(9600));
      c.close();
    },
  });
  await assert.rejects(p.playPcm(stream, 24000, ac.signal, () => starts++));
  p.close();
  assert.equal(starts, 0);
  assert.equal(sources.length, 0);
  await assert.rejects(
    p.playPcm(
      new ReadableStream(),
      24000,
      new AbortController().signal,
      () => starts++,
    ),
  );
  assert.equal(starts, 0);
});
test("PCM starts while the network stream is still open and closes resources afterwards", async () => {
  const { ctx, sources } = fakeContext();
  const p = new VoiceAudioPlayer(() => ctx);
  let networkDone = false,
    startedBeforeEnd = false;
  const stream = new ReadableStream<Uint8Array>({
    async start(c) {
      c.enqueue(new Uint8Array(12000));
      await delay(100);
      networkDone = true;
      c.close();
    },
  });
  await p.playPcm(stream, 24000, new AbortController().signal, () => {
    startedBeforeEnd = !networkDone;
  });
  assert(startedBeforeEnd);
  assert(sources.every((n) => n.disconnected));
  p.close();
});
test("closing a call aborts asset downloads and clears decoded assets", async () => {
  const original = globalThis.fetch;
  let aborted = false;
  globalThis.fetch = async (_url, options) =>
    new Promise((_resolve, reject) =>
      options?.signal?.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Canceled", "AbortError"));
      }),
    );
  const { ctx } = fakeContext();
  const p = new VoiceAudioPlayer(() => ctx);
  try {
    await p.open();
    const preload = p.preload([{ id: "047", key: "pending" }]);
    await delay(5);
    p.close();
    await preload;
    assert(aborted);
    assert.deepEqual(p.readyKeys(), []);
  } finally {
    globalThis.fetch = original;
  }
});

test("PCM captions receive played audio time only after playback starts and stop on abort", async () => {
  const { ctx } = fakeContext();
  const p = new VoiceAudioPlayer(() => ctx);
  const controller = new AbortController();
  let started = false;
  const progress: number[] = [];
  const playing = p.playPcm(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(24000)); c.close(); } }), 24000, controller.signal,
    () => { started = true; },
    seconds => { assert(started); progress.push(seconds); });
  const rejected = assert.rejects(playing, { name: "AbortError" });
  await delay(130);
  assert(progress.length > 0);
  assert(progress.at(-1)! < .5);
  controller.abort(); await rejected;
  const count = progress.length;
  await delay(70); assert.equal(progress.length, count);
  p.close();
});
