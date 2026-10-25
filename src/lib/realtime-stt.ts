export type RealtimeEvent = {
  type: string;
  transcript?: string;
  request_id?: string;
};
/** Only confirmed turn.end events yield a user turn. Eager ends/interims never answer. */
export class RealtimeTurnGate {
  private armed = false;
  private id: string | null = null;
  private ended = false;
  arm() {
    this.armed = true;
    this.id = null;
    this.ended = false;
  }
  cancel() {
    this.armed = false;
    this.id = null;
    this.ended = true;
  }
  receive(event: RealtimeEvent, idFactory = () => crypto.randomUUID()) {
    if (!this.armed) return null;
    if (event.type === "turn.start" && !this.id) {
      this.id = idFactory();
      this.ended = false;
    }
    if (!this.id || this.ended) return null;
    if (event.type === "turn.end") {
      this.ended = true;
      this.armed = false;
      return {
        id: this.id,
        text: (event.transcript || "").trim(),
        final: true,
      };
    }
    if (["turn.update", "turn.eager_end", "turn.resume"].includes(event.type))
      return {
        id: this.id,
        text: (event.transcript || "").trim(),
        final: false,
      };
    return null;
  }
}
export type FinalRealtimeTurn = {
  id: string;
  text: string;
  speechEndAt: number;
  detectedEndAt: number;
  finalTranscriptAt: number;
};
export class RealtimeMicrophone {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private capture: AudioWorkletNode | null = null;
  private sink: GainNode | null = null;
  private socket: WebSocket | null = null;
  private grant: {
    token: string;
    expiresAt: number;
    model: string;
    version: string;
    endTimeoutMs: number;
    startThreshold?: number;
    eagerEndThreshold?: number;
    endThreshold?: number;
  } | null = null;
  private connection: Promise<void> | null = null;
  private abort = new AbortController();
  private generation = 0;
  private closed = false;
  private listening = false;
  private cleanEnd = true;
  private buffered: ArrayBuffer[] = [];
  private gate = new RealtimeTurnGate();
  private lastSpeechAt = 0;
  private onFinal: ((turn: FinalRealtimeTurn) => void) | null = null;
  private onInterim:
    ((text: string, turnId: string, phase: string) => void) | null = null;
  private onError: ((e: Error) => void) | null = null;
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  async open() {
    try {
      this.context = new AudioContext({ sampleRate: 16000 });
    } catch {
      this.context = new AudioContext();
    }
    await this.context.resume();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    if (this.closed) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    stream.getTracks().forEach((t) => {
      t.enabled = false;
    });
    await this.context.audioWorklet.addModule("/audio/pcm-capture.js");
    if (this.closed) return;
    this.source = this.context.createMediaStreamSource(stream);
    this.capture = new AudioWorkletNode(this.context, "haven-pcm-capture");
    this.sink = this.context.createGain();
    this.sink.gain.value = 0;
    this.source.connect(this.capture);
    this.capture.connect(this.sink);
    this.sink.connect(this.context.destination);
    this.capture.port.onmessage = (
      event: MessageEvent<{ pcm: ArrayBuffer; rms: number }>,
    ) => {
      if (!this.listening || this.closed) return;
      if (event.data.rms >= 0.018) this.lastSpeechAt = performance.now();
      if (this.socket?.readyState === WebSocket.OPEN) {
        if (this.socket.bufferedAmount > this.context!.sampleRate * 2 * 3) {
          this.fail(
            new Error(
              "Recognition connection is too slow. Please repeat that sentence.",
            ),
          );
          return;
        }
        this.socket.send(event.data.pcm);
      } else if (this.buffered.length < 80) {
        this.buffered.push(event.data.pcm);
      } else {
        // Never silently discard the tail of an utterance while reconnecting.
        this.fail(
          new Error(
            "Recognition could not keep up. Please repeat that sentence.",
          ),
        );
      }
    };
    await this.connect();
  }
  private async connect() {
    if (this.closed) throw new Error("Recognition closed.");
    if (this.socket?.readyState === WebSocket.OPEN) return;
    if (this.connection) return this.connection;
    const generation = this.generation;
    const task = (async () => {
      if (!this.grant || this.grant.expiresAt < Date.now() + 15000) {
        const r = await fetch("/api/voice/realtime-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: "en-US" }),
          signal: this.abort.signal,
        });
        if (!r.ok) throw new Error("Realtime recognition unavailable.");
        this.grant = await r.json();
      }
      if (this.closed || generation !== this.generation)
        throw new Error("Recognition canceled.");
      const grant = this.grant!;
      const url = new URL("wss://api.cartesia.ai/stt/turns/websocket");
      for (const [key, value] of Object.entries({
        access_token: grant.token,
        model: grant.model,
        encoding: "pcm_s16le",
        sample_rate: String(this.context!.sampleRate),
        cartesia_version: grant.version,
        turn_end_timeout_ms: String(grant.endTimeoutMs),
        turn_start_threshold: String(grant.startThreshold ?? 0.75),
        turn_eager_end_threshold: String(grant.eagerEndThreshold ?? 0.55),
        turn_end_threshold: String(grant.endThreshold ?? 0.3),
      }))
        url.searchParams.set(key, value);
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(url);
        this.socket = socket;
        let opened = false;
        const timeout = setTimeout(() => {
          socket.close();
          reject(new Error("Realtime connection timed out."));
        }, 8000);
        const valid = () =>
          !this.closed &&
          this.socket === socket &&
          generation === this.generation;
        socket.onopen = () => {
          clearTimeout(timeout);
          if (!valid()) {
            socket.close();
            reject(new Error("Recognition canceled."));
            return;
          }
          opened = true;
          for (const pcm of this.buffered) socket.send(pcm);
          this.buffered = [];
          resolve();
        };
        socket.onmessage = (event) => {
          if (!valid()) return;
          let data: RealtimeEvent;
          try {
            data = JSON.parse(String(event.data));
          } catch {
            return;
          }
          if (data.type === "error") {
            this.fail(new Error("Realtime recognition interrupted."));
            return;
          }
          if (!this.listening) return;
          if (data.type === "turn.start") {
            if (this.turnTimer) clearTimeout(this.turnTimer);
            this.turnTimer = setTimeout(
              () =>
                this.fail(new Error("Please keep each turn under 30 seconds.")),
              35000,
            );
          }
          const turn = this.gate.receive(data);
          if (!turn) return;
          if (turn.final) {
            if (this.turnTimer) clearTimeout(this.turnTimer);
            this.cleanEnd = true;
            this.listening = false;
            this.stream?.getTracks().forEach((t) => {
              t.enabled = false;
            });
            const now = performance.now();
            this.onFinal?.({
              ...turn,
              speechEndAt: this.lastSpeechAt || now,
              detectedEndAt: now,
              finalTranscriptAt: now,
            });
          } else this.onInterim?.(turn.text, turn.id, data.type);
        };
        socket.onerror = () => {
          clearTimeout(timeout);
          if (!opened) reject(new Error("Realtime connection failed."));
          else if (valid())
            this.fail(new Error("Realtime recognition interrupted."));
        };
        socket.onclose = () => {
          clearTimeout(timeout);
          if (!opened) reject(new Error("Realtime connection closed."));
          if (valid()) {
            this.socket = null;
            if (this.listening)
              this.fail(new Error("Realtime recognition interrupted."));
          }
        };
      });
    })();
    this.connection = task;
    try {
      await task;
    } finally {
      if (this.connection === task) this.connection = null;
    }
  }
  listenFinal(
    onFinal: (turn: FinalRealtimeTurn) => void,
    onInterim: (text: string, turnId: string, phase: string) => void,
    onError: (e: Error) => void,
  ) {
    if (this.closed || !this.stream)
      throw new Error("Recognition unavailable.");
    this.onFinal = onFinal;
    this.onInterim = onInterim;
    this.onError = onError;
    this.capture?.port.postMessage({ type: "reset" });
    this.gate.arm();
    this.cleanEnd = false;
    this.listening = true;
    this.lastSpeechAt = 0;
    this.stream.getTracks().forEach((t) => {
      t.enabled = true;
    });
    void this.context
      ?.resume()
      .catch(() => this.fail(new Error("Microphone paused.")));
    void this.connect().catch((e) => {
      if (this.listening && !this.closed) this.fail(e);
    });
  }
  private fail(error: Error) {
    if (this.closed) return;
    const callback = this.onError;
    this.pause();
    callback?.(error);
  }
  pause() {
    const wasListening = this.listening;
    this.listening = false;
    this.capture?.port.postMessage({ type: "reset" });
    this.gate.cancel();
    this.buffered = [];
    this.stream?.getTracks().forEach((t) => {
      t.enabled = false;
    });
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
    if (wasListening && !this.cleanEnd) {
      this.generation++;
      const socket = this.socket;
      this.socket = null;
      socket?.close();
      this.connection = null;
    }
  }
  close() {
    this.closed = true;
    this.pause();
    this.generation++;
    this.abort.abort();
    this.socket?.close();
    this.socket = null;
    this.grant = null;
    this.capture?.port.close();
    this.capture?.disconnect();
    this.source?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.context?.close().catch(() => {});
    this.context = null;
    this.onFinal = null;
    this.onInterim = null;
    this.onError = null;
  }
}
