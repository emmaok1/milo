/** Fictional rehearsal; injects fixture memories, never writes account history. */
import { loadEnvConfig } from "@next/env";
import { writeFile } from "node:fs/promises";
import { streamChat } from "../src/lib/ai";
import { voiceSystem } from "../src/lib/voice-generation";
import { defaultProfile } from "../src/lib/types";
import { preferencesFor, type ContextTurn } from "../src/lib/voice-context";
import { retrieveKnowledge } from "../src/lib/knowledge";
import { mayaDemoMemories, mayaDemoText } from "./fixtures/maya-memories";
import type Anthropic from "@anthropic-ai/sdk";
loadEnvConfig(process.cwd());
const lines = [
  "Milo… I kind of want to make myself throw up.",
  "I ate so much. Like… all these high-calorie things. I wasn't even enjoying it. I just couldn't stop.",
  "I kept thinking about that midterm grade. Everyone else seems fine, and I'm just… stuck. So I kept eating. And now I feel worse.",
  "I don't really want to be alone. But I don't want someone asking what I ate.",
  "Yeah… Nina helped last time. I just don't know what to say. I don't want to make it a whole thing. Could you help me text her?",
  "Could you make it sound a little more like me? Less… formal?",
  "Yeah. That sounds like me. I can send that.",
];
async function main() {
  const messages: Anthropic.MessageParam[] = [], history: ContextTurn[] = [];
  const rows = [];
  const memories = mayaDemoMemories.filter(m=>["midterm", "helpful-company"].includes(m.key)).map(m=>({text:mayaDemoText(m)}));
  for (const input of lines) {
    history.push({role:"user",text:input}); messages.push({role:"user",content:input});
    const system = voiceSystem({...defaultProfile,nickname:"Maya"}, "open", "en-US", preferencesFor(history), memories, retrieveKnowledge(input));
    const start=performance.now();let first=0,reply="";
    for await (const delta of streamChat(system,messages)) { if(!first) first=performance.now()-start;reply+=delta; }
    messages.push({role:"assistant",content:reply});history.push({role:"assistant",text:reply});
    const row={input,reply,firstTextMs:Math.round(first),totalMs:Math.round(performance.now()-start)};
    rows.push(row);console.log(JSON.stringify(row));
  }
  await writeFile("artifacts/meal-demo-rehearsal.json",JSON.stringify({model:process.env.ANTHROPIC_CHAT_MODEL||"claude-sonnet-5-5",scope:"Live voice prompt generation with injected fictional fixture memories; not a retrieval, speech or UI test",rows},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
