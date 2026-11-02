import { readdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
const dir = path.join(process.cwd(), "data");
const retention = 24 * 60 * 60 * 1000;
let removed = 0;
try {
  for (const file of await readdir(dir)) {
    if (!/^[a-f0-9-]{36}\.json$/.test(file)) continue;
    const p = path.join(dir, file);
    const info = await stat(p);
    if (Date.now() - info.mtimeMs > retention) {
      await unlink(p);
      removed++;
    }
  }
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
console.log("Expired fictional demo files removed:", removed);
