import { AppError, context, profile } from "@/lib/store";
import { characterId } from "@/lib/characters";
import {
  availableAssets,
  assetBytes,
  quickEnabled,
} from "@/lib/quick-responses/assets";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const c = await context("voice_static_audio", "read");
    const p = await profile(c);
    const { key } = await params;
    if (!quickEnabled() || !key.match(/^[a-f0-9]{64}$/))
      throw new AppError(404, "Audio is unavailable.");
    const asset = (await availableAssets(characterId(p.mobile!.listener))).find(
      (a) => a.key === key,
    );
    if (!asset) throw new AppError(404, "Audio is unavailable.");
    return new Response(await assetBytes(asset), {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof AppError ? e.message : "Audio is unavailable." },
      { status: e instanceof AppError ? e.status : 404 },
    );
  }
}
