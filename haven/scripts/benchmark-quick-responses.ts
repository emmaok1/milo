import { mkdir, writeFile } from "node:fs/promises";
import { quickResponses } from "../src/lib/quick-responses/library";
import { routeQuickResponse } from "../src/lib/quick-responses/router";
async function main() {
  const samples = quickResponses.map((r) => ({
    text: r.exampleUtterances[0],
    history:
      r.id === "049" ? [{ role: "assistant", text: "What happened?" }] : [],
  }));
  const times: number[] = [];
  const counts: Record<string, number> = {};
  for (let i = 0; i < 500; i++)
    for (const sample of samples) {
      const start = performance.now();
      const d = routeQuickResponse(sample.text, {
        history: sample.history,
        language: "en-US",
      });
      times.push(performance.now() - start);
      if (i === 0) counts[d.path] = (counts[d.path] || 0) + 1;
    }
  times.sort((a, b) => a - b);
  const result = {
    measuredAt: new Date().toISOString(),
    turns: times.length,
    representativeEntries: 100,
    routerP50Ms: times[Math.floor(times.length * 0.5)],
    routerP95Ms: times[Math.floor(times.length * 0.95)],
    firstPassPaths: counts,
    note: "Local deterministic router only; no network, recognition, asset loading, or playback included.",
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/voice-router-benchmark.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
}
void main();
