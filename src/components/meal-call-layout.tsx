"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, VolumeX, RotateCcw, SwitchCamera, Minimize2, Maximize2, ArrowUpDown } from "lucide-react";
import { friendColor, friendInitial } from "@/lib/friends-ui";

export type MealParticipant = {
  id: string; name: string; local: boolean;
  videoOn: boolean; audioOn: boolean;
  videoTrack?: MediaStreamTrack; audioTrack?: MediaStreamTrack;
};
function MealTile({ person, soundOn }: { person: MealParticipant; soundOn: boolean }) {
  const video = useRef<HTMLVideoElement>(null), audio = useRef<HTMLAudioElement>(null);
  const [soundBlocked, setSoundBlocked] = useState(false);
  useEffect(() => {
    const element = video.current;
    if (!element || !person.videoTrack) return;
    element.srcObject = new MediaStream([person.videoTrack]);
    void element.play().catch(() => {});
    return () => { element.pause();element.srcObject = null; };
  }, [person.videoTrack]);
  useEffect(() => {
    const element = audio.current;
    if (!element || !person.audioTrack || person.local) { setSoundBlocked(false);return; }
    let active = true;
    element.srcObject = new MediaStream([person.audioTrack]);
    void element.play().then(() => { if(active)setSoundBlocked(false); }).catch(() => { if(active)setSoundBlocked(true); });
    return () => { active=false;element.pause();element.srcObject=null; };
  }, [person.audioTrack, person.local]);
  return <div className={`meal-person-tile ${person.local ? "meal-person-local" : "meal-person-remote"}`} data-person={person.id}>
    <video ref={video} autoPlay playsInline muted hidden={!person.videoOn || !person.videoTrack} />
    {(!person.videoOn || !person.videoTrack) && <div className="meal-person-placeholder"><span style={{ background: friendColor(person.id) }}>{friendInitial(person.name)}</span><small>Camera off</small></div>}
    {!person.local && <audio ref={audio} autoPlay muted={!soundOn} />}
    <span className="meal-person-name">{!person.audioOn && <MicOff size={13} />}<span>{person.local ? "You" : person.name}</span></span>
    {soundBlocked && <button type="button" className="meal-enable-sound" onClick={() => { void audio.current?.play().then(()=>setSoundBlocked(false)).catch(()=>setSoundBlocked(true)); }}><Volume2 size={15} /> Enable sound</button>}
  </div>;
}
export default function MealCallLayout({ participants, connection, busy=false, preview=false, error, onAudio, onVideo, onLeave, onRetry, onFlip }: {
  participants: MealParticipant[]; connection: "connecting" | "connected" | "failed";
  busy?: boolean; preview?: boolean; error?: string;
  onAudio: () => void; onVideo: () => void; onLeave: () => void; onRetry?: () => void; onFlip?: () => Promise<void>;
}) {
  const [minimized, setMinimized] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [flipError, setFlipError] = useState("");
  const self = participants.find(p => p.local);
  const remote = participants.filter(p => !p.local);
  const waiting = remote.length === 0;
  const group = remote.length > 1;
  const live = connection === "connected" && !waiting;
  useEffect(() => {
    if (!live) { setSeconds(0); return; }
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [live]);
  useEffect(() => {
    if (minimized) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [minimized]);
  const duration = `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const status = connection === "failed" ? "Disconnected" : connection === "connecting" ? "Connecting…" : waiting ? "Waiting for friends…" : duration;
  const main = swapped && self && !group ? self : remote[0];
  const small = swapped ? remote[0] : self;
  return <section className="meal-call-layout wx-call" data-minimized={minimized} data-controls={controlsVisible} aria-label="Eat Together video call">
    <div className="wx-stage" onClick={() => { if (minimized) setMinimized(false); else setControlsVisible(v => !v); }}>
      {group ? <div className="wx-group-grid">{[...remote, ...(self ? [self] : [])].map(p => <MealTile key={p.id} person={p} soundOn={soundOn} />)}</div> : <>
        <div className="wx-main-video">{main ? <MealTile key={main.id} person={main} soundOn={soundOn} /> : <div className="wx-waiting"><Video size={48} /><p>{status}</p></div>}</div>
        {small && <div className="wx-small-video">
          <MealTile key={small.id} person={small} soundOn={soundOn} />
          {!waiting && <button className="wx-swap" aria-label="Swap video views" onClick={e => { e.stopPropagation(); setSwapped(v => !v); }}><ArrowUpDown size={16} /></button>}
        </div>}
      </>}
    </div>
    <div className="wx-topbar">
      <button aria-label={minimized ? "Restore video call" : "Minimize video call"} onClick={() => setMinimized(v => !v)}>{minimized ? <Maximize2 /> : <Minimize2 />}</button>
      <span>{preview ? "Preview · No live call" : "Eat Together"}</span>
      <button aria-label="Switch camera" disabled={!onFlip || !self?.videoOn || flipping || connection !== "connected"} onClick={async () => {
        if (!onFlip) return;
        setFlipping(true); setFlipError("");
        try { await onFlip(); } catch { setFlipError("Could not switch camera on this device."); } finally { setFlipping(false); }
      }}><SwitchCamera /></button>
    </div>
    {minimized && <button className="wx-restore" aria-label="Restore video call" onClick={() => setMinimized(false)}><Maximize2 size={18} /><span>{status}</span></button>}
    <div className="wx-bottom-panel">
      <div className="wx-call-status" role="status">{status}</div>
      {(error || flipError) && <p className="wx-error" role="alert">{error || flipError}</p>}
      {connection === "failed" && onRetry && <button className="wx-retry" onClick={onRetry}><RotateCcw size={17} />Reconnect</button>}
      <div className="wx-tools">
        <button disabled={busy || connection !== "connected"} aria-label={self?.audioOn ? "Mute microphone" : "Unmute microphone"} aria-pressed={!self?.audioOn} onClick={onAudio}><span>{self?.audioOn ? <Mic /> : <MicOff />}</span><small>{self?.audioOn ? "Mute" : "Mic off"}</small></button>
        <button disabled={busy || connection !== "connected"} aria-label={self?.videoOn ? "Turn camera off" : "Turn camera on"} aria-pressed={!self?.videoOn} onClick={onVideo}><span>{self?.videoOn ? <Video /> : <VideoOff />}</span><small>{self?.videoOn ? "Camera" : "Camera off"}</small></button>
        <button aria-label={soundOn ? "Mute call sound" : "Enable call sound"} aria-pressed={soundOn} onClick={() => setSoundOn(v => !v)}><span>{soundOn ? <Volume2 /> : <VolumeX />}</span><small>{soundOn ? "Sound on" : "Sound off"}</small></button>
      </div>
      <button className="wx-hangup" aria-label={preview ? "Leave preview" : "End call"} onClick={onLeave}><span><PhoneOff fill="currentColor" /></span><small>End</small></button>
    </div>
  </section>;
}
