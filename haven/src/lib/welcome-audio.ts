import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CharacterId } from "./characters";
import { cartesiaPayload } from "./cartesia";
import { assetRoot, validWav } from "./quick-responses/assets";
export const welcomeLine = "Welcome home. Meow.";
export function welcomeAudioPath(character: CharacterId) {
  const hash = createHash("sha256")
    .update(JSON.stringify(cartesiaPayload(welcomeLine, "en-US", character)))
    .digest("hex");
  return path.join(assetRoot(), `welcome-${hash}.wav`);
}
export async function cachedWelcome(character: CharacterId) {
  try {
    const bytes = await readFile(welcomeAudioPath(character));
    return validWav(bytes) ? bytes : null;
  } catch {
    return null;
  }
}
