"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Volume2 } from "lucide-react";
import MiloBrand from "./milo-brand";
import { Companion } from "./illustrations";
import type { Profile } from "@/lib/types";
import { mobileState, listenerAvatar } from "@/lib/listener-model";
import { api } from "@/lib/client";
import { chooseVoice } from "@/lib/voice";
import {
  welcomeQuestions,
  welcomeSpeech,
  welcomeGreeting,
  type WelcomeAnswers,
} from "@/lib/welcome";

function QuestionPicture({ step, cat }: { step: number; cat: string }) {
  return (
    <div
      className={`welcome-picture welcome-picture-${step}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 340 180" fill="none">
        <ellipse
          cx="170"
          cy="158"
          rx="128"
          ry="10"
          fill="#C9CFBB"
          opacity=".25"
        />
        {step === 1 ? (
          <>
            <path
              d="M57 137Q55 107 94 111H238Q277 109 280 136L263 156H73Z"
              fill="#D5DDC7"
            />
            <path
              d="M61 137Q172 155 275 136"
              stroke="#B5C0A5"
              strokeWidth="2"
            />
            <path
              d="M222 38C209 38 207 19 224 18C230 1 253 5 256 20C278 16 284 39 265 41H222Z"
              fill="#E5DDD5"
            />
            <path d="m78 50 3 7 8 2-8 3-3 7-2-7-8-3 8-2Z" fill="#D9BE82" />
          </>
        ) : step === 2 ? (
          <>
            <path d="M66 112H277L290 128H54Z" fill="#DAC8B6" />
            <path
              d="M77 129V159M269 129V159"
              stroke="#B69C83"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <ellipse
              cx="215"
              cy="111"
              rx="35"
              ry="9"
              fill="#FFFDF8"
              stroke="#C1CAB1"
              strokeWidth="2"
            />
            <ellipse cx="215" cy="110" rx="23" ry="5" fill="#E5E9D9" />
            <path d="M256 88h14v21q-7 9-14 0Z" fill="#C4CFB6" />
            <path d="M270 92q16 0 0 12" stroke="#C4CFB6" strokeWidth="3" />
            <path
              d="M66 60V35m-9 13h18"
              stroke="#D9BE82"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <rect
              x="184"
              y="100"
              width="89"
              height="53"
              rx="22"
              fill="#E6D7CD"
            />
            <path d="M193 112q34-15 70 0" stroke="#CEB9AA" strokeWidth="2" />
            <rect
              x="62"
              y="118"
              width="104"
              height="36"
              rx="18"
              fill="#D5DDC7"
            />
            <path
              d="M171 43c-12-15-30 4 0 21 30-17 12-36 0-21"
              fill="#DDB2BB"
            />
            <path
              d="M283 77V52m-9 12h18"
              stroke="#D9BE82"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      <div className="welcome-scene-cat">
        <Companion type={cat} />
      </div>
    </div>
  );
}
export default function WelcomeHome({
  profile,
  refresh,
}: {
  profile: Profile;
  refresh: () => Promise<void>;
}) {
  const router = useRouter();
  const listener = mobileState(profile.mobile, profile.companion).listener;
  const cat = listenerAvatar(listener);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<WelcomeAnswers>([null, null, null]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsPlay, setNeedsPlay] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [curious, setCurious] = useState(false);
  const [waving, setWaving] = useState(false);
  const [catReaction, setCatReaction] = useState<"tilt" | "nod" | null>(null);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const diningIntroReadyAt = useRef(0);
  function reactCat(reaction: "tilt" | "nod") {
    if (reactionTimer.current || (step === 2 && performance.now() < diningIntroReadyAt.current)) return;
    setCatReaction(reaction);
    reactionTimer.current = setTimeout(() => {
      setCatReaction(null);
      reactionTimer.current = null;
    }, 1100);
  }
  useEffect(() => () => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
  }, []);
  const waveActive = useRef(false),
    waveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wave = useCallback(() => {
    if (waveActive.current) return;
    waveActive.current = true;
    setWaving(true);
    waveTimer.current = setTimeout(() => {
      waveActive.current = false;
      setWaving(false);
    }, 2100);
  }, []);
  const checkinId = useRef(crypto.randomUUID());
  const savingCheckin = useRef(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const stop = useCallback(() => {
    generation.current++;
    if (waveTimer.current) clearTimeout(waveTimer.current);
    waveTimer.current = null;
    waveActive.current = false;
    request.current?.abort();
    request.current = null;
    if (audio.current) {
      audio.current.pause();
      audio.current.removeAttribute("src");
      audio.current.load();
      audio.current = null;
    }
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
    window.speechSynthesis?.cancel();
  }, []);
  const play = useCallback(async () => {
    stop();
    const current = generation.current;
    const controller = new AbortController();
    request.current = controller;
    setNeedsPlay(false);
    setSpeaking(false);
    setWaving(false);
    try {
      const response = await fetch("/api/voice/speech", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: welcomeSpeech(listener.language, step, profile.nickname),
          language: step === 0 ? "en-US" : listener.language,
          character: cat,
          ...(step > 0 ? { style: "checkin" } : {}),
        }),
      });
      if (!response.ok) throw new Error("Speech unavailable");
      const blob = await response.blob();
      if (generation.current !== current) return;
      const url = URL.createObjectURL(blob);
      objectUrl.current = url;
      const player = new Audio(url);
      audio.current = player;
      player.onplaying = () => {
        if (generation.current === current) {
          setSpeaking(true);
          if (step === 1) setCurious(true);
          if (step === 0) wave();
        }
      };
      player.onended = () => {
        if (generation.current === current) setSpeaking(false);
      };
      player.onerror = () => {
        if (generation.current === current) {
          setSpeaking(false);
          setNeedsPlay(true);
        }
      };
      try {
        await player.play();
      } catch {
        if (generation.current === current) setNeedsPlay(true);
      }
    } catch {
      if (generation.current !== current || controller.signal.aborted) return;
      // Device speech is a fallback; never start a microphone or dictation session.
      if (!("speechSynthesis" in window)) {
        setNeedsPlay(true);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(
        welcomeSpeech(listener.language, step, profile.nickname),
      );
      utterance.lang = step === 0 ? "en-US" : listener.language;
      const voice = chooseVoice(
        window.speechSynthesis.getVoices(),
        step === 0 ? "en-US" : listener.language,
        "",
        cat,
      );
      if (voice) utterance.voice = voice;
      utterance.rate = step > 0 ? 0.86 : 0.94;
      utterance.onstart = () => {
        if (generation.current === current) {
          setSpeaking(true);
          if (step === 1) setCurious(true);
          if (step === 0) wave();
        }
      };
      utterance.onend = () => {
        if (generation.current === current) setSpeaking(false);
      };
      utterance.onerror = () => {
        if (generation.current === current) {
          setSpeaking(false);
          setNeedsPlay(true);
        }
      };
      window.speechSynthesis.speak(utterance);
    }
  }, [cat, listener.language, profile.nickname, step, stop, wave]);
  useEffect(() => {
    const eatingIntro = step === 2 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = step === 0 ? 0 : eatingIntro ? 4000 : 550;
    diningIntroReadyAt.current = eatingIntro ? performance.now() + delay : 0;
    const timer = window.setTimeout(() => { void play(); }, delay);
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [play, step, stop]);
  function replay() {
    if (audio.current?.src) {
      setNeedsPlay(false);
      void audio.current.play().catch(() => setNeedsPlay(true));
    } else {
      void play();
    }
  }
  async function advance(skip = false, choice?: string) {
    if (savingCheckin.current) return;
    setCurious(false);
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = null;
    setCatReaction(null);
    stop();
    setSpeaking(false);
    setWaving(false);
    setNeedsPlay(false);
    setError("");
    if (step === 0) {
      setStep(1);
      return;
    }
    const next: WelcomeAnswers = [...answers];
    if (skip) next[step - 1] = null;
    else if (choice) next[step - 1] = choice;
    setAnswers(next);
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    savingCheckin.current = true;
    setBusy(true);
    try {
      await api("mobile", "POST", {
        action: "welcome-checkin",
        value: { id: checkinId.current, answers: next },
      });
      await refresh();
      router.replace(
        next[2] === "Eat with me"
          ? "/friends?mode=digital-meal"
          : next[2] === "Chat with me" ? "/call" : "/home",
      );
    } catch {
      savingCheckin.current = false;
      setError("Couldn’t save. Please try again.");
      setBusy(false);
    }
  }
  const conversational = step > 0;
  const question = step ? welcomeQuestions[step - 1] : null;
  return (
    <main
      className={`welcome-home ${step === 0 ? "welcome-arrival" : "welcome-questions"} ${conversational ? "welcome-feeling" : ""} ${step === 2 ? "welcome-eating" : ""} ${step === 3 ? "welcome-support" : ""} ${speaking ? "is-speaking" : ""} ${step === 0 && waving ? "welcome-is-waving" : ""}`}
    >
      {step === 0 && (
        <>
          <header className="welcome-brand">
            <MiloBrand />
          </header>
          <button
            type="button"
            className="welcome-mascot welcome-interactive-cat"
            onClick={wave}
            aria-label={"Say hello to " + listener.name}
          >
            <Companion type={cat} />
          </button>
        </>
      )}
      {step === 0 ? (
        <section className="welcome-greeting">
          <h1>{welcomeGreeting(profile.nickname)}</h1>
          {needsPlay && (
            <button
              className="welcome-play"
              aria-label="Play welcome"
              onClick={replay}
            >
              <Volume2 size={20} />
            </button>
          )}
          <button className="welcome-continue" onClick={() => void advance()}>
            Continue
          </button>
        </section>
      ) : (
        <section className="welcome-question" key={step}>
          {!conversational && <QuestionPicture step={step} cat={cat} />}
          <div className={conversational ? "welcome-conversation" : undefined}>
          {step === 1 && <svg className="welcome-feeling-scene" viewBox="0 0 420 110" fill="none" aria-hidden="true">
            <ellipse cx="190" cy="89" rx="169" ry="12" fill="#dce1d2" opacity=".45" />
            <path d="M22 64Q20 37 60 40H216Q254 38 258 66L240 86H40Z" fill="#d5ddc7" />
            <path d="M28 66Q139 83 251 65" stroke="#b4c1a5" strokeWidth="2" strokeLinecap="round" />
            <path d="M330 74V45M330 60Q305 60 309 43Q328 41 330 60M330 52Q350 50 347 34Q329 35 330 52" stroke="#9aaa89" strokeWidth="2.5" strokeLinecap="round" fill="#d7dfcb" />
            <path d="M316 72H344L340 91H320Z" fill="#d9c8b6" />
          </svg>}
          {step === 3 && <svg className="welcome-support-scene" viewBox="0 0 420 110" fill="none" aria-hidden="true">
            <ellipse cx="230" cy="91" rx="169" ry="11" fill="#dce1d2" opacity=".45" />
            <path d="M137 62Q139 39 176 42H344Q382 40 385 65L369 86H152Z" fill="#d5ddc7" />
            <path d="M145 66Q260 82 378 65" stroke="#b4c1a5" strokeWidth="2" strokeLinecap="round" />
            <g className="welcome-support-flowers">
              <ellipse cx="76" cy="94" rx="32" ry="5" fill="#c9cfbb" opacity=".3" />
              <path d="M75 67Q69 40 57 25M77 67Q82 34 92 18M76 66L76 33" stroke="#8b9e79" strokeWidth="2" strokeLinecap="round" />
              <path d="M72 54Q50 54 54 39Q69 39 72 54M80 45Q99 46 100 32Q83 30 80 45" fill="#b3c29e" />
              <g fill="#dfb6b4"><circle cx="52" cy="19" r="6" /><circle cx="62" cy="19" r="6" /><circle cx="50" cy="28" r="6" /><circle cx="63" cy="28" r="6" /><circle cx="57" cy="33" r="6" /></g>
              <circle cx="57" cy="25" r="5" fill="#dcc388" />
              <g fill="#eee0bb"><circle cx="88" cy="12" r="5" /><circle cx="97" cy="13" r="5" /><circle cx="99" cy="21" r="5" /><circle cx="90" cy="25" r="5" /><circle cx="85" cy="19" r="5" /></g>
              <circle cx="92" cy="18" r="4" fill="#c8af72" />
              <g fill="#d7c5d9"><circle cx="72" cy="29" r="5" /><circle cx="80" cy="29" r="5" /><circle cx="76" cy="37" r="5" /></g>
              <circle cx="76" cy="32" r="3" fill="#eee0bb" />
              <path d="M60 64Q76 69 92 64L89 87Q77 98 63 87Z" fill="#dac6b3" />
              <ellipse cx="76" cy="64" rx="16" ry="4" fill="#c6af98" />
              <path d="M67 73L69 85" stroke="#eee0d1" strokeWidth="2" strokeLinecap="round" />
            </g>
          </svg>}
          <div className={`welcome-question-title ${conversational ? "welcome-speech-bubble" : ""}`}>
            <h1>{step === 2 ? <><span>How has eating been</span>{" "}<span>for you today?</span></> : question!.question}</h1>
            {step === 1 && <svg className="welcome-feeling-connection" viewBox="0 0 100 140" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M50 1C68 65 40 105 3 137C65 110 90 60 76 1" fill="#fffefa" stroke="#cbd5c1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            {step === 3 && <svg className="welcome-support-connection" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M25 1C20 42 35 73 75 97C52 61 53 30 56 1" fill="#fffefa" stroke="#cbd5c1" strokeWidth="1.5" strokeLinecap="round" /></svg>}
            {step === 2 && <svg className="welcome-bubble-connection" viewBox="0 0 80 60" fill="none" aria-hidden="true"><path d="M8 1C13 25 38 44 71 55C48 32 44 16 44 1" fill="#fffefa" stroke="#c3cdb8" strokeWidth="1.5" strokeLinecap="round" /></svg>}
            {needsPlay && (
              <button
                className="welcome-play"
                aria-label="Read question aloud"
                onClick={replay}
              >
                <Volume2 size={20} />
              </button>
            )}
          </div>
          {conversational && (
            <button
              type="button"
              className="welcome-feeling-cat welcome-picture-1"
              aria-label={`Say hello to ${listener.name}`}
              data-reaction={catReaction ?? "idle"}
              data-curious={step === 1 && curious}
              onClick={() => reactCat("tilt")}
            >
              <Companion type={cat} pose={step === 2 ? "eating" : "idle"} />
            </button>
          )}
          </div>
          <div
            className="welcome-labels"
            role="group"
            aria-label={question!.question}
          >
            {question!.labels.map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={answers[step - 1] === label}
                disabled={busy}
                onClick={() => {
                  if (step === 3 && (label === "Chat with me" || label === "Eat with me")) {
                    void advance(false, label);
                    return;
                  }
                  if (conversational && answers[step - 1] !== label) reactCat("nod");
                  setAnswers((old) => {
                    const next: WelcomeAnswers = [...old];
                    next[step - 1] = next[step - 1] === label ? null : label;
                    return next;
                  });
                }}
              >
                {conversational && <Check className="welcome-option-check" size={16} aria-hidden="true" />}
                {label}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="welcome-error">
              {error}
            </p>
          )}
          <div className="welcome-actions">
            <button
              className="welcome-continue"
              disabled={busy || !answers[step - 1]}
              onClick={() => void advance()}
            >
              {busy ? "Saving…" : "Continue"}
            </button>
            <button
              className="welcome-skip"
              disabled={busy}
              onClick={() => void advance(true)}
            >
              Skip
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
