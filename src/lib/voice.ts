import { voiceCompanionPrompt } from "./voice-companion-prompt";
import type { CharacterId } from "./characters";

export const voiceLanguageCodes = [
  "en-US",
  "zh-CN",
  "es-ES",
  "fr-FR",
  "de-DE",
  "ja-JP",
  "ko-KR",
  "pt-BR",
  "hi-IN",
  "ar-SA",
] as const;
export type VoiceLanguage = (typeof voiceLanguageCodes)[number];
export const voiceLanguageNames: Record<VoiceLanguage, string> = {
  "en-US": "English",
  "zh-CN": "Mandarin Chinese",
  "es-ES": "Spanish",
  "fr-FR": "French",
  "de-DE": "German",
  "ja-JP": "Japanese",
  "ko-KR": "Korean",
  "pt-BR": "Portuguese",
  "hi-IN": "Hindi",
  "ar-SA": "Arabic",
};

/** Keep an unfinished sentence until more tokens arrive. A bounded chunk also
 * avoids long utterances on mobile speech engines. Never invent word timing. */
export function takeSpeech(
  text: string,
  flush = false,
  first = false,
): { sentences: string[]; rest: string } {
  const sentences: string[] = [];
  let rest = text;
  while (rest) {
    const match = /[。！？!?](?:[”’"']*)|[.](?=\s|$)|\n/.exec(rest);
    let boundary = match ? match.index + match[0].length : -1;
    // Start at a natural first-clause boundary; keep subsequent sentences intact
    // so every comma does not become a separate, choppy utterance.
    if (first && !sentences.length && boundary < 0) {
      const clause = /[，,；;：:]/g;
      const minimum = /[\u4e00-\u9fff]/.test(rest) ? 14 : 50;
      for (const m of rest.matchAll(clause)) {
        if (m.index >= minimum && m.index < 140) {
          boundary = m.index + 1;
          break;
        }
      }
    }
    const space = rest.length > 180 ? rest.lastIndexOf(" ", 180) : -1;
    const cut =
      boundary > 0 && boundary <= 220
        ? boundary
        : rest.length > 220
          ? space > 60
            ? space
            : 180
          : -1;
    if (cut < 0) break;
    const sentence = rest.slice(0, cut).trim();
    if (sentence) sentences.push(sentence);
    rest = rest.slice(cut).trimStart();
  }
  if (flush && rest.trim()) {
    sentences.push(rest.trim());
    rest = "";
  }
  return { sentences, rest };
}

export function voicePrompt(language: VoiceLanguage) {
  return (
    voiceCompanionPrompt +
    `
The selected conversation language is ${voiceLanguageNames[language]}. Use this language throughout the call; English is the default only when English is selected. `
  );
}

type VoiceChoice = {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
};
export function chooseVoice<T extends VoiceChoice>(
  voices: T[],
  language: string,
  selected = "",
  character?: CharacterId,
): T | undefined {
  const normalize = (s: string) => s.toLowerCase().replaceAll("_", "-");
  const lang = normalize(language);
  const candidates = voices.filter(
    (v) => normalize(v.lang).split("-")[0] === lang.split("-")[0],
  );
  const explicit = candidates.find((v) => v.voiceURI === selected);
  if (explicit) return explicit;
  const matchRole = (name: string) =>
    character === "black_cat"
      ? /\b(daniel|alex|thomas|guy|david|male)\b/i.test(name)
      : character
        ? /\b(samantha|karen|serena|jenny|aria|female|siri)\b/i.test(name)
        : false;
  const score = (v: T) =>
    (normalize(v.lang) === lang ? 100 : 0) +
    (v.localService ? 20 : 0) +
    (/enhanced|premium|natural|neural|siri/i.test(v.name) ? 10 : 0) +
    (matchRole(v.name) ? 30 : 0) +
    (v.default ? 2 : 0);
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}
export function speechText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " Code is available in the transcript. ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_#`>]/g, "")
    .trim();
}
