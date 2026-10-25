import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { demoRehearsal } from "./demo-rehearsal";
import { takeSpeech } from "./voice";
import { cartesiaPayload } from "./cartesia";
import type { CharacterId } from "./characters";
import { assetRoot, validWav } from "./quick-responses/assets";
export const rehearsalPhrases = [...new Set(demoRehearsal.flatMap(r=>[r.reply,...takeSpeech(r.reply,true,true).sentences]))];
export function rehearsalAudioPath(text:string,character:CharacterId) {
  const hash=createHash("sha256").update(JSON.stringify(cartesiaPayload(text,"en-US",character))).digest("hex");
  return path.join(assetRoot(),`rehearsal-${hash}.wav`);
}
export async function cachedRehearsal(text:string,character:CharacterId) {
  if(!rehearsalPhrases.includes(text)) return null;
  try { const bytes=await readFile(rehearsalAudioPath(text,character));return validWav(bytes)?bytes:null; } catch {return null;}
}
