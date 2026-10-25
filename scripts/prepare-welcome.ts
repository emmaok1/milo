import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { cartesiaSpeech } from "../src/lib/cartesia";
import {
  cachedWelcome,
  welcomeAudioPath,
  welcomeLine,
} from "../src/lib/welcome-audio";
import { assetRoot, validWav } from "../src/lib/quick-responses/assets";
import { characterIds } from "../src/lib/characters";
loadEnvConfig(process.cwd());
async function main() {
  await mkdir(assetRoot(), { recursive: true });
  for (const character of characterIds) {
    if (await cachedWelcome(character)) {
      console.log("REUSE", character);
      continue;
    }
    if (process.argv.includes("--dry-run")) {
      console.log("NEEDED", character);
      continue;
    }
    const body = await cartesiaSpeech(welcomeLine, "en-US", character);
    const bytes = Buffer.from(await new Response(body).arrayBuffer());
    if (!validWav(bytes)) throw new Error("Invalid welcome audio.");
    const file = welcomeAudioPath(character),
      tmp = file + randomUUID() + ".tmp";
    await writeFile(tmp, bytes);
    await rename(tmp, file);
    console.log("READY", character, bytes.length);
  }
}
main().catch(() => {
  console.error("Welcome audio preparation failed.");
  process.exitCode = 1;
});
