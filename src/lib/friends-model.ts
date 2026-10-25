import { z } from "zod";
export const MAX_FRIEND_MEMBERS = 6;
export const inviteCode = z.string().regex(/^[A-Za-z0-9_-]{24}$/);
export const friendMember = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(40),
  joinedAt: z.iso.datetime(),
  status: z.enum(["good", "hard", "company", "break"]).optional(),
});
export const mealSchema = z.object({
  id: z.uuid(),
  createdBy: z.uuid(),
  startedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  checkedIn: z.array(z.uuid()).max(MAX_FRIEND_MEMBERS),
  roomName: z.string().optional(),
  roomUrl: z.url().optional(),
});
export const friendGroup = z.object({
  type: z.literal("friends_group"),
  name: z.literal("Our little space"),
  ownerId: z.uuid(),
  members: z.array(friendMember).max(MAX_FRIEND_MEMBERS),
  closed: z.boolean(),
  meal: mealSchema.nullable(),
  inviteHash: z.string().nullable(),
  inviteExpiresAt: z.iso.datetime().nullable(),
  notificationKey: z.string(),
});
export type FriendGroup = z.infer<typeof friendGroup>;
export type FriendMessage = {
  id: string;
  senderId: string;
  name: string;
  text: string;
  createdAt: string;
  kind?: "moment" | "pat";
  images?: string[];
};
export type FriendsSnapshot = {
  userId: string;
  group: null | {
    id: string;
    ownerId: string;
    name: string;
    members: FriendGroup["members"];
    meal: FriendGroup["meal"];
    notificationKey: string;
  };
  messages: FriendMessage[];
  videoReady: boolean;
};
export function extractInvite(value: string) {
  const text = value.trim();
  const raw = text.includes("#invite=")
    ? text.split("#invite=")[1].split("&")[0]
    : text;
  return inviteCode.parse(raw);
}
export function inviteUsable(
  group: FriendGroup,
  hash: string,
  now = Date.now(),
) {
  return (
    !group.closed &&
    group.inviteHash === hash &&
    !!group.inviteExpiresAt &&
    Date.parse(group.inviteExpiresAt) > now
  );
}

export const momentImage = z.string().max(220000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/);
export const friendStatus = z.enum(["good", "hard", "company", "break"]);
export const statusLabels = { good: "Feeling good", hard: "Having a hard day", company: "Need company", break: "Taking a break" } as const;
export function privateInvite(value: string, origin: string) {
  const url = new URL(value);
  if (url.origin !== origin || url.pathname !== "/friends") throw new Error("Please use a private invitation link from this app.");
  return inviteCode.parse(new URLSearchParams(url.hash.slice(1)).get("invite"));
}
