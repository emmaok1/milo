import { after } from "next/server";
import { z } from "zod";
import {
  AppError,
  assertOrigin,
  context,
  profile,
  get,
  list,
  insert,
} from "@/lib/store";
import { readMemories } from "@/lib/memory";
import { streamChat } from "@/lib/ai";
import { conversationMessages } from "@/lib/chat-images";
import { retrieveKnowledge } from "@/lib/knowledge";
import { preferencesFor, contextualVoiceDecision } from "@/lib/voice-context";
import { voiceLanguageCodes } from "@/lib/voice";
import { voiceSystem } from "@/lib/voice-generation";
import {
  preparationEnabled,
  preparationFingerprint,
  voicePreparations,
} from "@/lib/voice-preparation";
export const runtime = "nodejs";
const ids = z.object({
  callId: z.uuid(),
  turnId: z.uuid(),
  revision: z.number().int().min(1).max(100),
});
const body = ids
  .extend({
    text: z.string().trim().min(8).max(3000),
    conversationId: z.uuid().optional(),
    language: z.enum(voiceLanguageCodes),
    temporary: z.boolean().optional(),
    voiceHistory: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          text: z.string().max(10000),
          responseId: z.string().optional(),
          playbackState: z.string().optional(),
        }),
      )
      .max(20)
      .default([]),
  })
  .strict();
export async function POST(req: Request) {
  let cancel: (() => void) | undefined;
  try {
    assertOrigin(req);
    const c = await context("voice_prepare", "write");
    if (!preparationEnabled() || c.demo)
      throw new AppError(503, "Early preparation is unavailable.");
    const raw = await req.text();
    if (raw.length > 60000) throw new AppError(413, "Request too large.");
    const b = body.parse(JSON.parse(raw));
    const p = await profile(c);
    if (b.conversationId) await get(c, b.conversationId, "conversation");
    const history = b.conversationId
      ? await list(c, "message", b.conversationId)
      : [];
    const temporary = b.temporary === true || p.memoryMode === "temporary";
    const routing = temporary
      ? b.voiceHistory
      : history.map((m) => ({
          role: String(m.data.role),
          text: String(m.data.text || ""),
        }));
    if (contextualVoiceDecision(b.text, routing).path === "safety")
      throw new AppError(409, "Wait for the complete turn.");
    const recent = (await list(c, "access_event")).filter(
      (r) =>
        r.data.purpose === "voice_prepare" &&
        Date.now() - Date.parse(r.created_at) < 60000,
    );
    if (recent.length >= 30)
      throw new AppError(429, "Early preparation limit reached.");
    const entry = voicePreparations.reserve(
      c.userId,
      b.callId,
      b.turnId,
      b.revision,
      b.text,
    );
    if (!entry) throw new AppError(409, "Preparation superseded.");
    cancel = () =>
      voicePreparations.cancel(c.userId, b.callId, b.turnId, b.revision);
    req.signal.addEventListener("abort", cancel, { once: true });
    await insert(c, "access_event", {
      purpose: "voice_prepare",
      operation: "prepare",
      result: "accepted",
      callId: b.callId,
      turnId: b.turnId,
      revision: b.revision,
    });
    after(async () => {
      try {
        if (req.signal.aborted || entry.abort.signal.aborted) return;
        const memories = temporary ? [] : await readMemories(c, b.text);
        if (entry.abort.signal.aborted) return;
        const conversation = b.conversationId
          ? await get(c, b.conversationId, "conversation")
          : undefined;
        const focus = (conversation?.data.focus || "open") as
          "open" | "after_eating" | "self_kindness" | "listening";
        const pref = preferencesFor(
          [...routing, { role: "user", text: b.text }],
          p.preference,
        );
        const system = voiceSystem(
          p,
          focus,
          b.language,
          pref,
          memories,
          retrieveKnowledge(b.text),
        );
        const messages = temporary
          ? [
              ...b.voiceHistory.map((m) => ({
                role: m.role,
                content:
                  m.playbackState && m.playbackState !== "completed"
                    ? `[Voice playback ${m.playbackState}; do not assume fully heard.] ${m.text}`
                    : m.text,
              })),
              { role: "user" as const, content: b.text },
            ]
          : conversationMessages(history, b.text, [], false);
        await voicePreparations.generate(
          entry,
          preparationFingerprint(system, messages),
          (signal) => streamChat(system, messages, signal),
        );
      } catch {
        voicePreparations.cancel(c.userId, b.callId, b.turnId, b.revision);
      }
    });
    return Response.json(
      { prepared: true, revision: b.revision },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    cancel?.();
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Early preparation is unavailable.",
      },
      { status: e instanceof AppError ? e.status : 400 },
    );
  }
}
export async function DELETE(req: Request) {
  try {
    assertOrigin(req);
    const c = await context("voice_prepare_cancel", "write");
    const b = ids.strict().parse(await req.json());
    voicePreparations.cancel(c.userId, b.callId, b.turnId, b.revision);
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Preparation could not be canceled." },
      { status: 400 },
    );
  }
}
