"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { CircleHelp, Pencil } from "lucide-react";
import { Companion } from "./illustrations";
import MiloBrand from "./milo-brand";

export default function HomeRoom({ avatar, name, onHelp }: { avatar: string; name: string; onHelp: () => void }) {
  const id = useId();
  const [petting, setPetting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  function pet() {
    if (timer.current) return;
    setPetting(true);
    timer.current = setTimeout(() => { setPetting(false); timer.current = null; }, 1500);
  }
  return <section className="m-room cozy-room" aria-label={`${name}'s cozy room`}>
    <svg className="cozy-room-art" viewBox="0 0 480 360" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-wall`} x1="60" y1="0" x2="400" y2="300" gradientUnits="userSpaceOnUse"><stop stopColor="#fbf5e9" /><stop offset="1" stopColor="#f1e7d9" /></linearGradient>
        <linearGradient id={`${id}-sky`} x1="130" y1="66" x2="130" y2="216" gradientUnits="userSpaceOnUse"><stop stopColor="#e2e9d9" /><stop offset="1" stopColor="#faf5df" /></linearGradient>
        <linearGradient id={`${id}-floor`} x1="240" y1="245" x2="240" y2="360" gradientUnits="userSpaceOnUse"><stop stopColor="#e8d9c3" /><stop offset="1" stopColor="#f5ecdf" /></linearGradient>
        <linearGradient id={`${id}-sun`} x1="110" y1="210" x2="295" y2="350" gradientUnits="userSpaceOnUse"><stop stopColor="#fff9df" stopOpacity=".65" /><stop offset="1" stopColor="#fff9df" stopOpacity="0" /></linearGradient>
      </defs>
      <path d="M0 0H480V260H0Z" fill={`url(#${id}-wall)`} />
      <path d="M0 250H480V360H0Z" fill={`url(#${id}-floor)`} />
      <path d="M0 249H480" stroke="#d9cab6" strokeWidth="5" />
      <path d="M0 246H480" stroke="#fff8ed" strokeWidth="2" />
      <path d="M82 215L182 211L370 360H80Z" fill={`url(#${id}-sun)`} />
      <path d="M62 218V122C62 34 204 34 204 122V218Z" fill="#dfcfb9" />
      <path d="M71 209V122C71 46 195 46 195 122V209Z" fill={`url(#${id}-sky)`} />
      <path d="M74 185Q96 163 122 185Q152 151 193 181V209H74Z" fill="#c3cfb4" opacity=".65" />
      <path d="M133 63V209M71 134H195" stroke="#fdf7ed" strokeWidth="6" />
      <path d="M59 217H207" stroke="#cbb99f" strokeWidth="8" strokeLinecap="round" />
      <path d="M55 220H211" stroke="#e8dbca" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="284" cy="310" rx="161" ry="31" fill="#d7c6af" opacity=".2" />
      <ellipse cx="284" cy="303" rx="161" ry="31" fill="#e9ddd0" />
      <ellipse cx="284" cy="301" rx="150" ry="25" stroke="#d5c6b5" strokeWidth="1.5" />
      <path d="M251 279L247 298M400 279L405 298" stroke="#a88d73" strokeWidth="9" strokeLinecap="round" />
      <rect x="242" y="195" width="168" height="88" rx="35" fill="#c9b9a3" />
      <rect x="253" y="202" width="146" height="65" rx="29" fill="#e0cdb7" />
      <path d="M275 251Q322 242 378 250V271H275Z" fill="#f1ddc5" />
      <rect x="235" y="245" width="28" height="42" rx="14" fill="#c9b9a3" />
      <rect x="390" y="245" width="28" height="42" rx="14" fill="#c9b9a3" />
      <path d="M347 266H390V287Q375 300 347 289Z" fill="#d3a995" />
      <path d="M356 274V288M366 274V292M376 274V292" stroke="#e8c7b2" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="81" cy="295" rx="31" ry="6" fill="#c3b29b" opacity=".24" />
      <path d="M81 262V185M81 224Q47 221 48 192Q78 190 81 224M81 211Q109 208 110 181Q82 179 81 211M81 245Q56 243 54 222Q78 222 81 245" stroke="#879773" strokeWidth="3" strokeLinecap="round" fill="#a2af8b" />
      <path d="M58 256H104L98 290Q81 297 64 290Z" fill="#c9957b" />
      <path d="M57 257H105" stroke="#d9ac91" strokeWidth="6" strokeLinecap="round" />
      <path d="M138 280L133 305M197 280L202 305" stroke="#b59978" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="168" cy="277" rx="42" ry="10" fill="#c5a784" />
      <ellipse cx="168" cy="274" rx="42" ry="10" fill="#e3c8a5" />
      <path d="M151 252H171V268Q161 277 151 268Z" fill="#fff9ee" /><path d="M171 256Q187 254 179 265H171" stroke="#fff9ee" strokeWidth="4" />
      <path className="cozy-cup-steam" d="M160 244Q155 238 161 233" stroke="#beac92" strokeWidth="2" strokeLinecap="round" />
    </svg>
    <div className="cozy-room-brand"><MiloBrand /></div>
    <button type="button" className="m-room-notice" aria-label="About this space" onClick={onHelp}><CircleHelp size={21} /></button>
    <button type="button" className="m-room-listener cozy-room-cat" data-petting={petting} onClick={pet} aria-label={`Pet ${name}`}>
      <Companion type={avatar} large />
      <HeartMark active={petting} />
    </button>
    <Link href="/listener" className="cozy-room-customize" aria-label={`Customize ${name}`}><span>{name}</span><Pencil size={12} /></Link>
  </section>;
}

function HeartMark({ active }: { active: boolean }) {
  return <svg className="cozy-pet-heart" data-active={active} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21C-5 10 5-2 12 6C19-2 29 10 12 21Z" fill="#c98f7e" /></svg>;
}
