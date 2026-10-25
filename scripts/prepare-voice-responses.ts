import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  quickResponses,
  quickResponseById,
  validateLibrary,
  indexedLibrary,
} from "../src/lib/quick-responses/library";
import {
  expectedAsset,
  loadManifest,
  assetBytes,
  assetRoot,
  digest,
  validWav,
  type AudioAsset,
} from "../src/lib/quick-responses/assets";
import { cartesiaSpeech } from "../src/lib/cartesia";
import { characterIds, type CharacterId } from "../src/lib/characters";
loadEnvConfig(process.cwd());
async function main() {
  validateLibrary();
  const args = process.argv.slice(2);
  const value = (name: string) =>
    args.find((a) => a.startsWith(name + "="))?.slice(name.length + 1);
  const selected = value("--ids");
  const voices = (value("--voices") || "black_cat").split(",") as CharacterId[];
  if (voices.some((v) => !characterIds.includes(v)))
    throw new Error("Use black_cat or white_cat.");
  const ids =
    selected === "all"
      ? quickResponses.map((r) => r.id)
      : (selected || "016,047,090").split(",").map((v) => v.padStart(3, "0"));
  if (ids.some((id) => !quickResponseById.has(id)))
    throw new Error("Unknown response ID.");
  const dry = args.includes("--dry-run") || args.includes("--list");
  if (!dry && !process.env.CARTESIA_API_KEY)
    throw new Error("Set CARTESIA_API_KEY on the server first.");
  const manifest = await loadManifest();
  const results = new Map(manifest.assets.map((a) => [a.key, a]));
  const jobs = voices.flatMap((voice) => ids.map((id) => ({ id, voice })));
  // A process-exclusive lock avoids lost manifest updates. Resume is the default.
  await mkdir(assetRoot(), { recursive: true });
  let lock:
    Awaited<ReturnType<typeof import("node:fs/promises").open>> | undefined;
  if (!dry) {
    const fs = await import("node:fs/promises");
    lock = await fs
      .open(path.join(assetRoot(), ".prepare.lock"), "wx")
      .catch(() => {
        throw new Error(
          "Another preparation is active. Remove .prepare.lock only after confirming it stopped.",
        );
      });
  }
  let failed = 0;
  try {
    const worker = async () => {
      while (jobs.length) {
        const { id, voice } = jobs.shift()!;
        const expected = expectedAsset(id, voice);
        const old = results.get(expected.key);
        if (old) {
          try {
            await assetBytes(old);
            console.log("REUSE", id, voice);
            continue;
          } catch {}
        }
        console.log(
          dry ? "NEEDED" : "GENERATE",
          id,
          voice,
          expected.key.slice(0, 12),
        );
        if (dry) continue;
        let saved = false;
        for (let attempt = 0; attempt < 3 && !saved; attempt++) {
          try {
            const stream = await cartesiaSpeech(
              quickResponseById.get(id)!.responseText,
              "en-US",
              voice,
            );
            const bytes = Buffer.from(await new Response(stream).arrayBuffer());
            if (!validWav(bytes)) throw new Error("Invalid WAV");
            const asset: AudioAsset = {
              ...expected,
              bytes: bytes.length,
              sha256: digest(bytes),
            };
            const tmp = path.join(
              assetRoot(),
              expected.key + "." + randomUUID() + ".tmp",
            );
            await writeFile(tmp, bytes);
            await rename(tmp, path.join(assetRoot(), expected.key + ".wav"));
            results.set(asset.key, asset);
            // Checkpoint serially on the JS event loop, using a separate write chain below.
            await saveManifest();
            saved = true;
          } catch {
            if (attempt < 2)
              await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }
        if (!saved) {
          failed++;
          console.error("FAILED", id, voice);
        }
      }
    };
    let writes = Promise.resolve();
    function saveManifest() {
      writes = writes.then(async () => {
        const tmp = path.join(assetRoot(), "manifest." + randomUUID() + ".tmp");
        await writeFile(
          tmp,
          JSON.stringify(
            { version: 1, assets: [...results.values()] },
            null,
            2,
          ),
        );
        await rename(tmp, path.join(assetRoot(), "manifest.json"));
      });
      return writes;
    }
    const concurrency = Math.max(
      1,
      Math.min(3, Number(value("--concurrency")) || 2),
    );
    await Promise.all(Array.from({ length: concurrency }, worker));
    if (!dry)
      await writeFile(
        path.join(assetRoot(), "library-index.json"),
        JSON.stringify(indexedLibrary([...results.values()]), null, 2),
      );
    if (failed) throw new Error(`${failed} asset(s) failed; rerun to resume.`);
  } finally {
    if (lock) {
      await lock.close();
      const fs = await import("node:fs/promises");
      await fs.unlink(path.join(assetRoot(), ".prepare.lock"));
    }
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
