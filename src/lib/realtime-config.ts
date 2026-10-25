/** Semantic detection stays responsive; the timeout only bounds uncertain pauses. */
export function realtimeTurnSettings() {
  return {
    startThreshold: 0.75,
    eagerEndThreshold: 0.55,
    endThreshold: 0.3,
    endTimeoutMs: 3200,
  };
}
export const realtimeEnabled = (language: string) =>
  process.env.VOICE_REALTIME_STT === "true" &&
  !!process.env.CARTESIA_API_KEY &&
  language === "en-US";
export async function realtimeGrant(signal?: AbortSignal) {
  const expiresIn = 900;
  const response = await fetch("https://api.cartesia.ai/access-token", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CARTESIA_API_KEY}`,
      "Cartesia-Version": process.env.CARTESIA_VERSION || "2026-08-14",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ grants: { stt: true }, expires_in: expiresIn }),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
      : AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Realtime recognition unavailable.");
  const data = await response.json();
  if (typeof data.token !== "string")
    throw new Error("Realtime recognition unavailable.");
  return {
    token: data.token,
    expiresAt: Date.now() + expiresIn * 1000,
    model: process.env.CARTESIA_STT_MODEL || "ink-2",
    version: process.env.CARTESIA_VERSION || "2026-08-14",
    ...realtimeTurnSettings(),
  };
}
