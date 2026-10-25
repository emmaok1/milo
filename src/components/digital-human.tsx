"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Volume2, VolumeX, Square } from "lucide-react";

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export default function DigitalHuman({ busy, reply, onSend, onInterrupt }: {
  busy: boolean; reply: { id: number; text: string } | null;
  onSend: (text: string) => void; onInterrupt: () => void;
}) {
  const [config, setConfig] = useState<{ configured: boolean; image: string } | null>(null);
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const cancelled = useRef(false);
  const startY = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const send = useRef(onSend);
  useEffect(() => { send.current = onSend; }, [onSend]);
  useEffect(() => {
    const w = window as SpeechWindow;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    const controller = new AbortController();
    fetch("/api/avatar", { signal: controller.signal }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setConfig(data);
    }).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => { cancelled.current = true; controller.abort(); recognition.current?.abort(); request.current?.abort(); if (timer.current) clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    if (!reply || !config?.configured) return;
    const controller = new AbortController();
    request.current?.abort(); request.current = controller;
    setPreparing(true); setError(""); setUrl(""); setSubtitle(reply.text);
    async function generate() {
      try {
        const res = await fetch("/api/avatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: reply!.text }), signal: controller.signal });
        const job = await res.json();
        if (!res.ok) throw new Error(job.error);
        const deadline = Date.now() + 150000;
        while (!controller.signal.aborted && Date.now() < deadline) {
          const res = await fetch(`/api/avatar?token=${encodeURIComponent(job.token)}`, { signal: controller.signal });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error);
          if (result.url) { setUrl(result.url); return; }
          await new Promise<void>((resolve, reject) => {
            const abort = () => { clearTimeout(timeout); reject(new DOMException("Aborted", "AbortError")); };
            const timeout = setTimeout(() => { controller.signal.removeEventListener("abort", abort); resolve(); }, 2000);
            controller.signal.addEventListener("abort", abort, { once: true });
          });
        }
        if (!controller.signal.aborted) throw new Error("Avatar generation timed out. Please continue in text chat.");
      } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
      finally { if (!controller.signal.aborted) setPreparing(false); }
    }
    void generate();
    return () => controller.abort();
  }, [reply, config?.configured]);
  useEffect(() => {
    if (busy) {
      request.current?.abort(); video.current?.pause();
      setUrl(""); setSpeaking(false); setPreparing(false); setSubtitle("");
    }
  }, [busy]);
  function stopPlayback() {
    request.current?.abort(); video.current?.pause(); setUrl(""); setPreparing(false); setSpeaking(false);
  }
  function finish(cancel = false) {
    cancelled.current = cancel;
    if (timer.current) clearTimeout(timer.current);
    if (cancel) recognition.current?.abort(); else recognition.current?.stop();
    setListening(false);
  }
  function start() {
    if (recognition.current) return;
    stopPlayback(); onInterrupt(); setError(""); setTranscript(""); cancelled.current = false;
    const w = window as SpeechWindow;
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor) return;
    const r = new Constructor(); recognition.current = r;
    r.lang = "en-US"; r.continuous = true; r.interimResults = true;
    let finalText = "";
    r.onresult = event => {
      let current = ""; finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        current += event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      }
      setTranscript(current);
    };
    r.onerror = event => { cancelled.current = true; if (event.error !== "aborted") setError(event.error === "not-allowed" ? "Allow microphone access, or type below." : "Speech recognition failed. Please retry or type instead."); };
    r.onend = () => {
      recognition.current = null; setListening(false);
      if (timer.current) clearTimeout(timer.current);
      if (!cancelled.current && finalText.trim()) send.current(finalText.trim());
      else if (!cancelled.current) setError("No speech detected. Please try again.");
    };
    try { r.start(); setListening(true); timer.current = setTimeout(() => finish(), 60000); }
    catch { recognition.current = null; setListening(false); setError("Could not start the microphone. Please type instead."); }
  }
  const status = listening ? "Listening to you" : busy ? "Thinking" : preparing ? "Preparing voice and animation…" : speaking ? "Speaking" : "Take your time. I’m here.";
  return <section className="digital-human" aria-label="Photo avatar voice chat">
    <div className="human-stage">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {config?.image && <img src={config.image} alt="Photorealistic AI avatar" className="human-portrait" />}
      {url && <video ref={video} src={url} autoPlay playsInline muted={muted} controls onPlay={() => setSpeaking(true)} onPause={() => setSpeaking(false)} onEnded={() => setSpeaking(false)} onError={() => setError("Video playback failed. Your text reply is still available.")} onLoadedData={() => { video.current?.play().catch(() => setError("Tap Play to hear the reply.")); }} />}
      <div className="human-top"><span>MILO · AI AVATAR</span><button onClick={() => setMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"}>{muted ? <VolumeX size={19}/> : <Volume2 size={19}/>}</button></div>
      <div className="human-caption"><span className={"human-status " + (listening || speaking ? "active" : "")}>{status}</span><p aria-live="polite">{listening ? transcript || "Release to send · swipe up to cancel" : subtitle || "What would you like to talk about today?"}</p></div>
    </div>
    <div className="human-controls">
      <button className={"hold-to-talk " + (listening ? "recording" : "")} disabled={!supported || busy}
        onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); startY.current = e.clientY; start(); }}
        onPointerUp={e => finish(startY.current - e.clientY > 70)} onPointerCancel={() => finish(true)}
        onKeyDown={e => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); start(); } }}
        onKeyUp={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); finish(); } }}
        onBlur={() => { if (recognition.current) finish(true); }} onContextMenu={e => e.preventDefault()}>
        <Mic size={21}/>{listening ? "Release to send · swipe up to cancel" : "Hold to speak"}
      </button>
      {(speaking || preparing) && <button className="text-button" onClick={stopPlayback}><Square size={14}/>Stop reply</button>}
      <small>Release to send · up to 60 seconds · or type below</small>
      {!supported && <small>Speech recognition is unavailable. Try a supported browser or type instead.</small>}
      {config && !config.configured && <small>Photo avatar voice is not configured. Text chat remains available.</small>}
      <small>Speech recognition uses your browser provider; replies are sent to the avatar provider to generate video.</small>
      {error && <p className="human-error" role="alert">{error}</p>}
    </div>
  </section>;
}
