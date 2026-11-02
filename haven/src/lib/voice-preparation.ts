import { createHash } from "node:crypto";
export const preparationEnabled = () =>
  process.env.VOICE_SPECULATIVE_GENERATION === "true";
export const canonicalTurn = (s: string) =>
  s.trim().replace(/[’]/g, "'").replace(/\s+/g, " ").replace(/\.$/, "");
export function preparationFingerprint(system: string, messages: unknown[]) {
  const copy = JSON.parse(JSON.stringify(messages));
  const last = copy.at(-1);
  if (last?.role === "user") {
    if (typeof last.content === "string")
      last.content = canonicalTurn(last.content);
    else if (Array.isArray(last.content))
      for (const part of last.content)
        if (part.type === "text") part.text = canonicalTurn(part.text);
  }
  return createHash("sha256")
    .update(JSON.stringify({ system, messages: copy }))
    .digest("hex");
}
type Entry = {
  revision: number;
  text: string;
  fingerprint?: string;
  chunks: string[];
  done: boolean;
  error?: unknown;
  claimed: boolean;
  abort: AbortController;
  notify: Set<() => void>;
  timer: ReturnType<typeof setTimeout>;
};
/** Short-lived owner/call/turn scoped work only. No audio, transcripts or model output are persisted here. */
export class VoicePreparationStore {
  private entries = new Map<string, Entry>();
  private key(owner: string, call: string, turn: string) {
    return JSON.stringify([owner, call, turn]);
  }
  reserve(
    owner: string,
    call: string,
    turn: string,
    revision: number,
    text: string,
  ) {
    const key = this.key(owner, call, turn),
      old = this.entries.get(key);
    if (old && old.revision >= revision) return null;
    this.cancel(owner, call, turn);
    if (this.entries.size >= 32) {
      const oldest = this.entries.keys().next().value;
      if (oldest) this.drop(oldest);
    }
    const entry: Entry = {
      revision,
      text,
      chunks: [],
      done: false,
      claimed: false,
      abort: new AbortController(),
      notify: new Set(),
      timer: setTimeout(() => this.drop(key), 30000),
    };
    entry.timer.unref?.();
    this.entries.set(key, entry);
    return entry;
  }
  private wake(e: Entry) {
    for (const notify of e.notify) notify();
    e.notify.clear();
  }
  private drop(key: string) {
    const e = this.entries.get(key);
    if (!e) return;
    clearTimeout(e.timer);
    this.entries.delete(key);
    e.abort.abort();
    e.done = true;
    this.wake(e);
  }
  cancel(owner: string, call: string, turn: string, revision?: number) {
    const key = this.key(owner, call, turn),
      e = this.entries.get(key);
    if (e && !e.claimed && (revision === undefined || e.revision <= revision))
      this.drop(key);
  }
  async generate(
    e: Entry,
    fingerprint: string,
    source: (signal: AbortSignal) => AsyncIterable<string>,
  ) {
    if (e.abort.signal.aborted) return;
    e.fingerprint = fingerprint;
    try {
      for await (const chunk of source(e.abort.signal)) {
        if (e.abort.signal.aborted) return;
        if (e.chunks.join("").length + chunk.length > 24000)
          throw Error("Prepared response too long.");
        e.chunks.push(chunk);
        this.wake(e);
      }
    } catch (error) {
      e.error = error;
    } finally {
      e.done = true;
      this.wake(e);
    }
  }
  claim(
    owner: string,
    call: string,
    turn: string,
    revision: number,
    text: string,
    fingerprint: string,
    signal: AbortSignal,
  ): AsyncIterable<string> | undefined {
    const key = this.key(owner, call, turn),
      e = this.entries.get(key);
    if (
      !e ||
      e.claimed ||
      e.revision !== revision ||
      e.error ||
      e.abort.signal.aborted ||
      canonicalTurn(e.text) !== canonicalTurn(text) ||
      e.fingerprint !== fingerprint
    )
      return;
    e.claimed = true;
    clearTimeout(e.timer);
    this.entries.delete(key);
    const wake = () => {
      e.abort.abort();
      this.wake(e);
    };
    signal.addEventListener("abort", wake, { once: true });
    const self = this;
    return (async function* () {
      let index = 0;
      try {
        while (!signal.aborted && !e.abort.signal.aborted) {
          while (index < e.chunks.length) yield e.chunks[index++];
          if (e.done) {
            if (e.error) throw e.error;
            return;
          }
          await new Promise<void>((resolve) => e.notify.add(resolve));
        }
      } finally {
        signal.removeEventListener("abort", wake);
        e.abort.abort();
        self.wake(e);
      }
    })();
  }
  size() {
    return this.entries.size;
  }
  clear() {
    for (const key of this.entries.keys()) this.drop(key);
  }
}
const globalPreparation = globalThis as typeof globalThis & {
  __havenVoicePreparation?: VoicePreparationStore;
};
export const voicePreparations = (globalPreparation.__havenVoicePreparation ||=
  new VoicePreparationStore());
