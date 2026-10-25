export type VoiceMetric = {
  turnId: string;
  speechEndAt?: number;
  detectedEndAt?: number;
  finalTranscriptAt: number;
  requestAt?: number;
  routerMs?: number;
  prepared?: boolean;
  path?: string;
  responseId?: string;
  intent?: string;
  cacheHit?: boolean;
  fallbackReason?: string;
  assetReadyAt?: number;
  playbackRequestedAt?: number;
  playbackStartedAt?: number;
  interrupted?: boolean;
  playbackSignal?: string;
};
/** Local bounded diagnostics; no transcripts, names, IDs of users, or audio. */
export function recordVoiceMetric(metric: VoiceMetric) {
  if (typeof window === "undefined") return;
  const w = window as Window & { __havenVoiceMetrics?: VoiceMetric[] };
  w.__havenVoiceMetrics = [
    ...(w.__havenVoiceMetrics || [])
      .filter((m) => m.turnId !== metric.turnId)
      .slice(-49),
    { ...metric },
  ];
  if (process.env.NODE_ENV === "development")
    console.debug("Voice timing", { ...metric });
}
