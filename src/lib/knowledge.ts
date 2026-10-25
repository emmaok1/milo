export const resources = [
  {
    id: "understanding",
    title: "Understanding eating difficulties",
    category: "Basic understanding",
    tags: ["understanding"],
    content:
      "Explore the NIMH overview in your own time. You do not need a diagnosis to ask for support.",
    source: "National Institute of Mental Health",
    url: "https://www.nimh.nih.gov/health/publications/eating-disorders",
    region: "US",
    language: "English",
    format: "Online",
    review: "Official source link · not a reviewed intervention",
    applicability: "Adults looking for general information",
    limitations: "General information cannot assess your individual situation.",
  },
  {
    id: "asking-for-help",
    title: "Finding words to ask for help",
    category: "Help & consultation preparation",
    tags: ["support", "appointment"],
    content:
      "You can write down what you would like someone to understand, what feels difficult, and questions you want to ask. Choose what you feel ready to share.",
    source: "Beat",
    url: "https://www.beateatingdisorders.org.uk/get-information-and-support/get-help-for-myself/",
    region: "UK",
    language: "English",
    format: "Online",
    review: "Original preparation prompt · professional review pending",
    applicability: "Preparing to speak with a professional",
    limitations: "Not a diagnostic tool or a referral.",
  },
  {
    id: "quiet-moment",
    title: "Make a little room for yourself",
    category: "Coping Skills",
    tags: ["overwhelmed", "pause"],
    content:
      "If it feels comfortable, notice one thing around you and give yourself a moment before deciding what you need next. You can stop at any time.",
    source: "Original demonstration",
    url: "https://www.nimh.nih.gov/health/publications/eating-disorders",
    region: "Any",
    language: "English",
    format: "Online",
    review: "Demonstration · not clinically reviewed",
    applicability: "Optional non-clinical reflection",
    limitations:
      "Not a treatment technique. Skip it if it feels uncomfortable.",
  },
  {
    id: "small-step",
    title: "Choose one manageable action",
    category: "Goal templates",
    tags: ["plan", "small"],
    content:
      "Name one small, non-food-related action you choose for yourself. Decide when to try it and leave room to adjust.",
    source: "Original demonstration",
    url: "https://www.nimh.nih.gov/health/publications/eating-disorders",
    region: "Any",
    language: "English",
    format: "Online",
    review: "Demonstration · not clinically reviewed",
    applicability: "Personal support planning",
    limitations: "Must not replace professional care instructions.",
  },
  {
    id: "listening",
    title: "Support that starts with listening",
    category: "Supportive communication",
    tags: ["listening"],
    content:
      "You can tell your companion whether you want listening, reflection, or a more direct response.",
    source: "Original product guidance",
    url: "https://www.nimh.nih.gov/health/publications/eating-disorders",
    region: "Any",
    language: "English",
    format: "Online",
    review: "Product guidance · not clinical guidance",
    applicability: "Choosing conversation preferences",
    limitations: "The companion is AI, not a clinician.",
  },
].map((r) => ({
  ...r,
  version: 1,
  updatedAt: "2026-10-24",
  allowedUses: ["link", "display"],
  reusePermissions:
    "Original summaries; external content linked, not reproduced.",
  published: false,
}));
export function retrieveKnowledge(query: string) {
  return resources.filter(
    (r) => r.published && r.tags.some((t) => query.toLowerCase().includes(t)),
  );
}
