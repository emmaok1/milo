import { z } from "zod";
export const memoryPreviewChange = z.discriminatedUnion("action", [
  z.object({action:z.literal("access"),allowed:z.boolean()}).strict(),
  z.object({action:z.literal("sharing"),shared:z.boolean()}).strict(),
]);
export type MemoryPreview = {
  hasKey?:boolean;
  keyRequired?:boolean;
  unlocked?:boolean;
  userId:string;
  allowed:boolean;
  shared:boolean;
  privateMemories:string[];
  publicMemory:string;
};
export const memoryPreviewSamples = {
 privateMemories:["I prefer listening over advice.","Dinner feels easier with company."],
 publicMemory:"A little company made today feel easier.",
};
