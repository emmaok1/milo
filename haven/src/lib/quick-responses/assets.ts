import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { cartesiaPayload, cartesiaVoice } from "../cartesia";
import type { CharacterId } from "../characters";
import { contentVersion, quickResponseById } from "./library";
// Retired: no environment flag can re-enable canned replies in live calls.
export const quickEnabled = () => false;
export const streamEnabled = () => process.env.VOICE_STREAM_AUDIO === "true";
export const assetRoot = () =>
  path.resolve(process.env.VOICE_RESPONSE_CACHE_DIR || ".voice-cache");
export const assetSchema = z
  .object({
    key: z.string().regex(/^[a-f0-9]{64}$/),
    id: z.string().regex(/^\d{3}$/),
    voiceId: z.string().min(1),
    voice: z.enum(["black_cat", "white_cat"]),
    contentVersion: z.string(),
    textHash: z.string(),
    settingsVersion: z.string(),
    format: z.literal("wav-pcm_s16le-24000"),
    sampleRate: z.literal(24000),
    bytes: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type AudioAsset = z.infer<typeof assetSchema>;
export const manifestSchema = z
  .object({ version: z.literal(1), assets: z.array(assetSchema) })
  .strict();
export const digest = (text: string | Uint8Array) =>
  createHash("sha256").update(text).digest("hex");
export function expectedAsset(id: string, voice: CharacterId) {
  const entry = quickResponseById.get(id);
  if (!entry) throw new Error("Unknown response ID.");
  const { transcript: _, ...settings } = cartesiaPayload(
    entry.responseText,
    "en-US",
    voice,
  );
  void _;
  const textHash = digest(entry.responseText),
    settingsVersion = digest(
      JSON.stringify({
        ...settings,
        apiVersion: process.env.CARTESIA_VERSION || "2026-08-14",
      }),
    );
  const key = digest(
    JSON.stringify({
      voiceId: cartesiaVoice(voice),
      id,
      textHash,
      settingsVersion,
      format: "wav-pcm_s16le-24000",
      contentVersion,
    }),
  );
  return {
    key,
    id,
    voiceId: cartesiaVoice(voice),
    voice,
    contentVersion,
    textHash,
    settingsVersion,
    format: "wav-pcm_s16le-24000" as const,
    sampleRate: 24000 as const,
  };
}
export function validWav(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  return (
    b.length > 44 &&
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WAVE" &&
    b.includes(Buffer.from("data"))
  );
}
export async function loadManifest() {
  try {
    return manifestSchema.parse(
      JSON.parse(
        await readFile(path.join(assetRoot(), "manifest.json"), "utf8"),
      ),
    );
  } catch {
    return { version: 1 as const, assets: [] as AudioAsset[] };
  }
}
export async function availableAssets(voice: CharacterId) {
  const { assets } = await loadManifest();
  const result: AudioAsset[] = [];
  for (const asset of assets) {
    if (
      asset.voice !== voice ||
      !quickResponseById.has(asset.id) ||
      asset.key !== expectedAsset(asset.id, voice).key
    )
      continue;
    try {
      if (
        (await stat(path.join(assetRoot(), asset.key + ".wav"))).size ===
        asset.bytes
      )
        result.push(asset);
    } catch {}
  }
  return result;
}
export async function assetBytes(asset: AudioAsset) {
  const b = await readFile(path.join(assetRoot(), asset.key + ".wav"));
  if (!validWav(b) || b.length !== asset.bytes || digest(b) !== asset.sha256)
    throw new Error("Invalid response audio.");
  return b;
}
export const preloadIds = ["047", "090", "016"];
export function turnRecordId(
  userId: string,
  requestId: string,
): `${string}-${string}-${string}-${string}-${string}` {
  const h = digest(userId + ":voice-turn:" + requestId);
  return (h.slice(0, 8) +
    "-" +
    h.slice(8, 12) +
    "-4" +
    h.slice(13, 16) +
    "-a" +
    h.slice(17, 20) +
    "-" +
    h.slice(20, 32)) as `${string}-${string}-${string}-${string}-${string}`;
}
