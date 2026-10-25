/** User-authored fictional demo memories. Never mix these into global prompts. */
export const mayaDemoBatch = "maya-fictional-2026-v1";
export const mayaDemoMemories = [
  {
    key: "breakup",
    date: "2026-10-09",
    title: "Breakup, body image, and difficult evenings",
    text: `On October 9, 2026, Maya’s boyfriend Ethan ended their relationship after eight months. Maya remembers him saying, “I don’t think we’re right for each other.” He did not mention her appearance, but she began wondering whether her body was the reason. She said that looking at their old photos on Instagram made those thoughts stronger. That evening, she described eating while crying and feeling unable to stop, followed by shame. She does not want reassurance about whether Ethan still finds her attractive. She prefers someone to listen without judging.`,
    query: "I looked at his Instagram again.",
    expected: ["Ethan", "Instagram"],
  },
  {
    key: "midterm",
    date: "2026-10-16",
    title: "An exam result and the thought “I ruined everything”",
    text: `On October 16, 2026, Maya received a 58 on her computer science midterm after studying for several evenings. She saw the result at 6:20 PM while sitting alone in the library. Her first thought was, “I worked so hard and still failed.” She later described an episode of eating that felt out of control and said she was looking for a break from thinking about the grade. She felt worse when she began calling herself “lazy.” She said a helpful response would separate the disappointing exam result from judgments about her worth.`,
    query: "Another grade came out. I ruined everything.",
    expected: ["58", "library"],
  },
  {
    key: "family-call",
    date: "2026-10-18",
    title: "A family comment during a video call",
    text: `On October 18, 2026, during a Sunday video call, Maya’s mother said, “Your face looks rounder on camera.” Maya laughed and changed the subject, but later said the comment stayed with her throughout dinner. She described feeling watched even though she was eating alone. Her friend Nina helped by saying, “You don’t have to explain your body to anyone.” Maya said she appreciated that Nina did not comment on her weight or appearance in return.`,
    query: "My mom wants to video call tonight. I’m dreading it.",
    expected: ["mother", "rounder"],
  },
  {
    key: "canceled-dinner",
    date: "2026-10-21",
    title: "A canceled dinner and feeling forgotten",
    text: `On October 21, 2026, Maya planned to have dinner with Nina at 7 PM. Nina canceled at 6:45 PM because she had to finish a lab assignment. Maya understood the reason but still felt forgotten. She said that eating alone that night brought back the loneliness she had felt since the breakup. She described eating as a way to fill the evening and then feeling ashamed. She wants people to understand that canceled plans can hurt even when she knows they are not a rejection.`,
    query: "Nina canceled again. It’s fine.",
    expected: ["6:45", "Nina"],
  },
  {
    key: "helpful-company",
    date: "2026-10-22",
    title: "A specific kind of support that felt helpful",
    text: `On October 22, 2026, Maya asked Nina to stay on a video call while she ate dinner. They talked about Nina’s orange cat, Pumpkin, who had knocked a plant off a windowsill. Maya said the ordinary conversation helped her feel less alone. She appreciated that Nina did not watch her plate, ask how much she had eaten, or check whether she had finished. Maya said she would like to be offered that kind of company again, but wants to choose each time.`,
    query: "Dinner feels hard. I don’t want advice.",
    expected: ["Pumpkin", "plate"],
  },
] as const;
export function mayaDemoText(entry: (typeof mayaDemoMemories)[number]) {
  return `Fictional demo · Maya. This is a user-supplied fictional role-play history for a presentation, not verified personal history about the account owner. In this demo, first-person references may refer to Maya; if the connection is unclear, confirm briefly rather than assuming.\n${entry.title}\n${entry.text}`;
}
