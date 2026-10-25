import type { MobileState } from "./listener-model";
export type Kind =
  | "profile"
  | "conversation"
  | "message"
  | "plan"
  | "task"
  | "checkin"
  | "revision"
  | "memory_link"
  | "job"
  | "favorite"
  | "access_event"
  | "deletion_job";
export type RecordData = Record<string, unknown>;
export type Item = {
  id: string;
  user_id: string;
  kind: Kind;
  parent_id: string | null;
  data: RecordData;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Profile = {
  memoryPreview?: { allowed: boolean; shared: boolean };
  avatar?: string | null;
  mobile?: MobileState;
  nickname: string;
  companion: string;
  preference: string;
  length: string;
  timezone: string;
  memoryMode: string;
  onboarded: boolean;
  permissionVersion: number;
  status: string;
  reflectionAI: boolean;
  reflectionMemory: boolean;
};
export const defaultProfile: Profile = {
  nickname: "Alex",
  companion: "black_cat",
  preference: "Listen first",
  length: "Adaptive",
  timezone: "America/Los_Angeles",
  memoryMode: "automatic",
  onboarded: false,
  permissionVersion: 1,
  status: "active",
  reflectionAI: false,
  reflectionMemory: false,
};
export const statuses = [
  "Not started",
  "Tried",
  "Completed",
  "Adjusted",
  "Paused",
];
export const messages = [
  "You can take this at your own pace.",
  "A small step is still worth making room for.",
  "You don’t have to make today look like yesterday.",
  "It’s okay to change what you need.",
];
export function localDate(timezone: string, date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function datePlus(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
