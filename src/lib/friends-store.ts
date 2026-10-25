import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { AppError, profile, type Context } from "./store";
import {
  friendGroup,
  inviteUsable,
  MAX_FRIEND_MEMBERS,
  type FriendGroup,
  type FriendsSnapshot,
} from "./friends-model";
import {
  dailyReady,
  createMealVideo,
  mealVideoToken,
  ejectMeal,
} from "./daily-video";
type Row = {
  id: string;
  user_id: string;
  data: Record<string, unknown>;
  version: number;
  created_at: string;
};
export const friendId = (scope: string, user: string) => {
  const h = createHash("sha256")
    .update("haven-friends-v1:" + scope + ":" + user)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export const invitationHash = (code: string) =>
  createHash("sha256").update(code).digest("hex");
export function friendsAdmin() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new AppError(503, "Friends is temporarily unavailable.");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
/** Only this narrow server gateway reads shared access_event rows. Every operation rechecks authoritative membership. */
export class FriendsStore {
  constructor(
    private c: Context,
    private db: SupabaseClient = friendsAdmin(),
  ) {
    if (c.demo) throw new AppError(503, "Sign in to invite friends.");
  }
  private async row(id: string, type: string) {
    const r = await this.db
      .from("records")
      .select("id,user_id,data,version,created_at")
      .eq("id", id)
      .eq("kind", "access_event")
      .contains("data", { type })
      .maybeSingle();
    if (r.error) throw new AppError(503, "Friends is temporarily unavailable.");
    return r.data as Row | null;
  }
  private async insert(
    id: string,
    owner: string,
    data: Record<string, unknown>,
  ) {
    const r = await this.db
      .from("records")
      .insert({ id, user_id: owner, kind: "access_event", data, version: 1 })
      .select("id,user_id,data,version,created_at")
      .single();
    if (r.error)
      throw new AppError(
        r.error.code === "23505" ? 409 : 503,
        r.error.code === "23505"
          ? "This request was already processed."
          : "Friends could not be saved.",
      );
    return r.data as Row;
  }
  private async cas(row: Row, data: Record<string, unknown>) {
    const r = await this.db
      .from("records")
      .update({
        data,
        version: row.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", row.user_id)
      .eq("kind", "access_event")
      .eq("version", row.version)
      .select("id,user_id,data,version,created_at");
    if (r.error) throw new AppError(503, "Friends could not be saved.");
    if (!r.data?.length)
      throw new AppError(409, "This group changed. Please try again.");
    return r.data[0] as Row;
  }
  private async ownerActive(id: string) {
    const p = await this.db
      .from("records")
      .select("data")
      .eq("kind", "profile")
      .eq("user_id", id)
      .maybeSingle();
    if (
      p.error ||
      ["deleted", "revoked"].includes(String(p.data?.data?.status))
    )
      throw new AppError(404, "This group is no longer available.");
  }
  private async membership() {
    const row = await this.row(
      friendId("membership", this.c.userId),
      "friends_membership",
    );
    if (row && row.user_id !== this.c.userId)
      throw new AppError(404, "Group not found.");
    return row;
  }
  async group(required = true) {
    const membership = await this.membership();
    const row = membership
      ? await this.row(String(membership.data.groupId), "friends_group")
      : null;
    if (!row) {
      if (required) throw new AppError(404, "Join or create a group first.");
      return null;
    }
    const data = friendGroup.parse(row.data);
    if (data.closed || !data.members.some((m) => m.id === this.c.userId)) {
      if (required)
        throw new AppError(403, "You no longer belong to this group.");
      return null;
    }
    if (row.user_id !== data.ownerId)
      throw new AppError(404, "Group not found.");
    try {
      await this.ownerActive(data.ownerId);
    } catch (e) {
      if (!required) return null;
      throw e;
    }
    return { row, data };
  }
  private async ensure() {
    const existing = await this.group(false);
    if (existing) return existing;
    const p = await profile(this.c);
    const id = randomUUID();
    const data: FriendGroup = {
      type: "friends_group",
      name: "Our little space",
      ownerId: this.c.userId,
      members: [
        {
          id: this.c.userId,
          name: p.nickname,
          joinedAt: new Date().toISOString(),
        },
      ],
      closed: false,
      meal: null,
      inviteHash: null,
      inviteExpiresAt: null,
      notificationKey: randomBytes(18).toString("hex"),
    };
    const row = await this.insert(id, this.c.userId, data);
    try {
      const old = await this.membership();
      if (old) {
        await this.cas(old, { type: "friends_membership", groupId: id });
      } else
        await this.insert(
          friendId("membership", this.c.userId),
          this.c.userId,
          { type: "friends_membership", groupId: id },
        );
    } catch (e) {
      await this.db
        .from("records")
        .delete()
        .eq("id", row.id)
        .eq("user_id", this.c.userId);
      throw e;
    }
    return { row, data };
  }
  private async mutate(change: (data: FriendGroup) => FriendGroup) {
    for (let n = 0; n < 4; n++) {
      const g = await this.group();
      try {
        const next = change(g!.data);
        return { row: await this.cas(g!.row, next), data: next };
      } catch (e) {
        if (!(e instanceof AppError) || e.status !== 409 || n === 3) throw e;
      }
    }
    throw new AppError(409, "This group changed. Please try again.");
  }
  async snapshot(): Promise<FriendsSnapshot> {
    const g = await this.group(false);
    if (!g)
      return {
        userId: this.c.userId,
        group: null,
        messages: [],
        videoReady: dailyReady(),
      };
    const r = await this.db
      .from("records")
      .select("id,user_id,data,created_at")
      .eq("kind", "access_event")
      .contains("data", { type: "friends_message", groupId: g.row.id })
      .in(
        "user_id",
        g.data.members.map((m) => m.id),
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (r.error) throw new AppError(503, "Messages could not load.");
    return {
      userId: this.c.userId,
      group: {
        id: g.row.id,
        ownerId: g.data.ownerId,
        name: g.data.name,
        members: g.data.members,
        meal:
          g.data.meal && Date.parse(g.data.meal.expiresAt) > Date.now()
            ? g.data.meal
            : null,
        notificationKey: g.data.notificationKey,
      },
      messages: (r.data || []).reverse().map((r) => ({
        id: r.id,
        senderId: r.user_id,
        name: g.data.members.find((m) => m.id === r.user_id)?.name || "Member",
        text: String(r.data.text),
        createdAt: r.created_at,
        kind: r.data.messageKind as "moment" | "pat" | undefined,
        images: r.data.images as string[] | undefined,
      })),
      videoReady: dailyReady(),
    };
  }
  async invite() {
    await this.ensure();
    const code = randomBytes(18).toString("base64url"),
      expiresAt = new Date(Date.now() + 86400000).toISOString();
    await this.mutate((d) => {
      if (d.members.length >= MAX_FRIEND_MEMBERS)
        throw new AppError(409, "This group is full.");
      return {
        ...d,
        inviteHash: invitationHash(code),
        inviteExpiresAt: expiresAt,
      };
    });
    return { code, expiresAt };
  }
  async revoke() {
    await this.mutate((d) => {
      if(d.ownerId !== this.c.userId) throw new AppError(403, "Only the host can revoke invitations.");
      return { ...d, inviteHash: null, inviteExpiresAt: null };
    });
  }
  async preview(code: string) {
    const hash = invitationHash(code);
    const r = await this.db
      .from("records")
      .select("id,user_id,data,version,created_at")
      .eq("kind", "access_event")
      .contains("data", { type: "friends_group", inviteHash: hash })
      .limit(1);
    if (r.error) throw new AppError(503, "Invitation could not load.");
    const row = r.data?.[0] as Row | undefined;
    if (!row) throw new AppError(404, "This invitation is invalid or expired.");
    const data = friendGroup.parse(row.data);
    if (!inviteUsable(data, hash) || data.members.length >= MAX_FRIEND_MEMBERS)
      throw new AppError(404, "This invitation is invalid, expired or full.");
    await this.ownerActive(data.ownerId);
    return {
      row,
      data,
      inviter:
        data.members.find((m) => m.id === data.ownerId)?.name || "Your friend",
    };
  }
  async join(code: string) {
    const target = await this.preview(code);
    const current = await this.group(false);
    if (current) {
      if (current.row.id === target.row.id) return;
      throw new AppError(
        409,
        "Leave your current group before joining another.",
      );
    }
    const p = await profile(this.c),
      id = friendId("membership", this.c.userId);
    let membership = await this.membership();
    if (membership)
      membership = await this.cas(membership, {
        type: "friends_membership",
        groupId: target.row.id,
      });
    else
      membership = await this.insert(id, this.c.userId, {
        type: "friends_membership",
        groupId: target.row.id,
      });
    try {
      for (let n = 0; n < 4; n++) {
        const fresh = await this.row(target.row.id, "friends_group");
        if (!fresh) throw new AppError(404, "Invitation no longer exists.");
        const d = friendGroup.parse(fresh.data);
        if (d.members.some((m) => m.id === this.c.userId)) return;
        if (
          !inviteUsable(d, invitationHash(code)) ||
          d.members.length >= MAX_FRIEND_MEMBERS
        )
          throw new AppError(
            409,
            "This invitation has expired or the group is full.",
          );
        try {
          await this.cas(fresh, {
            ...d,
            members: [
              ...d.members,
              {
                id: this.c.userId,
                name: p.nickname,
                joinedAt: new Date().toISOString(),
              },
            ],
          });
          return;
        } catch (e) {
          if (!(e instanceof AppError) || e.status !== 409 || n === 3) throw e;
        }
      }
    } catch (e) {
      await this.db
        .from("records")
        .delete()
        .eq("id", membership.id)
        .eq("user_id", this.c.userId)
        .eq("version", membership.version);
      throw e;
    }
  }
  async open() {
    await this.ensure();
  }
  async send(text: string, requestId: string, kind?: "moment", images: string[] = []) {
    const g = await this.group();
    const id = friendId("message", this.c.userId + ":" + requestId);
    const existing = await this.row(id, "friends_message");
    if (existing) {
      if (
        existing.user_id !== this.c.userId ||
        existing.data.groupId !== g!.row.id ||
        existing.data.text !== text ||
        existing.data.messageKind !== kind || JSON.stringify(existing.data.images || []) !== JSON.stringify(images)
      )
        throw new AppError(409, "This message changed. Please resend.");
      return;
    }
    const p = await profile(this.c);
    await this.insert(id, this.c.userId, {
      type: "friends_message",
      groupId: g!.row.id,
      text,
      ...(kind ? {messageKind: kind} : {}),
      images,
      name: p.nickname,
    });
  }
  async setStatus(status: "good" | "hard" | "company" | "break") {
    await this.mutate(d => ({ ...d, members: d.members.map(m => m.id === this.c.userId ? { ...m, status } : m) }));
  }
  async pat(targetId: string) {
    const g = await this.group();
    const target = g!.data.members.find(m => m.id === targetId);
    const sender = g!.data.members.find(m => m.id === this.c.userId)!;
    if (!target || targetId === this.c.userId) throw new AppError(400, "Choose a friend to comfort.");
    await this.insert(randomUUID(), this.c.userId, {
      type: "friends_message", groupId: g!.row.id, messageKind: "pat",
      text: `${sender.name} patted ${target.name} — here with you.`,
    });
  }
  async startMeal() {
    await this.ensure();
    const g = await this.group();
    if (g!.data.meal && Date.parse(g!.data.meal.expiresAt) > Date.now()) return;
    const id = randomUUID(),
      expiresAt = new Date(Date.now() + 7200000).toISOString();
    const video = dailyReady()
      ? await createMealVideo(id, Math.floor(Date.parse(expiresAt) / 1000))
      : {};
    await this.mutate((d) => {
      if (d.meal && Date.parse(d.meal.expiresAt) > Date.now()) return d;
      return {
        ...d,
        meal: {
          id,
          createdBy: this.c.userId,
          startedAt: new Date().toISOString(),
          expiresAt,
          checkedIn: [],
          ...video,
        },
      };
    });
  }
  async checkIn(mealId: string) {
    await this.mutate((d) => {
      if (
        !d.meal ||
        d.meal.id !== mealId ||
        Date.parse(d.meal.expiresAt) <= Date.now()
      )
        throw new AppError(409, "This meal has ended.");
      return {
        ...d,
        meal: {
          ...d.meal,
          checkedIn: [...new Set([...d.meal.checkedIn, this.c.userId])],
        },
      };
    });
  }
  async video(mealId: string) {
    const g = await this.group();
    const m = g!.data.meal;
    if (
      !m ||
      m.id !== mealId ||
      Date.parse(m.expiresAt) <= Date.now() ||
      !m.checkedIn.includes(this.c.userId)
    )
      throw new AppError(403, "Check in to the active meal first.");
    if (!m.roomName || !m.roomUrl)
      throw new AppError(503, "Video isn't available yet.");
    const member = g!.data.members.find((m) => m.id === this.c.userId)!;
    return {
      url: m.roomUrl,
      token: await mealVideoToken(m.roomName, this.c.userId, member.name),
      mealId,
    };
  }
  async leaveMeal(mealId: string) {
    await this.mutate((d) => {
      if (!d.meal || d.meal.id !== mealId) return d;
      return {
        ...d,
        meal: {
          ...d.meal,
          checkedIn: d.meal.checkedIn.filter((id) => id !== this.c.userId),
        },
      };
    });
  }
  async endMeal() {
    const g = await this.group();
    if (
      g!.data.ownerId !== this.c.userId &&
      g!.data.meal?.createdBy !== this.c.userId
    )
      throw new AppError(403, "Only the host can end this meal.");
    if (g!.data.meal?.roomName)
      await ejectMeal(
        g!.data.meal.roomName,
        g!.data.members.map((m) => m.id),
      );
    await this.mutate((d) => ({ ...d, meal: null }));
  }
  async leave() {
    const g = await this.group();
    if (g!.data.meal?.roomName)
      await ejectMeal(
        g!.data.meal.roomName,
        g!.data.ownerId === this.c.userId
          ? g!.data.members.map((m) => m.id)
          : [this.c.userId],
      );
    await this.mutate((d) => ({
      ...d,
      members: d.members.filter((m) => m.id !== this.c.userId),
      closed: d.ownerId === this.c.userId,
      inviteHash: d.ownerId === this.c.userId ? null : d.inviteHash,
      meal: d.ownerId === this.c.userId ? null : d.meal,
    }));
    const membership = await this.membership();
    if (membership)
      await this.db
        .from("records")
        .delete()
        .eq("id", membership.id)
        .eq("user_id", this.c.userId);
  }
  async notification() {
    const g = await this.group(false);
    return g?.data.notificationKey;
  }
}
export async function notifyFriends(key: string) {
  const db = friendsAdmin(),
    channel = db.channel("friends-" + key);
  try {
    await channel.httpSend("changed", { changed: true }, { timeout: 1500 });
  } catch {
  } finally {
    await db.removeChannel(channel);
  }
}
