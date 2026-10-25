"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Phone, X } from "lucide-react";
import { Companion } from "./illustrations";

export default function ChatCallInvite({ avatar }: { avatar: string }) {
  const [phase, setPhase] = useState<"open" | "closing" | "closed">("open");
  const [holding, setHolding] = useState(false);
  const router = useRouter();
  useEffect(() => {
    if (phase !== "open" || holding) return;
    const timer = setTimeout(() => setPhase("closing"), 4500);
    return () => clearTimeout(timer);
  }, [phase, holding]);
  useEffect(() => {
    if (phase !== "closing") return;
    const timer = setTimeout(() => setPhase("closed"), 550);
    return () => clearTimeout(timer);
  }, [phase]);
  return <div className={`m-call-invite call-invite-${phase}`}
    onMouseEnter={() => setHolding(true)} onMouseLeave={() => setHolding(false)}
    onFocusCapture={() => setHolding(true)}
    onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHolding(false); }}
    onKeyDown={event => { if (event.key === "Escape") { setPhase("closing"); event.currentTarget.querySelector<HTMLButtonElement>(".m-call-cat")?.focus(); } }}>
    <button type="button" className="m-companion-help m-call-cat" aria-label="Start a voice call" aria-expanded={phase !== "closed"} onClick={() => router.push("/call")}>
      {phase === "closed" ? <Phone className="chat-phone-symbol" size={23} aria-hidden="true" /> : <>
        <svg className="call-cat-cloud" viewBox="0 0 100 35" aria-hidden="true"><path d="M9 32C-7 25 0 9 16 13C16-3 42-3 47 11C59 0 75 6 76 17C97 8 109 30 88 32Z" fill="#fffdf7" /></svg>
        <Companion type={avatar} pose="call" />
      </>}
    </button>
    {phase !== "closed" && <div className="m-call-bubble">
      <Link href="/call"><Phone size={17} aria-hidden="true" /><span>Wanna have a voice call?</span></Link>
      <button type="button" aria-label="Dismiss voice invitation" onClick={() => setPhase("closing")}><X size={14} /></button>
    </div>}
  </div>;
}
