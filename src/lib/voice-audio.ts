/** PCM framing is independent of fetch chunk boundaries (including odd byte splits). */
export class Pcm16Decoder {
  private tail: number | undefined;
  decode(bytes: Uint8Array, final = false) {
    const data =
      this.tail === undefined ? bytes : Uint8Array.from([this.tail, ...bytes]);
    const count = Math.floor(data.length / 2);
    const result = new Float32Array(count);
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (let i = 0; i < count; i++)
      result[i] = view.getInt16(i * 2, true) / 32768;
    this.tail = data.length % 2 ? data[data.length - 1] : undefined;
    if (final && this.tail !== undefined)
      throw new Error("Incomplete audio sample.");
    return result;
  }
}
export type QuickAssetRef = {
  id: string;
  key: string;
  url?: string;
  preload?: boolean;
};
export class FinalTurnGuard {
  private seen = new Set<string>();
  accept(id: string) {
    if (this.seen.has(id)) return false;
    this.seen.add(id);
    return true;
  }
  clear() {
    this.seen.clear();
  }
}
/** Browser audio clock is the playback-start signal, not an acoustic measurement. */
export class VoiceAudioPlayer {
  constructor(
    private createContext: () => AudioContext = () => new AudioContext(),
  ) {}
  private context: AudioContext | null = null;
  private nodes = new Set<AudioBufferSourceNode>();
  private cancel: (() => void) | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private readyTimes = new Map<string, number>();
  private loading = new Map<string, Promise<void>>();
  private preloadController = new AbortController();
  private closed = false;
  private streamCancel: (() => void) | null = null;
  async open() {
    if (this.closed) throw new Error("Audio player closed.");
    this.context ||= this.createContext();
    await this.context.resume();
  }
  readyKeys() {
    return [...this.buffers.keys()];
  }
  readyAt(key: string) {
    return this.readyTimes.get(key);
  }
  has(key: string) {
    return this.buffers.has(key);
  }
  async preload(assets: QuickAssetRef[]) {
    const jobs = assets.slice();
    await Promise.all(
      Array.from({ length: Math.min(2, jobs.length) }, async () => {
        while (jobs.length) {
          const a = jobs.shift()!;
          await this.load(a).catch(() => {});
        }
      }),
    );
  }
  private async load(asset: QuickAssetRef) {
    if (this.closed || this.buffers.has(asset.key)) return;
    if (this.loading.has(asset.key)) return this.loading.get(asset.key);
    const task = (async () => {
      const r = await fetch(
        asset.url || `/api/voice/quick-audio/${asset.key}`,
        { signal: this.preloadController.signal },
      );
      if (!r.ok) throw new Error("Audio unavailable.");
      const data = await r.arrayBuffer();
      const buffer = await this.context!.decodeAudioData(data);
      if (!this.closed && !this.preloadController.signal.aborted) {
        this.buffers.set(asset.key, buffer);
        this.readyTimes.set(asset.key, performance.now());
      }
    })();
    this.loading.set(asset.key, task);
    try {
      await task;
    } finally {
      this.loading.delete(asset.key);
    }
  }
  async playCached(key: string, signal: AbortSignal, onStart: () => void, onProgress?: (seconds: number, duration?: number) => void) {
    const b = this.buffers.get(key);
    if (!b) throw new Error("Audio not ready.");
    await this.play(
      async (schedule) => {
        schedule(b);
      },
      signal,
      onStart,
      onProgress,
    );
  }
  async playPcm(
    stream: ReadableStream<Uint8Array>,
    sampleRate: number,
    signal: AbortSignal,
    onStart: () => void,
    onProgress?: (seconds: number, duration?: number) => void,
  ) {
    const decoder = new Pcm16Decoder();
    const reader = stream.getReader();
    const cancel = () => {
      void reader.cancel().catch(() => {});
    };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      await this.play(
        async (schedule) => {
          this.streamCancel = cancel;
          let pending: Float32Array[] = [];
          let frames = 0;
          while (true) {
            const chunk = await reader.read();
            if (signal.aborted)
              throw new DOMException("Canceled", "AbortError");
            const samples = decoder.decode(
              chunk.value || new Uint8Array(),
              chunk.done,
            );
            if (samples.length) {
              pending.push(samples);
              frames += samples.length;
            }
            if (frames && (frames >= sampleRate * 0.06 || chunk.done)) {
              const joined = new Float32Array(frames);
              let offset = 0;
              for (const part of pending) {
                joined.set(part, offset);
                offset += part.length;
              }
              const b = this.context!.createBuffer(1, frames, sampleRate);
              b.copyToChannel(joined, 0);
              schedule(b);
              pending = [];
              frames = 0;
            }
            if (chunk.done) break;
          }
        },
        signal,
        onStart,
        onProgress,
      );
    } finally {
      signal.removeEventListener("abort", cancel);
      if (this.streamCancel === cancel) this.streamCancel = null;
      reader.releaseLock();
    }
  }
  private async play(
    produce: (schedule: (b: AudioBuffer) => void) => Promise<void>,
    signal: AbortSignal,
    onStart: () => void,
    onProgress?: (seconds: number, duration?: number) => void,
  ) {
    this.stop();
    await this.open();
    if (signal.aborted || this.closed)
      throw new DOMException("Canceled", "AbortError");
    const ctx = this.context!;
    if (ctx.state !== "running") throw new Error("Audio is paused.");
    return new Promise<void>((resolve, reject) => {
      let next = ctx.currentTime + 0.045,
        finished = false,
        settled = false,
        first = true,
        started = false;
      let timer: ReturnType<typeof setInterval> | undefined;
      const ranges: { at: number; duration: number }[] = [];
      let progressAt = -1;
      const cleanup = () => {
        if (timer) clearInterval(timer);
        signal.removeEventListener("abort", abort);
        if (this.cancel === abort) this.cancel = null;
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        for (const n of this.nodes) {
          n.onended = null;
          try {
            n.stop();
          } catch {}
          n.disconnect();
        }
        this.nodes.clear();
        reject(error);
      };
      const abort = () => fail(new DOMException("Canceled", "AbortError"));
      this.cancel = abort;
      signal.addEventListener("abort", abort, { once: true });
      const check = () => {
        if (finished && !this.nodes.size && !settled) {
          settled = true;
          cleanup();
          if (!started) reject(new Error("No audio was played."));
          else {
            const duration = ranges.reduce((sum, r) => sum + r.duration, 0);
            onProgress?.(duration, duration);
            resolve();
          }
        }
      };
      const schedule = (buffer: AudioBuffer) => {
        if (settled || signal.aborted || this.closed)
          throw new DOMException("Canceled", "AbortError");
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        this.nodes.add(source);
        const at = Math.max(next, ctx.currentTime + 0.015);
        next = at + buffer.duration;
        source.onended = () => {
          source.disconnect();
          this.nodes.delete(source);
          check();
        };
        ranges.push({ at, duration: buffer.duration });
        source.start(at);
        if (first) {
          first = false;
          timer = setInterval(() => {
            if (!settled && ctx.state === "running" && ctx.currentTime >= at) {
              if (!started) { started = true; onStart(); }
              if (ctx.currentTime - progressAt >= .04) {
                progressAt = ctx.currentTime;
                const elapsed = ranges.reduce((sum, r) => sum + Math.max(0, Math.min(r.duration, ctx.currentTime - r.at)), 0);
                const duration = finished ? ranges.reduce((sum, r) => sum + r.duration, 0) : undefined;
                onProgress?.(elapsed, duration);
              }
            }
          }, 5);
        }
      };
      void produce(schedule).then(() => {
        finished = true;
        check();
      }, fail);
    });
  }
  stop() {
    this.streamCancel?.();
    this.streamCancel = null;
    this.cancel?.();
    this.cancel = null;
    for (const n of this.nodes) {
      try {
        n.stop();
      } catch {}
      n.disconnect();
    }
    this.nodes.clear();
  }
  close() {
    this.closed = true;
    this.stop();
    this.preloadController.abort();
    this.buffers.clear();
    this.readyTimes.clear();
    this.loading.clear();
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
