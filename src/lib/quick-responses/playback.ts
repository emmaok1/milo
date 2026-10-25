import { get, update, type Context } from "../store";
export type PlaybackState =
  "pending" | "started" | "completed" | "interrupted" | "failed" | "fallback";
export function nextPlaybackState(
  previous: PlaybackState,
  next: PlaybackState,
): PlaybackState {
  if (["completed", "interrupted", "failed", "fallback"].includes(previous))
    return previous;
  if (next === "fallback")
    return previous === "pending" ? "fallback" : previous;
  if (next === "pending") return previous;
  return next;
}
export async function updateVoiceMessage(
  c: Context,
  id: string,
  data: Record<string, unknown>,
  expectedQuickId?: string,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await get(c, id, "message");
    if (expectedQuickId && row.data.quickResponseId !== expectedQuickId)
      return row;
    const patch = { ...data };
    if (
      ["interrupted", "failed"].includes(String(row.data.playbackState)) &&
      patch.state === "completed"
    )
      patch.state = "interrupted";
    try {
      return await update(c, id, patch, row.version);
    } catch (e) {
      if (
        attempt === 2 ||
        !(e instanceof Error) ||
        !("status" in e) ||
        e.status !== 409
      )
        throw e;
    }
  }
  throw new Error("Could not update playback.");
}
export function historyText(data: Record<string, unknown>) {
  const text = String(data.text || "");
  const state = data.playbackState;
  if (["pending", "started", "interrupted", "failed"].includes(String(state)))
    return `[Voice reply ${state}; do not assume the user heard the entire reply.] ${text}`;
  return text;
}
