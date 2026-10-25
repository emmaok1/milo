import { z } from "zod";
import {
  AppError,
  assertOrigin,
  context,
  list,
  update,
  insert,
} from "@/lib/store";
import { mobileState } from "@/lib/listener-model";
import { ai, claudeThinking } from "@/lib/ai";
import { imageBlocks } from "@/lib/chat-images";
import {
  photoCategoryPrompt,
  photoStillCurrent,
  safePhotoCategory,
} from "@/lib/photo-category";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const c = await context("journal_photo_category", "write");
    const raw = await req.text();
    if (raw.length > 200) throw new AppError(413, "Invalid photo request.");
    const { id } = z.object({ id: z.uuid() }).strict().parse(JSON.parse(raw));
    const row = (await list(c, "profile"))[0];
    const before = mobileState(row?.data.mobile).journal.find(
      (e) => e.id === id,
    );
    if (!before?.photo) throw new AppError(404, "Photo not found.");
    if (before.foodCategory !== undefined)
      return Response.json({ category: before.foodCategory });
    if (c.demo)
      throw new AppError(503, "Photo analysis is unavailable in preview mode.");
    const recent = (await list(c, "access_event")).filter(
      (e) =>
        e.data.purpose === "journal_photo_category" &&
        Date.now() - Date.parse(e.created_at) < 60000,
    );
    if (recent.length >= 12)
      throw new AppError(429, "Please wait before analyzing more photos.");
    await insert(c, "access_event", {
      purpose: "journal_photo_category",
      operation: "classify",
      result: "accepted",
    });
    const model = process.env.ANTHROPIC_CHAT_MODEL || "claude-sonnet-5-5";
    const response = await ai().messages.create(
      {
        model,
        max_tokens: 120,
        thinking: claudeThinking(model),
        system: photoCategoryPrompt,
        messages: [
          {
            role: "user",
            content: [
              ...imageBlocks([{ name: "Meal photo", url: before.photo }]),
              {
                type: "text",
                text: "Return the primary category, or unknown.",
              },
            ],
          },
        ],
      },
      { signal: req.signal },
    );
    const text = response.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*|\s*```$/g, "");
    const category = safePhotoCategory(JSON.parse(text));
    const fresh = (await list(c, "profile"))[0];
    const state = mobileState(fresh?.data.mobile);
    const current = state.journal.find((e) => e.id === id);
    if (!fresh || !photoStillCurrent(before, current))
      throw new AppError(
        409,
        "This photo changed. Reload before analyzing again.",
      );
    current!.foodCategory = category;
    await update(c, fresh.id, { mobile: state }, fresh.version);
    return Response.json(
      { category },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Photo analysis is unavailable. You can set the category yourself.",
      },
      { status: e instanceof AppError ? e.status : 502 },
    );
  }
}
