"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Volume2 } from "lucide-react";
import { Companion } from "./illustrations";
import type { Profile } from "@/lib/types";
import { mobileState, listenerAvatar } from "@/lib/listener-model";
import { api } from "@/lib/client";
import { chooseVoice } from "@/lib/voice";
import {
  welcomeQuestions,
  welcomeSpeech,
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
  const checkinId = useRef(crypto.randomUUID());
  const audio = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const stop = useCallback(() => {
    generation.current++;
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
    try {
      const response = await fetch("/api/voice/speech", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: welcomeSpeech(listener.language, step),
          language: step === 0 ? "en-US" : listener.language,
          character: cat,
        }),
      });
      if (!response.ok) throw new Error("Speech unavailable");
      const blob = await response.blob();
      if (generation.current !== current) return;
      const url = URL.createObjectURL(blob);
      objectUrl.current = url;
      const player = new Audio(url);
      audio.current = player;
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
        if (generation.current === current) setSpeaking(true);
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
        welcomeSpeech(listener.language, step),
      );
      utterance.lang = step === 0 ? "en-US" : listener.language;
      const voice = chooseVoice(
        window.speechSynthesis.getVoices(),
        step === 0 ? "en-US" : listener.language,
        "",
        cat,
      );
      if (voice) utterance.voice = voice;
      utterance.rate = 0.94;
      utterance.onstart = () => {
        if (generation.current === current) setSpeaking(true);
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
  }, [cat, listener.language, step, stop]);
  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        void play();
      },
      step === 0 ? 350 : 550,
    );
    return () => {
      window.clearTimeout(timer);
      stop();
    };
  }, [play, step, stop]);
  function replay() {
    if (audio.current?.src) {
      setNeedsPlay(false);
      void audio.current
        .play()
        .then(() => setSpeaking(true))
        .catch(() => setNeedsPlay(true));
    } else {
      void play();
    }
  }
  async function advance(skip = false) {
    stop();
    setSpeaking(false);
    setNeedsPlay(false);
    setError("");
    if (step === 0) {
      setStep(1);
      return;
    }
    const next: WelcomeAnswers = [...answers];
    if (skip) next[step - 1] = null;
    setAnswers(next);
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    setBusy(true);
    try {
      await api("mobile", "POST", {
        action: "welcome-checkin",
        value: { id: checkinId.current, answers: next },
      });
      await refresh();
      router.replace("/home");
    } catch {
      setError("Couldn’t save. Please try again.");
      setBusy(false);
    }
  }
  const question = step ? welcomeQuestions[step - 1] : null;
  return (
    <main
      className={`welcome-home ${step === 0 ? "welcome-arrival" : "welcome-questions"} ${speaking ? "is-speaking" : ""}`}
    >
      {step === 0 && (
        <div className="welcome-mascot">
          <Companion type={cat} pose="greet" />
        </div>
      )}
      {step === 0 ? (
        <section className="welcome-greeting">
          <h1>Welcome home.</h1>
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
          <QuestionPicture step={step} cat={cat} />
          <div className="welcome-question-title">
            <h1>{question!.question}</h1>
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
                onClick={() =>
                  setAnswers((old) => {
                    const next: WelcomeAnswers = [...old];
                    next[step - 1] = next[step - 1] === label ? null : label;
                    return next;
                  })
                }
              >
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
