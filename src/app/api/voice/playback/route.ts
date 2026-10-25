import { z } from "zod";
import { AppError, assertOrigin, context, get, update } from "@/lib/store";
import { turnRecordId } from "@/lib/quick-responses/assets";
import {
  nextPlaybackState,
  updateVoiceMessage,
  type PlaybackState,
} from "@/lib/quick-responses/playback";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const c = await context("voice_playback", "write");
    const raw = await req.text();
    if (raw.length > 1500) throw new AppError(413, "Request too large.");
    const b = z
      .object({
        requestId: z.uuid(),
        state: z.enum(["started", "completed", "interrupted", "failed"]),
        playedMs: z.number().min(0).max(600000).optional(),
      })
      .strict()
      .parse(JSON.parse(raw));
    let control = await get(
      c,
      turnRecordId(c.userId, b.requestId),
      "access_event",
    );
    if (control.data.voice !== true) throw new AppError(404, "Turn not found.");
    let state = nextPlaybackState(
      (control.data.playbackState || "pending") as PlaybackState,
      b.state,
    );
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await update(
          c,
          control.id,
          { playbackState: state, playedMs: b.playedMs },
          control.version,
        );
        break;
      } catch (e) {
        if (!(e instanceof AppError) || e.status !== 409 || attempt === 2)
          throw e;
        control = await get(c, control.id, "access_event");
        state = nextPlaybackState(
          (control.data.playbackState || "pending") as PlaybackState,
          b.state,
        );
      }
    }
    if (control.data.outputId && state !== "fallback") {
      const row = await get(c, String(control.data.outputId), "message");
      const interrupted = state === "interrupted" || state === "failed";
      await updateVoiceMessage(c, row.id, {
        playbackState: state,
        ...(interrupted
          ? {
              state: "interrupted",
              intendedText: row.data.intendedText || row.data.text,
            }
          : {}),
        playedMs: b.playedMs,
      });
    }
    return Response.json(
      { ok: true, state },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Playback status could not be saved.",
      },
      {
        status:
          e instanceof AppError
            ? e.status
            : e instanceof z.ZodError
              ? 400
              : 503,
      },
    );
  }
}
