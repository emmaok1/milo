import type { Listener } from "./listener-model";
export const characterIds = ["black_cat", "white_cat"] as const;
export type CharacterId = (typeof characterIds)[number];
export const characters = [
  { id: "black_cat", name: "Mochi", label: "Black cat", description: "A soft black cat with a warm male voice.", traits: ["Gentle", "Patient"] },
  { id: "white_cat", name: "Luna", label: "White cat", description: "A white cat with pink details and a warm female voice.", traits: ["Gentle", "Patient"] },
] as const;
/** Legacy appearances map to a cat without changing existing names or records. */
export function characterId(value: string | Listener): CharacterId {
  if (typeof value === "string") return ["white_cat", "white", "female"].includes(value) ? "white_cat" : "black_cat";
  const legacy = value as { color?: string; kind?: string };
  return legacy.color === "white" || (!legacy.color && legacy.kind === "female") ? "white_cat" : "black_cat";
}
export function characterPreset(id: string, address = "friend"): Listener {
  const c = characters.find(c => c.id === characterId(id))!;
  return { kind: "pet", pet: "cat", color: c.id === "white_cat" ? "white" : "black", language: "en-US", name: c.name, address: address.trim().slice(0, 24) || "friend", traits: [...c.traits] };
}
const catPrompt = "You are a fictional talking cat with a soft, natural human-like speaking voice. Be attentive, warm and unhurried. Follow the user's selected communication styles. Avoid squeaky baby talk, constant animal sounds, stage directions and claiming to be the user's real pet. During urgent danger drop playful sounds and speak directly. Do not pressure the user to stay or encourage exclusive attachment.";
export const characterPrompts: Record<CharacterId, string> = {
  black_cat: "Appearance: a soft black cat. Voice identity: warm masculine voice. " + catPrompt,
  white_cat: "Appearance: a soft white cat with pink accessories. Voice identity: warm feminine voice. " + catPrompt,
};
