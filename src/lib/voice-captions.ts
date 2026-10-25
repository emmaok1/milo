/** Incremental captions. Timing is approximate unless device word boundaries are available. */
export class VoiceCaptions {
  private text = "";
  private ends: number[] = [];
  private shown = 0;
  private active = false;
  private timer?: ReturnType<typeof setInterval>;
  constructor(private emit: (text: string) => void) {}
  start(text: string, estimatedClock = false) {
    this.cancel();
    this.text = text;
    const segments = [...new Intl.Segmenter(undefined, { granularity: "word" }).segment(text)];
    this.ends = segments.filter(s => s.isWordLike).map(s => s.index + s.segment.length);
    if (!this.ends.length) this.ends = [text.length];
    this.ends[this.ends.length - 1] = text.length;
    this.shown = 0;
    this.active = true;
    this.reveal(1);
    if (estimatedClock) {
      const start = performance.now();
      this.timer = setInterval(() => this.progress((performance.now() - start) / 1000), 60);
    }
  }
  progress(seconds: number, duration?: number) {
    if (!this.active || !Number.isFinite(seconds)) return;
    const total = duration && Number.isFinite(duration) && duration > 0
      ? duration : Math.max(1, this.ends.length * .38);
    // The last word is withheld until playback completes; never expose queued text.
    this.reveal(Math.min(this.ends.length - 1, 1 + Math.floor(Math.max(0, seconds) / total * this.ends.length)));
  }
  boundary(charIndex: number, charLength = 0) {
    if (!this.active) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    const end = Math.max(0, charIndex) + Math.max(0, charLength);
    const index = this.ends.findIndex(e => e >= end && e > charIndex);
    if (index >= 0) this.reveal(index + 1);
  }
  private reveal(count: number) {
    count = Math.max(this.shown, Math.min(this.ends.length, count));
    if (!this.active || count <= this.shown) return;
    this.shown = count;
    this.emit(this.text.slice(0, this.ends[count - 1]).trimEnd());
  }
  finish() {
    if (this.active) this.reveal(this.ends.length);
    this.cancel();
  }
  cancel() {
    this.active = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
}
