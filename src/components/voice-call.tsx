"use client";
import { VoiceCaptions } from "@/lib/voice-captions";
import { VoicePrepareClient } from "@/lib/voice-prepare-client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Square,
  Shield,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/client";
import { mobileState, listenerAvatar } from "@/lib/listener-model";
import type { Profile } from "@/lib/types";
import { takeSpeech, speechText, chooseVoice } from "@/lib/voice";
import CloudCallScene from "./cloud-call-scene";
import ChatBackdrop from "./chat-backdrop";
import { characterId } from "@/lib/characters";
import {
  VoiceAudioPlayer,
  FinalTurnGuard,
  type QuickAssetRef,
} from "@/lib/voice-audio";
import { recordVoiceMetric, type VoiceMetric } from "@/lib/voice-metrics";
import type { CharacterId } from "@/lib/characters";
import { RealtimeMicrophone } from "@/lib/realtime-stt";
import { SilentMicrophone } from "@/lib/silent-microphone";

type Phase =
  "ready" | "listening" | "thinking" | "speaking" | "paused" | "ended";
type Turn = {
  id: number;
  role: "user" | "assistant";
  text: string;
  state?: string;
  responseId?: string;
};
type Memory = { id: string; text: string; source?: string };
type MemoryResult = {
  mode: string;
  items: Memory[];
  pending: number;
  failed: number;
  total: number;
};

