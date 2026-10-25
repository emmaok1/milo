import { z } from "zod";
import { randomUUID } from "node:crypto";
import { AppError, assertOrigin, context, list, insert } from "@/lib/store";
import { speechToken, speechUrl, validAudio } from "@/lib/speech-input";
import { voiceLanguageCodes } from "@/lib/voice";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    assertOrigin(req);
    const c = await context("voice_transcribe", "write");
    const language = z.enum(voiceLanguageCodes).parse(new URL(req.url).searchParams.get("language"));
    if (!speechToken()) throw new AppError(503, "The voice service is not available.");
    const recent = (await list(c, "access_event")).filter(e => e.data.purpose === "voice_transcribe" && Date.now() - Date.parse(e.created_at) < 60000);
    if (recent.length >= 25) throw new AppError(429, "Please wait a moment before speaking again.");
    if (!req.body) throw new AppError(400, "No audio was received.");
    const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.length;
      if (size > 6000000) { await reader.cancel(); throw new AppError(413, "Please keep each turn under 30 seconds."); }
      chunks.push(chunk.value);
    }
    const body = Buffer.concat(chunks);
    if (!validAudio(body)) throw new AppError(400, "The audio format could not be read.");
    await insert(c, "access_event", { requestId: randomUUID(), purpose: "voice_transcribe", operation: "transcribe", result: "accepted" });
    const response = await fetch(speechUrl() + "/transcribe?language=" + language.split("-")[0], {
      method: "POST", headers: { Authorization: "Bearer " + speechToken(), "Content-Type": req.headers.get("Content-Type") || "application/octet-stream" }, body,
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(30000)]), cache: "no-store",
    });
    if (!response.ok) throw new AppError(503, "Could not hear that clearly. Tap the microphone to try again.");
    const result = await response.json();
    return Response.json({ text: z.string().max(10000).parse(result.text) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof AppError ? e.message : e instanceof z.ZodError ? "Please check the call language." : "The voice connection was interrupted. Please try again." }, { status: e instanceof AppError ? e.status : e instanceof z.ZodError ? 400 : 503 });
  }
}
