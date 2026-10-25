import { after } from "next/server";
import { z } from "zod";
import { AppError, assertOrigin, context, list, insert } from "@/lib/store";
import { FriendsStore, notifyFriends } from "@/lib/friends-store";
import { privateInvite, momentImage, friendStatus } from "@/lib/friends-model";
export const runtime = "nodejs";
const body = z.discriminatedUnion("action", [
  z.object({action: z.literal("status"), status: friendStatus}).strict(),
  z.object({action: z.literal("pat"), targetId: z.uuid()}).strict(),
  z
    .object({
      action: z.enum([
        "open",
        "invite",
        "revoke",
        "start-meal",
        "end-meal",
        "leave-group",
      ]),
    })
    .strict(),
  z.object({ action: z.enum(["preview", "join"]), link: z.string().max(500) }).strict(),
  z
    .object({
      action: z.literal("message"),
      text: z.string().trim().min(1).max(2000),
      requestId: z.uuid(),
      kind: z.literal("moment").optional(),
      images: z.array(momentImage).max(3).default([]),
    })
    .strict(),
  z
    .object({
      action: z.enum(["check-in", "video", "leave-meal"]),
      mealId: z.uuid(),
    })
    .strict(),
]);
function error(e: unknown) {
  const status =
    e instanceof AppError
      ? e.status
      : e instanceof z.ZodError || e instanceof SyntaxError
        ? 400
        : 503;
  return Response.json(
    {
      error:
        e instanceof AppError
          ? e.message
          : status === 400
            ? "Please check your request."
            : "Friends is temporarily unavailable.",
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function GET() {
  try {
    const c = await context("friends", "read");
    return Response.json(await new FriendsStore(c).snapshot(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return error(e);
  }
}
export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const c = await context("friends", "write");
    const raw = await req.text();
    if (raw.length > 680000) throw new AppError(413, "Request too large.");
    const b = body.parse(JSON.parse(raw));
    let invitation: string | undefined;
    if (b.action === "preview" || b.action === "join") {
      try { invitation = privateInvite(b.link, new URL(req.url).origin); }
      catch { throw new AppError(400, "Please use a private invitation link from this app."); }
    }
    const recent = (await list(c, "access_event")).filter(
      (r) =>
        r.data.purpose === "friends_action" &&
        Date.now() - Date.parse(r.created_at) < 60000,
    );
    if (recent.length >= 40)
      throw new AppError(429, "Please wait a moment before trying again.");
    await insert(c, "access_event", {
      purpose: "friends_action",
      operation: b.action,
      result: "accepted",
    });
    const service = new FriendsStore(c);
    let extra: Record<string, unknown> = {};
    const oldKey = await service.notification();
    switch (b.action) {
      case "status":
        await service.setStatus(b.status);
        break;
      case "pat":
        await service.pat(b.targetId);
        break;
      case "open":
        await service.open();
        break;
      case "invite":
        extra = await service.invite();
        break;
      case "revoke":
        await service.revoke();
        break;
      case "preview": {
        const p = await service.preview(invitation!);
        return Response.json(
          { inviter: p.inviter, members: p.data.members.length },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      case "join":
        await service.join(invitation!);
        break;
      case "message":
        await service.send(b.text, b.requestId, b.kind, b.images);
        break;
      case "start-meal":
        await service.startMeal();
        break;
      case "check-in":
        await service.checkIn(b.mealId);
        break;
      case "video":
        return Response.json(await service.video(b.mealId), {
          headers: { "Cache-Control": "no-store" },
        });
      case "leave-meal":
        await service.leaveMeal(b.mealId);
        break;
      case "end-meal":
        await service.endMeal();
        break;
      case "leave-group":
        await service.leave();
        break;
    }
    const snapshot = await service.snapshot();
    const key = snapshot.group?.notificationKey || oldKey;
    if (key) after(() => notifyFriends(key));
    return Response.json(
      { ...snapshot, ...extra },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return error(e);
  }
}
