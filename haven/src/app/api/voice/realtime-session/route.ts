import { z } from "zod";
import { randomUUID } from "node:crypto";
import { AppError, assertOrigin, context, list, insert } from "@/lib/store";
import { realtimeEnabled, realtimeGrant } from "@/lib/realtime-config";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const c = await context("voice_realtime_token", "write");
    const raw = await req.text();
    if (raw.length > 300) throw new AppError(413, "Request too large.");
    const b = z
      .object({ language: z.literal("en-US") })
      .strict()
      .parse(JSON.parse(raw));
    if (c.demo || !realtimeEnabled(b.language))
      throw new AppError(503, "Realtime recognition is unavailable.");
    const recent = (await list(c, "access_event")).filter(
      (e) =>
        e.data.purpose === "voice_realtime_token" &&
        Date.now() - Date.parse(e.created_at) < 60000,
    );
    if (recent.length >= 8)
      throw new AppError(429, "Please wait before reconnecting.");
    await insert(c, "access_event", {
      purpose: "voice_realtime_token",
      requestId: randomUUID(),
      operation: "grant",
      result: "accepted",
    });
    return Response.json(await realtimeGrant(req.signal), {
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Realtime recognition is unavailable.",
      },
      {
        status:
          e instanceof AppError
            ? e.status
            : e instanceof z.ZodError || e instanceof SyntaxError
              ? 400
              : 503,
      },
    );
  }
}
