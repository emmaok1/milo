import { contextualVoiceDecision, preferencesFor, type ContextTurn } from "./voice-context";

export const tiredComfort = "You don’t have to figure everything out right now.";
export const tiredMusicReply = `${tiredComfort} Would you like to listen to some music?`;

// Deliberately accept short, unambiguous self-reports only. Complex messages
// (including negation, other people, questions and new requests) stay with Claude.
function isTired(text: string) {
  const t = text.toLowerCase().replace(/[’‘]/g, "'").trim()
    .replace(/[.!。！]+$/g, "").trim();
  return /^(?:(?:i'm|i am|i feel)\s+(?:(?:just|so|very|really|still|pretty|a bit|a little)\s+)*(?:tired|exhausted|worn out|drained)(?:\s+(?:today|again|right now))?|(?:(?:我|今天|我今天|就是|还是|真的|感觉|我感觉|有点|很|好|太|已经|实在|特别|又|也|只|是)\s*)*累(?:了|啊|呀|死了|坏了|得很|得不行)?(?:了)?)$/.test(t);
}

export function tirednessReply(input: string, history: ContextTurn[], preference = "") {
  if (!isTired(input) || !history.some(t => t.role === "user" && isTired(t.text))) return;
  if (contextualVoiceDecision(input, history).path === "safety") return;
  const p = preferencesFor([...history, { role: "user", text: input }], preference);
  const alreadyOffered = history.some(t => t.role === "assistant" &&
    t.text.replace(/[’‘]/g, "'").includes("You don't have to figure everything out right now."));
  return p.noQuestions || p.quiet || p.noAdvice || alreadyOffered
    ? tiredComfort : tiredMusicReply;
}
