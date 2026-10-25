"use client";
import { useEffect, useState } from "react";
import { Companion } from "./illustrations";

export default function CloudCallScene({ avatar, ended }: { avatar: string; ended: boolean }) {
  const [seated, setSeated] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSeated(true), 120);
    return () => clearTimeout(timer);
  }, []);
  return <div className="cloud-call-scene" data-seated={seated} data-ended={ended}>
    <svg className="voice-cloud-art" viewBox="0 0 480 360" fill="none" aria-hidden="true">
      <ellipse cx="242" cy="315" rx="154" ry="13" fill="#85869f" opacity=".1" />
      <path d="M89 273C52 237 86 195 125 212C135 169 192 170 208 202C230 177 270 182 283 213C311 178 364 196 365 228C417 211 443 263 408 282C381 299 123 304 89 273Z" fill="#fffaf1" />
      <path d="M107 268Q159 252 201 272Q249 288 295 268Q343 253 396 272" stroke="#d7cbbd" strokeWidth="2" opacity=".6" />
      <path d="M64 129L68 140L80 144L68 148L64 160L60 148L48 144L60 140Z" fill="#ebd19e" opacity=".8" />
      <path d="M400 89L403 98L413 102L403 105L400 115L397 105L387 102L397 98Z" fill="#e4c693" opacity=".8" />
      <circle cx="101" cy="81" r="3" fill="#d9c6a8" /><circle cx="364" cy="162" r="2.5" fill="#d9c6a8" />
    </svg>
    <div className="cloud-call-cat"><Companion type={avatar} pose="call" large /></div>
  </div>;
}
