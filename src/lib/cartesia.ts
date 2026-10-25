import type { CharacterId } from "./characters";
import type { VoiceLanguage } from "./voice";
// Official Sonic 3.6 recommended agent voices; audition on the target device.
export const cartesiaDefaults = {
  black_cat: { name: "Ronald", id: "5ee9feff-1265-424a-9d7f-8e4d431a12c7" },
  white_cat: { name: "Celine", id: "ca566b43-944e-4474-b494-7d9f0695f307" },
} as const;
export function cartesiaVoice(character: CharacterId) {
  return (
    process.env[
      character === "black_cat"
        ? "CARTESIA_VOICE_BLACK_CAT"
        : "CARTESIA_VOICE_WHITE_CAT"
    ] ||
    process.env[
      character === "black_cat" ? "CARTESIA_VOICE_MAN" : "CARTESIA_VOICE_WOMAN"
    ] ||
    cartesiaDefaults[character].id
  );
}
export function cartesiaReady(character: CharacterId) {
  return !!(process.env.CARTESIA_API_KEY && cartesiaVoice(character));
}
export function cartesiaPayload(
  text: string,
  language: VoiceLanguage,
  character: CharacterId,
  streaming = false,
  style?: "checkin",
) {
  const voice = cartesiaVoice(character);
  if (!voice)
    throw new Error("No enhanced voice has been selected for this character.");
  return {
    model_id: process.env.CARTESIA_MODEL || "sonic-3.6",
    transcript: text,
    voice,
    language: language.split("-")[0],
    output_format: {
      container: streaming ? "raw" : "wav",
      encoding: "pcm_s16le",
      sample_rate: 24000,
    },
    // Choose a naturally warm voice; avoid exaggerated pitch/emotion effects.
    generation_config: style === "checkin"
      ? { speed: 0.84, volume: 0.9, ...(language === "en-US" ? { emotion: "calm" } : {}) }
      : { speed: 0.94, volume: 0.92 },
  };
}
export async function cartesiaSpeech(
  text: string,
  language: VoiceLanguage,
  character: CharacterId,
  signal?: AbortSignal,
  streaming = false,
  style?: "checkin",
) {
  if (!process.env.CARTESIA_API_KEY)
    throw new Error("Enhanced voice is not configured.");
  const response = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${process.env.CARTESIA_API_KEY}`,
      "Cartesia-Version": process.env.CARTESIA_VERSION || "2026-08-14",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cartesiaPayload(text, language, character, streaming, style)),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  if (!response.ok || !response.body)
    throw new Error(
      "Enhanced voice is temporarily unavailable. You can choose Device voice for another call.",
    );
  return response.body;
}
