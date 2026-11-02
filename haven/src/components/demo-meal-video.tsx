"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";
export default function DemoMealVideo({
  name,
  onLeave,
}: {
  name: string;
  onLeave: () => void;
}) {
  const [camera, setCamera] = useState(false),
    [muted, setMuted] = useState(true),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function toggleCamera() {
    if (stream.current) {
      generation.current++;
      stream.current.getTracks().forEach((t) => t.stop());
      stream.current = null;
      setCamera(false);
      return;
    }
    const epoch = ++generation.current;
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      if (epoch !== generation.current) {
        next.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = next;
      setCamera(true);
      setError("");
      if (video.current) {
        video.current.srcObject = next;
        await video.current.play();
      }
    } catch {
      setError("Camera preview isn't available.");
    }
  }
  return (
    <div className="f-demo-video">
      <div className="f-demo-video-label">
        <i />
        Demo preview · No live connection
      </div>
      <div className="f-video-tile nina">
        <span className="f-video-avatar">N</span>
        <div className="f-video-person">
          <MicOff size={13} /> Nina
        </div>
        <span className="f-video-tile-tag">Demo participant</span>
      </div>
      <div className="f-video-tile self">
        <video ref={video} autoPlay playsInline muted hidden={!camera} />
        {!camera && (
          <span className="f-video-avatar">{name.charAt(0).toUpperCase()}</span>
        )}
        <div className="f-video-person">
          {muted ? <MicOff size={13} /> : <Mic size={13} />} {name} · You
        </div>
      </div>
      <div className="f-video-controls">
        <button
          aria-label={muted ? "Unmute preview" : "Mute preview"}
          aria-pressed={!muted}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <MicOff /> : <Mic />}
        </button>
        <button
          aria-label={camera ? "Turn camera off" : "Preview your camera"}
          aria-pressed={camera}
          onClick={() => void toggleCamera()}
        >
          {camera ? <Video /> : <VideoOff />}
        </button>
        <button className="leave" aria-label="Leave preview" onClick={onLeave}>
          <PhoneOff />
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
