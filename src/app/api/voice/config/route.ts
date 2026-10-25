import { preparationEnabled } from "@/lib/voice-preparation";
import { realtimeEnabled } from "@/lib/realtime-config";
import {
  quickEnabled,
  streamEnabled,
  availableAssets,
  preloadIds,
} from "@/lib/quick-responses/assets";
import { context, profile, AppError } from "@/lib/store";
import { characterId } from "@/lib/characters";
import { cartesiaReady } from "@/lib/cartesia";
import { speechReady } from "@/lib/speech-input";
export async function GET() {
  try {
    const c = await context("voice_config", "read");
    const p = await profile(c);
    return Response.json(
      {
        transcription:
          (!c.demo && realtimeEnabled(p.mobile!.listener.language)) ||
          (await speechReady()),
        speculative:
          !c.demo &&
          preparationEnabled() &&
          realtimeEnabled(p.mobile!.listener.language),
        realtime: !c.demo && realtimeEnabled(p.mobile!.listener.language),
        cartesia: !c.demo && cartesiaReady(characterId(p.mobile!.listener)),
        streaming: streamEnabled(),
        quickResponses: quickEnabled(),
        quickAssets: quickEnabled()
          ? (await availableAssets(characterId(p.mobile!.listener))).map(
              (a) => ({
                key: a.key,
                id: a.id,
                url: `/api/voice/quick-audio/${a.key}`,
                preload: preloadIds.includes(a.id),
              }),
            )
          : [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return Response.json(
      {
        error:
          e instanceof AppError
            ? e.message
            : "Voice configuration is unavailable.",
      },
      { status: e instanceof AppError ? e.status : 503 },
    );
  }
}
