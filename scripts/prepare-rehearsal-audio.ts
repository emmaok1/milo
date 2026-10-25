import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { cachedRehearsal, rehearsalAudioPath, rehearsalPhrases } from "../src/lib/rehearsal-audio";
import { cartesiaSpeech } from "../src/lib/cartesia";
loadEnvConfig(process.cwd());
async function main() {
  for (const character of ["black_cat","white_cat"] as const) {
    for (const text of rehearsalPhrases) {
      if(await cachedRehearsal(text,character))continue;
      const body=await cartesiaSpeech(text,"en-US",character);
      const bytes=Buffer.from(await new Response(body).arrayBuffer());
      const file=rehearsalAudioPath(text,character);
      await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes);
    }
    console.log(`${character}: ${rehearsalPhrases.length} phrases ready`);
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