export default function VoiceCall({ p, demo }: { p: Profile; demo: boolean }) {
  const appearance = mobileState(p.mobile);
  const listener = appearance.listener;
  const [phase, setPhase] = useState<Phase>("ready");
  const [callSettled, setCallSettled] = useState(false);
  useEffect(() => {
    setCallSettled(false);
    if (phase !== "ended") return;
    const timer = setTimeout(() => setCallSettled(true), 1450);
    return () => clearTimeout(timer);
  }, [phase]);
  const [supported, setSupported] = useState(false);
  const [ready, setReady] = useState(false);
  const language = listener.language;
  const [provider, setProvider] = useState("browser");
  const temporary = p.memoryMode === "temporary";
  const [subtitle, setSubtitle] = useState("");
  const captions = useRef<VoiceCaptions | null>(null);
  if (captions.current === null) {
    captions.current = new VoiceCaptions(setSubtitle);
  }
  const [captionRole, setCaptionRole] = useState<"user" | "assistant">(
    "assistant",
  );
  const [error, setError] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const turnsRef = useRef<Turn[]>([]);
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);
  const [cid, setCid] = useState<string>();
  const [seconds, setSeconds] = useState(0);
  const [memories, setMemories] = useState<MemoryResult | null>(null);
  const [memoryError, setMemoryError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const engine = useRef({
    active: false,
    muted: false,
    epoch: 0,
    generating: false,
    speaking: false,
    audioBlocked: false,
    transcribing: false,
    pending: "",
    queue: [] as string[],
    id: 0,
    conversation: undefined as string | undefined,
    temporary: false,
    language: "en-US",
    provider: "browser",
    firstChunk: true,
    callId: "",
    quickEnabled: false,
    streaming: false,
    character: "black_cat" as CharacterId,
  });
  const streamPlayer = useRef<VoiceAudioPlayer | null>(null);
  const preparation = useRef<VoicePrepareClient | null>(null);
  const turnGuard = useRef(new FinalTurnGuard());
  const quickConfig = useRef({
    enabled: false,
    streaming: false,
    realtime: false,
    speculative: false,
    assets: [] as QuickAssetRef[],
  });
  const playback = useRef<{
    requestId: string;
    started: boolean;
    terminal: boolean;
    quick: boolean;
    startedAt?: number;
  } | null>(null);
  const metric = useRef<VoiceMetric | null>(null);
  const saveMetric = useCallback(() => {
    if (metric.current) recordVoiceMetric(metric.current);
  }, []);
  const playbackStatus = useCallback(
    (state: "started" | "completed" | "interrupted" | "failed") => {
      const turn = playback.current;
      if (!turn || turn.terminal) return;
      if (state === "started") {
        if (turn.started) return;
        turn.started = true;
        turn.startedAt = performance.now();
        if (metric.current) {
          metric.current.playbackStartedAt = turn.startedAt;
          metric.current.playbackSignal =
            engine.current.streaming || turn.quick
              ? "audio_context_clock"
              : "html_audio_or_device_start";
          saveMetric();
        }
      } else {
        turn.terminal = true;
        if (metric.current) {
          metric.current.interrupted = state === "interrupted";
          saveMetric();
        }
      }
      void fetch("/api/voice/playback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: turn.requestId,
          state,
          playedMs: turn.startedAt
            ? Math.round(performance.now() - turn.startedAt)
            : 0,
        }),
        keepalive: true,
      }).catch(() => {});
    },
    [saveMetric],
  );
  const microphone = useRef<SilentMicrophone | RealtimeMicrophone | null>(null);
  const transcriptionRequest = useRef<AbortController | null>(null);
  const request = useRef<AbortController | null>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const fixedVoice = useRef<SpeechSynthesisVoice | undefined>(undefined);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef("");
  const speechRequest = useRef<AbortController | null>(null);
  const prefetchedSpeech = useRef<{
    text: string;
    epoch: number;
    controller: AbortController;
    response: Promise<Response | null>;
  } | null>(null);
  function speechBody(text: string) {
    const e = engine.current;
    return JSON.stringify({
      text: speechText(text),
      language: e.language,
      character: e.character,
      ...(e.streaming ? { stream: true } : {}),
    });
  }
  function prefetchNextPhrase() {
    const e = engine.current;
    if (
      !e.active ||
      !e.streaming ||
      e.provider !== "cartesia" ||
      !e.speaking ||
      !e.queue[0] ||
      prefetchedSpeech.current
    )
      return;
    const controller = new AbortController();
    const text = e.queue[0];
    prefetchedSpeech.current = {
      text,
      epoch: e.epoch,
      controller,
      response: fetch("/api/voice/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: speechBody(text),
        signal: controller.signal,
      }).catch(() => null),
    };
  }
  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memoryRequest = useRef<AbortController | null>(null);
  const status = {
    ready: "Ready to call",
    listening: "I’m listening",
    thinking: "Thinking…",
    speaking: "Speaking",
    paused: "Paused",
    ended: "Call ended",
  }[phase];

  useEffect(() => {
    setSupported(
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
        typeof window.MediaRecorder === "function" &&
        typeof window.AudioContext === "function",
    );
    const e = engine.current;
    const controller = new AbortController();
    let configTimer: ReturnType<typeof setTimeout>;
    async function loadConfig() {
      try {
        const response = await fetch("/api/voice/config", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Voice service unavailable");
        const config = await response.json();
        if (controller.signal.aborted) return;
        setReady(config.transcription === true);
        if (!e.active)
          quickConfig.current = {
            enabled: config.quickResponses === true,
            streaming: config.streaming === true,
            realtime: config.realtime === true,
            speculative: config.speculative === true,
            assets: config.quickAssets || [],
          };
        if (!e.active) setProvider(config.cartesia ? "cartesia" : "browser");
        if (!config.transcription) configTimer = setTimeout(loadConfig, 3000);
      } catch {
        if (!controller.signal.aborted)
          configTimer = setTimeout(loadConfig, 3000);
      }
    }
    void loadConfig();
    const pagehide = () => {
      captions.current?.cancel();
      preparation.current?.cancel();
      playbackStatus("interrupted");
      streamPlayer.current?.close();
      streamPlayer.current = null;
      e.active = false;
      e.epoch++;
      microphone.current?.close();
      transcriptionRequest.current?.abort();
      request.current?.abort();
      prefetchedSpeech.current?.controller.abort();
      prefetchedSpeech.current = null;
      speechRequest.current?.abort();
      audio.current?.pause();
      if (audioUrl.current) {
        URL.revokeObjectURL(audioUrl.current);
        audioUrl.current = "";
      }
      window.speechSynthesis?.cancel();
    };
    window.addEventListener("pagehide", pagehide);
    return () => {
      pagehide();
      memoryRequest.current?.abort();
      controller.abort();
      clearTimeout(configTimer);
      if (watchdog.current) clearTimeout(watchdog.current);
      window.removeEventListener("pagehide", pagehide);
    };
  }, [playbackStatus]);
  useEffect(() => {
    if (["ready", "ended"].includes(phase)) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);
  useEffect(() => {
    if (phase !== "ended" || !cid || temporary || p.memoryMode !== "automatic")
      return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    async function poll() {
      memoryRequest.current?.abort();
      const controller = new AbortController();
      memoryRequest.current = controller;
      try {
        const r = await fetch(
          `/api/voice/memories?conversation=${encodeURIComponent(cid!)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Memory could not be loaded.");
        if (disposed) return;
        setMemories(data);
        setMemoryError("");
        if (data.pending && Date.now() - started < 90000)
          timer = setTimeout(poll, 3000);
      } catch (e) {
        if (!disposed && !controller.signal.aborted)
          setMemoryError((e as Error).message);
      }
    }
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
      memoryRequest.current?.abort();
    };
  }, [phase, cid, temporary, p.memoryMode]);

  function stopOutput() {
    captions.current?.cancel();
    preparation.current?.cancel();
    const e = engine.current;
    const interrupted = e.generating || e.speaking;
    const interruptedId = e.id;
    if (interrupted) playbackStatus("interrupted");
    streamPlayer.current?.stop();
    e.epoch++;
    e.transcribing = false;
    e.generating = false;
    e.speaking = false;
    e.audioBlocked = false;
    e.pending = "";
    e.queue = [];
    request.current?.abort();
    request.current = null;
    prefetchedSpeech.current?.controller.abort();
    prefetchedSpeech.current = null;
    speechRequest.current?.abort();
    speechRequest.current = null;
    audio.current?.pause();
    audio.current = null;
    if (audioUrl.current) {
      URL.revokeObjectURL(audioUrl.current);
      audioUrl.current = "";
    }
    microphone.current?.pause();
    transcriptionRequest.current?.abort();
    transcriptionRequest.current = null;
    if (watchdog.current) clearTimeout(watchdog.current);
    window.speechSynthesis?.cancel();
    utterance.current = null;
    setTurns((rows) =>
      rows.map((t) =>
        t.state === "generating" ||
        (interrupted && t.id === interruptedId && t.role === "assistant")
          ? { ...t, state: "interrupted" }
          : t,
      ),
    );
  }
  function listen() {
    const e = engine.current;
    if (
      !e.active ||
      e.muted ||
      e.generating ||
      e.speaking ||
      e.transcribing ||
      !microphone.current
    )
      return;
    const epoch = e.epoch;
    try {
      const onError = (error: Error) => {
        if (!e.active || e.epoch !== epoch) return;
        if (microphone.current instanceof RealtimeMicrophone) {
          void switchToLocalRecognition(epoch);
        } else {
          setPhase("paused");
          setError(error.message);
        }
      };
      if (microphone.current instanceof RealtimeMicrophone) {
        microphone.current.listenFinal(
          (turn) => {
            if (!e.active || e.epoch !== epoch) return;
            if (!turn.text) {
              listen();
              return;
            }
            setCaptionRole("user");
            setSubtitle(turn.text);
            void send(turn.text, turn.id, {
              turnId: turn.id,
              speechEndAt: turn.speechEndAt,
              detectedEndAt: turn.detectedEndAt,
              finalTranscriptAt: turn.finalTranscriptAt,
            });
          },
          (text, turnId, phase) => {
            if (e.active && e.epoch === epoch) {
              if (text) {
                setCaptionRole("user");
                setSubtitle(text);
              }
              preparation.current?.update(text, turnId, phase);
            }
          },
          onError,
        );
      } else {
        microphone.current.listen((blob, timing) => {
          if (e.active && e.epoch === epoch) void transcribeTurn(blob, timing);
        }, onError);
      }
      setPhase("listening");
      setSubtitle("");
      setError("");
    } catch {
      setPhase("paused");
      setError("Could not start the microphone. Tap Speak to retry.");
    }
  }
  async function switchToLocalRecognition(epoch: number) {
    const e = engine.current;
    microphone.current?.close();
    const mic = new SilentMicrophone();
    microphone.current = mic;
    setPhase("paused");
    try {
      await mic.open();
      if (!e.active || e.epoch !== epoch) {
        mic.close();
        return;
      }
      listen();
      setError(
        "Recognition switched to local. Please repeat that last sentence.",
      );
    } catch {
      mic.close();
      if (e.active && e.epoch === epoch) {
        e.active = false;
        setPhase("ready");
        setError(
          "Recognition could not reconnect. Try starting the call again.",
        );
      }
    }
  }
  async function transcribeTurn(
    blob: Blob,
    timing?: { speechEndAt: number; detectedEndAt: number },
  ) {
    const e = engine.current;
    if (!e.active || e.transcribing || e.generating) return;
    const epoch = e.epoch;
    const requestId = crypto.randomUUID();
    e.transcribing = true;
    setPhase("thinking");
    const controller = new AbortController();
    transcriptionRequest.current = controller;
    try {
      const response = await fetch(
        `/api/voice/transcribe?language=${encodeURIComponent(e.language)}`,
        {
          method: "POST",
          headers: { "Content-Type": blob.type },
          body: blob,
          signal: controller.signal,
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Could not hear that clearly. Please try again.",
        );
      if (!e.active || e.epoch !== epoch) return;
      e.transcribing = false;
      if (data.text?.trim()) {
        setCaptionRole("user");
        setSubtitle(data.text);
        void send(data.text.trim(), requestId, {
          turnId: requestId,
          ...timing,
          finalTranscriptAt: performance.now(),
        });
      } else listen();
    } catch (error) {
      if (e.active && e.epoch === epoch && !controller.signal.aborted) {
        setPhase("paused");
        setError((error as Error).message);
      }
    } finally {
      if (e.epoch === epoch) {
        e.transcribing = false;
        transcriptionRequest.current = null;
      }
    }
  }
  function finishTurn() {
    const e = engine.current;
    if (
      !e.active ||
      e.generating ||
      e.transcribing ||
      e.speaking ||
      e.queue.length ||
      e.audioBlocked
    )
      return;
    playbackStatus("completed");
    setPhase("paused");
    if (!e.muted) listen();
  }
  function playNext() {
    const e = engine.current;
    if (!e.active || e.speaking || e.audioBlocked) return;
    const next = e.queue.shift();
    if (!next) {
      finishTurn();
      return;
    }
    if (metric.current) {
      metric.current.playbackRequestedAt ||= performance.now();
      saveMetric();
    }
    captions.current?.cancel();
    setSubtitle("");
    setCaptionRole("assistant");
    if (e.provider === "cartesia") {
      void playEnhanced(next);
      return;
    }
    if (!("speechSynthesis" in window)) {
      e.queue = [];
      e.audioBlocked = true;
      setPhase(e.generating ? "thinking" : "paused");
      return;
    }
    const epoch = e.epoch;
    const u = new SpeechSynthesisUtterance(speechText(next));
    utterance.current = u;
    u.lang = e.language;
    u.rate = 0.98;
    const voice = fixedVoice.current;
    if (voice) u.voice = voice;
    e.speaking = true;
    const valid = () =>
      e.active && e.epoch === epoch && utterance.current === u;
    const fail = () => {
      if (!valid()) return;
      e.speaking = false;
      e.audioBlocked = true;
      e.queue = [];
      utterance.current = null;
      window.speechSynthesis.cancel();
      captions.current?.cancel();
      playbackStatus("failed");
      setPhase(e.generating ? "thinking" : "paused");
      setError(
        "The reply could not play. Tap Speak to continue, or end the call and try again.",
      );
    };
    watchdog.current = setTimeout(fail, 10000);
    u.onstart = () => {
      if (!valid()) return;
      captions.current?.start(next, true);
      if (watchdog.current) clearTimeout(watchdog.current);
      watchdog.current = setTimeout(fail, 120000);
      playbackStatus("started");
      setPhase("speaking");
    };
    u.onboundary = (event) => {
      if (valid() && event.name === "word") captions.current?.boundary(event.charIndex, event.charLength);
    };
    u.onend = () => {
      if (!valid()) return;
      captions.current?.finish();
      if (watchdog.current) clearTimeout(watchdog.current);
      e.speaking = false;
      utterance.current = null;
      playNext();
    };
    u.onerror = fail;
    window.speechSynthesis.speak(u);
  }
  async function playEnhanced(text: string) {
    const e = engine.current,
      epoch = e.epoch;
    e.speaking = true;
    setPhase("thinking");
    const prepared = prefetchedSpeech.current;
    prefetchedSpeech.current = null;
    const usable =
      prepared?.epoch === epoch &&
      prepared.text === text &&
      !prepared.controller.signal.aborted;
    if (prepared && !usable) prepared.controller.abort();
    const controller = usable ? prepared.controller : new AbortController();
    speechRequest.current = controller;
    const valid = () =>
      e.active && e.epoch === epoch && !controller.signal.aborted;
    const fail = () => {
      if (!valid()) return;
      e.speaking = false;
      e.audioBlocked = true;
      e.queue = [];
      prefetchedSpeech.current?.controller.abort();
      prefetchedSpeech.current = null;
      controller.abort();
      audio.current?.pause();
      audio.current = null;
      if (watchdog.current) clearTimeout(watchdog.current);
      if (audioUrl.current) {
        URL.revokeObjectURL(audioUrl.current);
        audioUrl.current = "";
      }
      captions.current?.cancel();
      playbackStatus("failed");
      setPhase(e.generating ? "thinking" : "paused");
      setError(
        "The reply could not play. Tap Speak to continue, or end the call and try again.",
      );
    };
    watchdog.current = setTimeout(fail, 25000);
    try {
      const synthesize = () =>
        fetch("/api/voice/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: speechBody(text),
          signal: controller.signal,
        });
      const incoming = usable ? prepared.response : synthesize();
      prefetchNextPhrase();
      let response = await incoming;
      if (!valid()) return;
      if (!response || !response.ok) response = await synthesize();
      if (!response.ok) throw new Error("Speech unavailable");
      if (
        e.streaming &&
        response.headers.get("Content-Type")?.startsWith("audio/pcm")
      ) {
        if (!response.body) throw new Error("Speech unavailable");
        await streamPlayer.current!.playPcm(
          response.body,
          Number(response.headers.get("X-Audio-Sample-Rate") || 24000),
          controller.signal,
          () => {
            if (!valid()) return;
            captions.current?.start(text);
            if (watchdog.current) clearTimeout(watchdog.current);
            watchdog.current = setTimeout(fail, 120000);
            if (metric.current) {
              metric.current.assetReadyAt ||= performance.now();
              saveMetric();
            }
            playbackStatus("started");
            setPhase("speaking");
          },
          (seconds, duration) => { if (valid()) captions.current?.progress(seconds, duration); },
        );
        if (!valid()) return;
        captions.current?.finish();
        if (watchdog.current) clearTimeout(watchdog.current);
        speechRequest.current = null;
        e.speaking = false;
        playNext();
        return;
      }
      const blob = await response.blob();
      if (!valid()) return;
      if (metric.current) {
        metric.current.assetReadyAt ||= performance.now();
        saveMetric();
      }
      const url = URL.createObjectURL(blob);
      audioUrl.current = url;
      const player = new Audio(url);
      audio.current = player;
      player.onplaying = () => {
        if (!valid()) return;
        captions.current?.start(text);
        if (watchdog.current) clearTimeout(watchdog.current);
        watchdog.current = setTimeout(fail, 120000);
        playbackStatus("started");
        setPhase("speaking");
      };
      player.ontimeupdate = () => {
        if (valid()) captions.current?.progress(player.currentTime, player.duration);
      };
      player.onended = () => {
        if (!valid()) return;
        captions.current?.finish();
        if (watchdog.current) clearTimeout(watchdog.current);
        URL.revokeObjectURL(url);
        audioUrl.current = "";
        audio.current = null;
        speechRequest.current = null;
        e.speaking = false;
        playNext();
      };
      player.onerror = fail;
      await player.play();
    } catch {
      fail();
    }
  }
  async function send(
    value: string,
    requestId = crypto.randomUUID(),
    timing?: VoiceMetric,
    resumeQuick = false,
  ) {
    const e = engine.current;
    if (!e.active || !value.trim() || e.generating) return;
    if (!resumeQuick && !turnGuard.current.accept(requestId)) return;
    const prepared = !resumeQuick
      ? preparation.current?.finish(value, requestId)
      : undefined;
    if (!resumeQuick) stopOutput();
    const epoch = e.epoch;
    if (!resumeQuick) {
      metric.current = timing || {
        turnId: requestId,
        finalTranscriptAt: performance.now(),
      };
      playback.current = {
        requestId,
        started: false,
        terminal: false,
        quick: false,
      };
    } else if (playback.current) {
      playback.current.quick = false;
    }
    if (metric.current) {
      metric.current.requestAt = performance.now();
      saveMetric();
    }
    e.firstChunk = true;
    e.generating = true;
    const turnId = resumeQuick ? e.id : ++e.id;
    setError("");
    setPhase("thinking");
    if (!resumeQuick)
      setTurns((rows) => [
        ...rows,
        { id: -turnId, role: "user", text: value },
        { id: turnId, role: "assistant", text: "", state: "generating" },
      ]);
    else
      setTurns((rows) =>
        rows.map((t) =>
          t.id === turnId
            ? { ...t, text: "", state: "generating", responseId: undefined }
            : t,
        ),
      );
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90000);
    let completed = false,
      reply = "";
    let quickHandled = false;
    let fallback = false;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message: value,
          preparation: prepared,
          requestId,
          callId: e.callId,
          quickResponses: e.quickEnabled,
          readyAudioKeys: streamPlayer.current?.readyKeys() || [],
          resumeQuick,
          conversationId: e.conversation,
          temporary: e.temporary,
          voice: true,
          language: e.language,
          replyStyle: "Adaptive",
          voiceHistory: e.temporary
            ? turnsRef.current
                .filter(
                  (t) =>
                    t.text &&
                    (t.role === "user" ||
                      t.state === "completed" ||
                      t.state === "interrupted"),
                )
                .slice(-20)
                .map((t) => ({
                  role: t.role,
                  text: t.text,
                  responseId: t.responseId,
                  playbackState: t.state,
                }))
            : [],
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Could not send your message.");
      }
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const chunk = await reader.read();
        if (e.epoch !== epoch || !e.active) {
          await reader.cancel();
          return;
        }
        buffer += decoder.decode(chunk.value || new Uint8Array(), {
          stream: !chunk.done,
        });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        if (chunk.done && buffer.trim()) {
          lines.push(buffer);
          buffer = "";
        }
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.type === "meta" && event.conversationId) {
            e.conversation = event.conversationId;
            setCid(event.conversationId);
          }
          if (event.type === "route") {
            if (metric.current) {
              Object.assign(metric.current, {
                routerMs: event.routerMs,
                path: event.path,
                responseId: event.responseId,
                intent: event.intent,
                cacheHit: event.cacheHit,
                fallbackReason: event.reason,
              });
              saveMetric();
            }
            if (event.warmAsset)
              void streamPlayer.current?.preload([event.warmAsset]);
          }
          if (event.type === "quick") {
            quickHandled = true;
            reply = event.text;
            if (playback.current) playback.current.quick = true;
            if (metric.current) {
              metric.current.assetReadyAt =
                streamPlayer.current?.readyAt(event.assetKey) ||
                performance.now();
              metric.current.playbackRequestedAt = performance.now();
              saveMetric();
            }
            setTurns((rows) =>
              rows.map((t) =>
                t.id === turnId
                  ? { ...t, text: event.text, responseId: event.responseId }
                  : t,
              ),
            );
            captions.current?.cancel();
            setSubtitle("");
            setCaptionRole("assistant");
            const playerController = new AbortController();
            speechRequest.current = playerController;
            e.speaking = true;
            watchdog.current = setTimeout(
              () => playerController.abort(),
              15000,
            );
            try {
              await streamPlayer.current!.playCached(
                event.assetKey,
                playerController.signal,
                () => {
                  if (e.active && e.epoch === epoch) {
                    captions.current?.start(event.text);
                    if (watchdog.current) clearTimeout(watchdog.current);
                    watchdog.current = setTimeout(
                      () => playerController.abort(),
                      120000,
                    );
                    playbackStatus("started");
                    setPhase("speaking");
                  }
                },
                (seconds, duration) => { if (e.active && e.epoch === epoch) captions.current?.progress(seconds, duration); },
              );
              if (e.active && e.epoch === epoch) {
                captions.current?.finish();
                if (watchdog.current) clearTimeout(watchdog.current);
                e.speaking = false;
              }
            } catch {
              if (!e.active || e.epoch !== epoch) return;
              captions.current?.cancel();
              e.speaking = false;
              if (watchdog.current) clearTimeout(watchdog.current);
              if (!playback.current?.started) {
                fallback = true;
                break;
              }
              playbackStatus("interrupted");
              e.audioBlocked = true;
              setError("The reply stopped playing. Tap Speak to continue.");
            }
          }
          if (event.type === "preparation" && metric.current) {
            metric.current.prepared = event.reused === true;
            saveMetric();
          }
          if (event.type === "delta" && !quickHandled) {
            reply += event.text;
            e.pending += event.text;
            const replySnapshot = reply;
            setTurns((rows) =>
              rows.map((t) =>
                t.id === turnId ? { ...t, text: replySnapshot } : t,
              ),
            );
            const chunks = takeSpeech(e.pending, false, e.firstChunk);
            e.pending = chunks.rest;
            if (chunks.sentences.length) e.firstChunk = false;
            e.queue.push(...chunks.sentences);
            playNext();
            prefetchNextPhrase();
          }
          if (event.type === "error") setError(event.error);
          if (event.type === "done") completed = event.state === "completed";
        }
        if (fallback) {
          await reader.cancel();
          break;
        }
        if (chunk.done) break;
      }
      if (fallback) {
        e.generating = false;
        request.current = null;
        clearTimeout(timeout);
        if (e.active && e.epoch === epoch)
          await send(value, requestId, timing, true);
        return;
      }
      if (!completed)
        throw new Error("The reply did not finish. You can try again.");
      if (!quickHandled) e.queue.push(...takeSpeech(e.pending, true).sentences);
      e.pending = "";
      setTurns((rows) =>
        rows.map((t) =>
          t.id === turnId
            ? {
                ...t,
                state: playback.current?.terminal ? "interrupted" : "completed",
              }
            : t,
        ),
      );
    } catch (err) {
      if (e.epoch !== epoch || !e.active) return;
      captions.current?.cancel();
      playbackStatus("failed");
      setError(
        controller.signal.aborted
          ? "The connection timed out. Tap Speak to try again."
          : (err as Error).message,
      );
      e.queue = [];
      e.pending = "";
      window.speechSynthesis?.cancel();
      e.speaking = false;
      prefetchedSpeech.current?.controller.abort();
      prefetchedSpeech.current = null;
      speechRequest.current?.abort();
      speechRequest.current = null;
      audio.current?.pause();
      audio.current = null;
      if (audioUrl.current) {
        URL.revokeObjectURL(audioUrl.current);
        audioUrl.current = "";
      }
      if (watchdog.current) clearTimeout(watchdog.current);
      setTurns((rows) =>
        rows.map((t) => (t.id === turnId ? { ...t, state: "failed" } : t)),
      );
    } finally {
      clearTimeout(timeout);
      if (!fallback && e.epoch === epoch && e.active) {
        e.generating = false;
        request.current = null;
        if (completed && !e.audioBlocked) playNext();
        else setPhase("paused");
      }
    }
  }
  async function start() {
    const e = engine.current;
    if (e.active || !ready || !supported) return;
    e.active = true;
    e.temporary = temporary;
    e.language = language;
    e.provider = provider;
    e.muted = false;
    e.character = characterId(listener);
    e.callId = crypto.randomUUID();
    e.quickEnabled = quickConfig.current.enabled && provider === "cartesia";
    e.streaming = quickConfig.current.streaming;
    preparation.current?.cancel();
    preparation.current = quickConfig.current.speculative
      ? new VoicePrepareClient(() => ({
          callId: e.callId,
          conversationId: e.conversation,
          temporary: e.temporary,
          language: e.language,
          voiceHistory: e.temporary
            ? turnsRef.current
                .filter(
                  (t) =>
                    t.text &&
                    (t.role === "user" ||
                      t.state === "completed" ||
                      t.state === "interrupted"),
                )
                .slice(-20)
                .map((t) => ({
                  role: t.role,
                  text: t.text,
                  responseId: t.responseId,
                  playbackState: t.state,
                }))
            : [],
        }))
      : null;
    turnGuard.current.clear();
    fixedVoice.current = window.speechSynthesis
      ? chooseVoice(
          window.speechSynthesis.getVoices(),
          language,
          "",
          characterId(listener),
        )
      : undefined;
    setError("");
    setPhase("paused");
    let mic: SilentMicrophone | RealtimeMicrophone = quickConfig.current
      .realtime
      ? new RealtimeMicrophone()
      : new SilentMicrophone();
    microphone.current = mic;
    const player = new VoiceAudioPlayer();
    streamPlayer.current = player;
    try {
      await player.open();
      if (e.quickEnabled)
        void player.preload(
          quickConfig.current.assets.filter((a) => a.preload),
        );
      try {
        await mic.open();
      } catch (error) {
        if (!(mic instanceof RealtimeMicrophone) || !e.active) throw error;
        mic.close();
        mic = new SilentMicrophone();
        microphone.current = mic;
        await mic.open();
      }
      if (!e.active) {
        mic.close();
        return;
      }
      listen();
    } catch {
      mic.close();
      player.close();
      if (!e.active) return;
      e.active = false;
      setPhase("ready");
      setError(
        "Microphone access is required. Allow it in your browser settings and try again.",
      );
    }
  }
  function interrupt() {
    stopOutput();
    setError("");
    setSubtitle("");
    setPhase("paused");
    listen();
  }
  function hangup() {
    engine.current.active = false;
    stopOutput();
    streamPlayer.current?.close();
    streamPlayer.current = null;
    microphone.current?.close();
    microphone.current = null;
    setSubtitle("");
    setPhase("ended");
  }
  async function reloadMemory() {
    if (!cid) return;
    try {
      setMemoryError("");
      setMemories(
        await api<MemoryResult>(
          `voice/memories?conversation=${encodeURIComponent(cid)}`,
        ),
      );
    } catch (e) {
      setMemoryError((e as Error).message);
    }
  }
  async function changeMemory(id: string, text?: string) {
    setSaving(true);
    try {
      await api(
        "memories/" + id,
        text === undefined ? "DELETE" : "PATCH",
        text === undefined ? undefined : { text },
      );
      setEditing(null);
      await reloadMemory();
    } catch (e) {
      await reloadMemory();
      setMemoryError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const memoryDisabled = temporary || p.memoryMode !== "automatic";
  return (
    <main className="voice-page cloud-voice-page" data-chat-theme={appearance.chatTheme} data-chat-mode={appearance.chatMode}>
      <ChatBackdrop theme={appearance.chatTheme} mode={appearance.chatMode} />
      <header className="voice-header">
        <Link
          href="/talk"
          onClick={() => {
            engine.current.active = false;
            stopOutput();
            streamPlayer.current?.close();
            streamPlayer.current = null;
            microphone.current?.close();
          }}
        >
          <ArrowLeft size={20} /> Chat
        </Link>
        <span>MILO · VOICE COMPANION</span>
        <span className="voice-clock">
          {Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0")}
          :{(seconds % 60).toString().padStart(2, "0")}
        </span>
      </header>
      <section
        className={`voice-stage voice-${phase}`}
        aria-label={`${listener.name}, fictional AI companion`}
      >
        <CloudCallScene avatar={listenerAvatar(listener)} ended={phase === "ended"} />
        <div className="voice-identity">
          <span className="voice-pill">
            {demo ? "FICTIONAL DEMO" : "AI LISTENER"}
          </span>
          <h1>{listener.name}</h1>
          <p role="status">{phase === "ended" && !callSettled ? "Putting the phone down…" : status}</p>
        </div>
        <div className="voice-wave" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ animationDelay: `${i * 0.09}s` }} />
          ))}
        </div>
        {subtitle && (
          <div className="voice-caption" aria-live="polite">
            <small>{captionRole === "user" ? "YOU" : listener.name}</small>
            <p>{subtitle}</p>
          </div>
        )}
      </section>
      {phase === "ready" ? (
        <section className="voice-setup">
          <button
            className="button primary"
            onClick={() => void start()}
            disabled={!ready || !supported}
          >
            <Phone size={19} /> {ready ? "Start call" : "Preparing call…"}
          </button>
          <p className="voice-disclosure">
            Your microphone turns on when you start and stays on until you end
            the call.{" "}
            {temporary
              ? "Temporary call: no saved conversation or Memory."
              : "Your conversation follows your Memory settings."}{" "}
            <Link href="/space/privacy">Privacy</Link>
          </p>
          {!supported && (
            <p>
              This browser cannot access the microphone. Open this page in
              Safari or Chrome over HTTPS.
            </p>
          )}
        </section>
      ) : phase !== "ended" ? (
        <div className="voice-controls">
          <button
            onClick={() => {
              const e = engine.current;
              if (phase === "listening") {
                e.muted = true;
                microphone.current?.pause();
                setPhase("paused");
              } else {
                e.muted = false;
                if (e.generating || e.speaking || e.transcribing) interrupt();
                else listen();
              }
            }}
          >
            <span>{phase === "listening" ? <MicOff /> : <Mic />}</span>
            {phase === "listening" ? "Mute" : "Speak"}
          </button>
          <button
            onClick={interrupt}
            disabled={phase !== "thinking" && phase !== "speaking"}
          >
            <span>
              <Square />
            </span>
            Interrupt
          </button>
          <button className="voice-hangup" onClick={hangup}>
            <span>
              <PhoneOff />
            </span>
            End call
          </button>
        </div>
      ) : (
        <section className="voice-summary" hidden={!callSettled}>
          <h2>A little to take with you</h2>
          <p>Your call has ended. The microphone and voice playback are off.</p>
          <div className="voice-memory">
            <h3>
              <Shield size={19} /> This call’s Memory
            </h3>
            {memoryDisabled ? (
              <p>
                {temporary
                  ? "Temporary call: no transcript or long-term memories were saved by Milo."
                  : "Automatic memory is off. No memories were extracted from this call."}
              </p>
            ) : !cid ? (
              <p>
                {turns.some((t) => t.role === "user")
                  ? "The call ended before a save acknowledgement arrived. Check chat history for messages already received by the server."
                  : "No messages were sent, so there are no new memories."}
              </p>
            ) : (
              <>
                {!memories && !memoryError && (
                  <p>Checking memory processing…</p>
                )}
                {!!memories?.pending && (
                  <p role="status">
                    Organizing memories… {memories.pending} message(s) pending.
                    You can leave and check Memory later.
                  </p>
                )}
                {!!memories?.failed && (
                  <p role="alert">
                    Some memory jobs need attention. Your conversation remains
                    available.
                  </p>
                )}
                {memories && !memories.pending && !memories.items.length && (
                  <p>
                    No new memories from this call. Not everything you share
                    needs to become a memory.
                  </p>
                )}
                {memories?.items.map((m) => (
                  <article className="voice-memory-item" key={m.id}>
                    {editing === m.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void changeMemory(m.id, editText.trim());
                        }}
                      >
                        <textarea
                          aria-label="Correct memory"
                          value={editText}
                          maxLength={10000}
                          onChange={(e) => setEditText(e.target.value)}
                        />
                        <button
                          className="button small"
                          disabled={saving || !editText.trim()}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <p>{m.text}</p>
                        <button
                          className="text-button"
                          disabled={saving}
                          onClick={() => {
                            setEditing(m.id);
                            setEditText(m.text);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="text-button"
                          disabled={saving}
                          onClick={() => void changeMemory(m.id)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </article>
                ))}
                <button
                  className="text-button"
                  onClick={() => void reloadMemory()}
                >
                  <RefreshCw size={15} /> Refresh Memory
                </button>
              </>
            )}
            {memoryError && <p role="alert">{memoryError}</p>}
            <Link href="/space/memories">View all Memory →</Link>
          </div>
          <Link className="button primary" href="/talk">
            Return to chat
          </Link>
        </section>
      )}
      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
      {phase === "ended" && callSettled && !!turns.length && (
        <details className="voice-transcript">
          <summary>
            Call transcript · {temporary ? "not saved" : "private"}
          </summary>
          {turns.map((t) => (
            <div key={t.id} className={`voice-turn ${t.role}`}>
              <small>
                {t.role === "user" ? "YOU" : listener.name}
                {t.state === "interrupted"
                  ? " · INTERRUPTED"
                  : t.state === "failed"
                    ? " · INCOMPLETE"
                    : ""}
              </small>
              <p>
                {t.text ||
                  (t.state === "interrupted"
                    ? "Reply interrupted before any words were received."
                    : "…")}
              </p>
            </div>
          ))}
        </details>
      )}
    </main>
  );
}
