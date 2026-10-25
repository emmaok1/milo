import { cachedWelcome, welcomeLine } from "@/lib/welcome-audio";
import { streamEnabled } from "@/lib/quick-responses/assets";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  AppError,
  assertOrigin,
  context,
  profile,
  list,
  insert,
} from "@/lib/store";
import { characterId, characterIds } from "@/lib/characters";
import { voiceLanguageCodes } from "@/lib/voice";
import { cartesiaReady, cartesiaSpeech } from "@/lib/cartesia";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const c = await context("voice_speech", "write");
    const raw = await req.text();
    if (raw.length > 12000)
      throw new AppError(413, "The spoken phrase is too long.");
    const b = z
      .object({
        text: z.string().trim().min(1).max(1000),
        language: z.enum(voiceLanguageCodes),
        character: z.enum(characterIds),
        stream: z.boolean().optional(),
        style: z.literal("checkin").optional(),
      })
      .strict()
      .parse(JSON.parse(raw));
    const p = await profile(c),
      character = characterId(p.mobile!.listener);
    if (b.character !== character)
      throw new AppError(
        409,
        "Your character changed. Start a new call to use the updated voice.",
      );
    if (c.demo || !cartesiaReady(character))
      throw new AppError(
        503,
        "Enhanced voice is not configured for this character. Choose Device voice instead.",
      );
    const recent = (await list(c, "access_event")).filter(
      (e) =>
        e.data.purpose === "voice_speech" &&
        Date.now() - Date.parse(e.created_at) < 60000,
    );
    if (recent.length >= 120)
      throw new AppError(
        429,
        "Please wait a moment before playing more speech.",
      );
    await insert(c, "access_event", {
      requestId: randomUUID(),
      purpose: "voice_speech",
      operation: "synthesize",
      result: "accepted",
    });
    if (b.text === welcomeLine && b.language === "en-US" && !b.stream) {
      const bytes = await cachedWelcome(character);
      if (bytes)
        return new Response(new Uint8Array(bytes), {
          headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
        });
    }
    const streaming = b.stream === true && streamEnabled();
    const body = await cartesiaSpeech(
      b.text,
      b.language,
      character,
      req.signal,
      streaming,
      b.style,
    );
    return new Response(body, {
      headers: {
        "Content-Type": streaming ? "audio/pcm" : "audio/wav",
        "X-Audio-Sample-Rate": "24000",
        "X-Audio-Encoding": "pcm_s16le",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const status =
      e instanceof AppError
        ? e.status
        : e instanceof z.ZodError || e instanceof SyntaxError
          ? 400
          : 502;
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : status === 400
              ? "Please check the voice request."
              : "Enhanced voice could not finish. Your transcript is still available.",
      },
      { status },
    );
  }
}
