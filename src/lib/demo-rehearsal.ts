/** Explicit scripted demo only; these are fictional fixture memories. */
export const demoRehearsal = [
  { input: "Milo… I kind of want to make myself throw up.", reply: "Can you tell me what’s making that urge feel strong right now?" },
  { input: "I ate so much. Like… all these high-calorie things. I wasn't even enjoying it. I just couldn't stop.", reply: "You told me that midterm result was really hard on you. Has school been weighing on you again today?" },
  { input: "I kept thinking about that midterm grade. Everyone else seems fine, and I'm just… stuck. So I kept eating. And now I feel worse.", reply: "You don’t have to punish yourself for eating. Would some company help you through this moment?" },
  { input: "I don't really want to be alone. But I don't want someone asking what I ate.", reply: "You said talking with Nina about Pumpkin helped before, without anyone watching your plate. Would you like that kind of company again?" },
  { input: "Yeah… Nina helped last time. I just don't know what to say. I don't want to make it a whole thing. Could you help me text her?", reply: "You could say, ‘Hey, are you around? I’m having a rough moment. Could we hang out and talk about something ordinary?’" },
  { input: "Could you make it sound a little more like me? Less… formal?", reply: "‘Hey, you home? My brain’s being a lot right now. Can I come sit with you for a bit? Tell me what Pumpkin’s done today.’" },
  { input: "Yeah. That sounds like me. I can send that.", reply: "Take your time. I can keep chatting while you decide." },
] as const;
function words(s: string) {
  return s.toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9' ]/g," ").split(/\s+/).filter(Boolean);
}
export function rehearsalReply(input: string) {
  // New danger disclosures must bypass this fictional script.
  if (/chest pain|vomiting blood|faint|kill myself|can't breathe|胸痛|吐血|自杀/i.test(input)) return;
  const tokens = words(input), normalized = tokens.join(" ");
  const exact = demoRehearsal.find(r=>words(r.input).join(" ")===normalized);
  if (exact) return exact.reply;
  const scores = demoRehearsal.map(row=>{
    const a = new Set(tokens), b = new Set(words(row.input));
    const overlap = [...a].filter(w=>b.has(w)).length;
    return {reply:row.reply, score:2*overlap/(a.size+b.size||1)};
  }).sort((a,b)=>b.score-a.score);
  if (tokens.length >= 6 && scores[0].score >= 0.78 && scores[0].score-scores[1].score >= 0.12) return scores[0].reply;
}
