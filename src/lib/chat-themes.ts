import { z } from "zod";

export const chatThemeSchema = z.enum(["cloud", "night", "garden"]);
export const chatModeSchema = z.enum(["day", "night"]);
export type ChatMode = z.infer<typeof chatModeSchema>;
export type ChatTheme = z.infer<typeof chatThemeSchema>;
export const chatThemes: { id: ChatTheme; name: string; description: string }[] = [
  { id: "cloud", name: "Cloud nest", description: "Soft clouds, a little daydream." },
  { id: "night", name: "Window nook", description: "A window to your little world." },
  { id: "garden", name: "Little garden", description: "A gentle corner of green." },
];
