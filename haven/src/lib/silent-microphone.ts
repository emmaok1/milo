/** Persistent microphone capture: no browser dictation API, no app-generated tones. */
export class TurnDetector {
  private voiceMs = 0;
  private lastVoice = 0;
  private started = 0;
  get speechEndAt() {
    return this.lastVoice;
  }
  reset(now: number) {
    this.voiceMs = 0;
    this.lastVoice = 0;
    this.started = now;
  }
  update(rms: number, now: number, interval = 50): "speech" | "idle" | "end" {
    if (rms >= 0.018) {
      this.voiceMs += interval;
      this.lastVoice = now;
    } else if (this.voiceMs < 180 && now - this.lastVoice > 250)
      this.voiceMs = 0;
    if (
      this.voiceMs >= 180 &&
      (now - this.lastVoice >= 750 || now - this.started >= 30000)
    )
      return "end";
    return this.voiceMs >= 180 ? "speech" : "idle";
  }
}
export class SilentMicrophone {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private closed = false;
  async open() {
    const context = new AudioContext();
    this.context = context;
    await context.resume();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    if (this.closed) {
      stream.getTracks().forEach((t) => t.stop());
      await context.close().catch(() => {});
      return;
    }
    this.stream = stream;
    this.source = context.createMediaStreamSource(stream);
    this.analyser = context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.source.connect(this.analyser);
    this.sink = context.createGain();
    this.sink.gain.value = 0;
    this.analyser.connect(this.sink);
    this.sink.connect(context.destination);
    stream.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });
  }
  listen(
    onTurn: (
      audio: Blob,
      timing?: { speechEndAt: number; detectedEndAt: number },
    ) => void,
    onError: (error: Error) => void,
  ) {
    this.pause();
    if (this.closed || !this.stream || !this.analyser) return;
    if (this.context?.state === "suspended")
      void this.context
        .resume()
        .catch(() =>
          onError(new Error("The microphone paused. Tap Speak to resume.")),
        );
    this.stream.getAudioTracks().forEach((t) => {
      t.enabled = true;
    });
    const generation = this.generation,
      detector = new TurnDetector();
    detector.reset(performance.now());
    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/webm",
    ].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(
      this.stream,
      mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined,
    );
    this.recorder = recorder;
    const chunks: Blob[] = [];
    let finished = false,
      hasSpeech = false;
    let detectedEndAt = 0;
    const valid = () => !this.closed && generation === this.generation;
    const stop = () => {
      if (finished) return;
      finished = true;
      detectedEndAt = performance.now();
      this.clearTimers();
      if (recorder.state !== "inactive") recorder.stop();
    };
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onerror = () => {
      if (valid()) {
        this.pause();
        onError(
          new Error(
            "Microphone recording failed. Tap the microphone to retry.",
          ),
        );
      }
    };
    recorder.onstop = () => {
      if (!valid()) return;
      this.recorder = null;
      this.stream?.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
      if (hasSpeech)
        onTurn(new Blob(chunks, { type: recorder.mimeType }), {
          speechEndAt: detector.speechEndAt,
          detectedEndAt,
        });
      else this.listen(onTurn, onError);
    };
    recorder.start(250);
    const samples = new Float32Array(this.analyser.fftSize);
    this.timer = setInterval(() => {
      if (!valid() || !this.analyser) return;
      this.analyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(
        samples.reduce((sum, x) => sum + x * x, 0) / samples.length,
      );
      const state = detector.update(rms, performance.now());
      if (state === "speech" || state === "end") hasSpeech = true;
      if (state === "end") stop();
    }, 50);
    // Renew silent buffers without restarting the microphone or uploading silence.
    this.idleTimer = setTimeout(stop, 31000);
  }
  private clearTimers() {
    if (this.timer) clearInterval(this.timer);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.timer = null;
    this.idleTimer = null;
  }
  pause() {
    this.generation++;
    this.clearTimers();
    const recorder = this.recorder;
    this.recorder = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    this.stream?.getAudioTracks().forEach((t) => {
      t.enabled = false;
    });
  }
  close() {
    this.closed = true;
    this.pause();
    this.source?.disconnect();
    this.sink?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
