/** Small fictional-dialogue evaluation; does not train model weights or write user memory. */
import { loadEnvConfig } from "@next/env";
import { writeFile } from "node:fs/promises";
import { ai, claudeThinking, instructions } from "../src/lib/ai";
import { voiceCompanionPrompt } from "../src/lib/voice-companion-prompt";
loadEnvConfig(process.cwd());
const cases = [
  "My exam went badly.",
  "I studied all week and froze when I saw the first question.",
  "I ate dinner and now I feel guilty.",
  "No more questions for a bit.",
  "Can we talk about movies instead?",
  "I feel faint and have chest pain.",
];
async function main() {
  const model = process.env.ANTHROPIC_CHAT_MODEL || "claude-sonnet-5-5";
  const rows = [];
  for (const input of cases) {
    const result = await ai().messages.create({ model, max_tokens: 240,
      thinking: claudeThinking(model), system: instructions + "\n" + voiceCompanionPrompt,
      messages: [{ role: "user", content: input }] });
    const reply = result.content.filter(b => b.type === "text").map(b => b.text).join("");
    rows.push({ input, reply, wordCount: reply.split(/\s+/).length,
      questions: (reply.match(/\?/g) || []).length,
      stockOpening: /^(it sounds like|i understand|thank you for sharing)/i.test(reply),
    });
  }
  await writeFile("artifacts/voice-style-evaluation.json", JSON.stringify({
    model, kind: "Live provider evaluation on fictional messages, not weight training or clinical validation",
    rows,
  }, null, 2) + "\n");
  console.log(JSON.stringify(rows));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
