export type PreparationRef = { turnId: string; revision: number };
/** Debounced, cancelable interim preparation. This class never speaks or persists a turn. */
export class VoicePrepareClient {
  private current: {
    turnId: string;
    text: string;
    revision: number;
    controller?: AbortController;
  } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private revision = 0;
  private attempts = 0;
  constructor(
    private payload: () => Record<string, unknown>,
    private transport: typeof fetch = fetch,
  ) {}
  update(text: string, turnId: string, phase = "turn.update") {
    if (phase === "turn.resume") {
      this.cancelPending();
      return;
    }
    text = text.trim();
    if (!text) return;
    if (this.current?.turnId !== turnId) {
      this.cancel();
      this.revision = 0;
      this.attempts = 0;
      this.current = { turnId, text: "", revision: 0 };
    }
    if (this.current!.text === text && this.current!.controller) return;
    this.cancelPending();
    this.current!.text = text;
    if (text.split(/\s+/).length < 4 || text.length < 18 || this.attempts >= 3)
      return;
    this.timer = setTimeout(
      () => this.start(),
      phase === "turn.eager_end" ? 40 : 300,
    );
  }
  private start() {
    this.timer = null;
    const current = this.current;
    if (!current || this.attempts >= 3) return;
    current.revision = ++this.revision;
    this.attempts++;
    const controller = new AbortController();
    current.controller = controller;
    void this.transport("/api/voice/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...this.payload(),
        turnId: current.turnId,
        revision: current.revision,
        text: current.text,
      }),
      signal: controller.signal,
    })
      .then((r) => {
        if (
          !r.ok &&
          this.current === current &&
          current.controller === controller
        )
          current.controller = undefined;
      })
      .catch(() => {});
  }
  private cancelPending() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const current = this.current;
    if (current?.controller) {
      current.controller.abort();
      current.controller = undefined;
      void this.transport("/api/voice/prepare", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callId: this.payload().callId,
          turnId: current.turnId,
          revision: current.revision,
        }),
        keepalive: true,
      }).catch(() => {});
    }
  }
  finish(text: string, turnId: string): PreparationRef | undefined {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const current = this.current;
    const canonical = (s: string) =>
      s.trim().replace(/[’]/g, "'").replace(/\s+/g, " ").replace(/\.$/, "");
    if (
      !current?.controller ||
      current.turnId !== turnId ||
      canonical(current.text) !== canonical(text)
    ) {
      this.cancel();
      return;
    }
    this.current = null;
    return { turnId, revision: current.revision };
  }
  cancel() {
    this.cancelPending();
    this.current = null;
  }
}
