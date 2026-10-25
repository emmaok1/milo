/** Live paired provider benchmark using fictional messages only. */
import { loadEnvConfig } from "@next/env";
import { writeFile } from "node:fs/promises";
import { ai, claudeThinking, instructions } from "../src/lib/ai";
import { voicePrompt } from "../src/lib/voice";
import { companionPolicy } from "../src/lib/companion-policy";
import type Anthropic from "@anthropic-ai/sdk";
loadEnvConfig(process.cwd());
const model = process.env.ANTHROPIC_CHAT_MODEL || "claude-sonnet-5-5";
const after = instructions + companionPolicy + "\n" + voicePrompt("en-US") + companionPolicy;
const before = after.split(companionPolicy).join("").replace(" The repeated-tiredness English response is an explicit exception.", "");
const cases: { name: string; messages: Anthropic.MessageParam[] }[] = [
  { name: "ordinary", messages: [{ role: "user", content: "I watched a movie after work today." }] },
  { name: "tired-en", messages: [{ role: "user", content: "I'm tired." }, { role: "assistant", content: "What has today been like?" }, { role: "user", content: "I'm just exhausted." }] },
  { name: "tired-zh", messages: [{ role: "user", content: "今天好累。" }, { role: "assistant", content: "What has today been like?" }, { role: "user", content: "就是累了。" }] },
];
type Row = { name: string; variant: string; round: number; firstTextMs?: number; totalMs?: number; searches?: string[]; reply?: string; stop?: string | null; usage?: unknown; error?: string };
const rows: Row[] = [];
async function run(c: typeof cases[number], variant: string, round: number) {
  const start = performance.now(); let first: number | null = null; let reply = ""; const searches: string[] = [];
  try {
    const stream = ai().messages.stream({ model, max_tokens: 300, thinking: claudeThinking(model), system: variant === "before" ? before : after, messages: c.messages,
      ...(variant === "after" ? { tools: [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 1 }] } : {}),
    });
    for await (const event of stream) {
      if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") searches.push(event.content_block.name);
      if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) { first ??= performance.now() - start; reply += event.delta.text; }
    }
    const result = await stream.finalMessage();
    const row = { name: c.name, variant, round, firstTextMs: Math.round(first || 0), totalMs: Math.round(performance.now() - start), searches, reply, stop: result.stop_reason, usage: result.usage };
    rows.push(row); console.log(JSON.stringify(row));
  } catch (e) { rows.push({ name: c.name, variant, round, error: e instanceof Error ? e.message : String(e) }); console.log(JSON.stringify(rows.at(-1))); }
}
async function main() {
for (let round = 0; round < 3; round++) {
  for (const c of cases) {
    for (const variant of round % 2 ? ["after", "before"] : ["before", "after"]) await run(c, variant, round);
  }
}
function median(values: number[]) { const a = values.sort((a,b) => a-b); return a.length % 2 ? a[Math.floor(a.length/2)] : (a[a.length/2-1]+a[a.length/2])/2; }
const summary = Object.fromEntries(["before", "after"].map(v => { const r = rows.filter(r => r.variant === v && !r.error); return [v, { count: r.length, firstTextMedianMs: median(r.map(r => r.firstTextMs!)), totalMedianMs: median(r.map(r => r.totalMs!)), searches: r.reduce((s,r)=>s+r.searches!.length,0) }]; }));
await writeFile("artifacts/companion-latency-validation.json", JSON.stringify({ model, scope: "Provider text streaming only; excludes STT, TTS, database, browser and playback. Reconstructed previous prompt, alternating paired order, three rounds.", summary, rows }, null, 2));
console.log(JSON.stringify({ summary }));

}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
