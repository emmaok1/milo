import { createHmac } from "node:crypto";
export function speechToken() {
  return process.env.VOICE_STT_TOKEN || (process.env.MEMORY_SERVICE_TOKEN ? createHmac("sha256", process.env.MEMORY_SERVICE_TOKEN).update("haven-local-speech").digest("hex") : "");
}
export function speechUrl() { return process.env.VOICE_STT_URL || "http://127.0.0.1:8002"; }
export function validAudio(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  return (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) ||
    b.toString("ascii", 4, 8) === "ftyp" || b.toString("ascii", 0, 4) === "OggS" ||
    (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WAVE");
}
export async function speechReady() {
  if (!speechToken()) return false;
  try { const r = await fetch(speechUrl() + "/health", { cache: "no-store", signal: AbortSignal.timeout(1500) }); return r.ok && (await r.json()).ready === true; }
  catch { return false; }
}
