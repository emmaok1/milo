"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import VoiceCall from "@/components/voice-call";
import WelcomeHome from "./welcome-home";
import ChatBackdrop from "./chat-backdrop";
import PersonalizeListener from "./personalize-listener";
import CharacterPicker from "./character-picker";
import { characterId, characterIds, type CharacterId } from "@/lib/characters";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  chatFocus,
  companionNames,
  type ChatFocus,
  type Attachment,
  type ChatMessage,
} from "@/lib/chat-context";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Globe,
  ImagePlus,
  Sparkles,
  ExternalLink,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  Heart,
  Home,
  Leaf,
  LoaderCircle,
  Menu,
  MessageCircle,
  Plus,
  Settings,
  Shield,
  Square,
  Trash2,
  X,
  CalendarDays,
  Sun,
  LogOut,
  Eye,
  EyeOff,
  Download,
  Bookmark,
  Sprout,
} from "lucide-react";
import { api, download } from "@/lib/client";
import { verificationFailure } from "@/lib/auth-flow";
import {
  type Item,
  type Profile,
  defaultProfile,
  datePlus,
  localDate,
  messages,
  statuses,
} from "@/lib/types";
import { resources } from "@/lib/knowledge";
import { Companion, Plant, CardArt } from "./illustrations";

import ListenerApp from "./listener-app";
import MiloBrand from "./milo-brand";
import { mobileState, listenerAvatar } from "@/lib/listener-model";
type Session = { demo: boolean; profile: Profile };
export default function App() {
  const path = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = [
    "/",
    "/login",
    "/signup",
    "/verify-email",
    "/forgot-password",
    "/reset-password",
  ].includes(path);
  const refresh = useCallback(async () => {
    try {
      const s = await api<Session>("session");
      setSession(s);
      if (!s.profile.onboarded && !auth && path !== "/onboarding")
        router.replace("/onboarding");
    } catch {
      setSession(null);
      if (!auth) router.replace("/login");
    } finally {
      setLoading(false);
    }
  }, [auth, path, router]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (path !== "/friends") return;
    const code = new URLSearchParams(window.location.hash.slice(1)).get(
      "invite",
    );
    if (code && /^[A-Za-z0-9_-]{24}$/.test(code)) {
      sessionStorage.setItem("haven.friendInvite", code);
      history.replaceState(null, "", location.pathname + location.search);
    }
  }, [path]);
  const p = session?.profile || defaultProfile;
  if (auth) return <Auth path={path} refresh={refresh} />;
  if (loading || !session)
    return (
      <div className="loading">
        <Leaf />
        <p>Making a little space…</p>
      </div>
    );
  if (path === "/onboarding")
    return (
      <Onboarding
        profile={p}
        done={async () => {
          await refresh();
          router.push("/listener/personalize?welcome=1");
        }}
      />
    );
  if (path === "/listener/personalize" || path === "/listener")
    return <PersonalizeListener profile={p} refresh={refresh} />;
  if (path === "/welcome") return <WelcomeHome profile={p} refresh={refresh} />;
  if (path === "/call") return <VoiceCall p={p} demo={session.demo} />;
  return (
    <ListenerApp
      p={p}
      demo={session.demo}
      refresh={refresh}
      renderChat={(prefill) => (
        <Talk p={p} demo={session.demo} prefill={prefill} />
      )}
    >
      {path === "/plan/new" ? (
        <PlanBuilder p={p} demo={session.demo} />
      ) : path === "/plan" || path === "/plan/checkins" ? (
        <PlanList checkins={path.endsWith("checkins")} />
      ) : path.startsWith("/plan/") ? (
        <Checkins id={path.split("/")[2]} p={p} />
      ) : path.startsWith("/resources") ? (
        <Resources path={path} />
      ) : path.startsWith("/space") ? (
        <Space path={path} p={p} refresh={refresh} demo={session.demo} />
      ) : (
        <HomePage p={p} />
      )}
    </ListenerApp>
  );
}

function Heading({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {children && <p className="subtitle">{children}</p>}
      </div>
      {action}
    </div>
  );
}
function ErrorBox({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      {error}
    </div>
  ) : null;
}
function Save({ state }: { state: string }) {
  return (
    <span className="save-state" role="status">
      {state === "Saved" ? (
        <Check size={14} />
      ) : state === "Saving…" ? (
        <LoaderCircle className="spin" size={14} />
      ) : null}
      {state}
    </span>
  );
}
function HomePage({ p }: { p: Profile }) {
  const [plans, setPlans] = useState<Item[]>([]);
  const [conversations, setConversations] = useState<Item[]>([]);
  useEffect(() => {
    api<Item[]>("plans")
      .then(setPlans)
      .catch(() => {});
    api<Item[]>("conversations")
      .then(setConversations)
      .catch(() => {});
  }, []);
  return (
    <div className="home-content">
      <div className="home-date">
        <Sun size={17} />
        {new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: p.timezone,
        }).format(new Date())}
        <span>A FRESH MOMENT, AT YOUR PACE</span>
      </div>
      <section className="welcome">
        <div className="welcome-copy">
          <span className="eyebrow">WELCOME TO YOUR SPACE</span>
          <h1>
            Good to see you, {p.nickname}.<br />
            <em>You can just be here.</em>
          </h1>
          <p>
            No perfect words. No pressure to figure it all out.
            <br />A little company, and a small next step when you’re ready.
          </p>
          <Link className="button primary" href="/talk">
            Talk for a while <ArrowRight size={17} />
          </Link>
          <span className="welcome-foot">
            <Shield size={14} /> Your choices. Your pace. Always.
          </span>
        </div>
        <div className="welcome-art">
          <div className="art-circle" />
          <Plant />
          <div className="companion-peek">
            <Companion type={p.companion} />
            <span>
              A little company,
              <br />
              whenever you need it.
            </span>
          </div>
          <span className="art-spark s1">✧</span>
          <span className="art-spark s2">✧</span>
        </div>
      </section>
      <section className="home-actions">
        <div className="section-label">
          <h2>What would feel helpful today?</h2>
          <span>There’s no right place to start.</span>
        </div>
        <div className="entry-grid">
          {[
            {
              kind: "talk",
              title: "Talk",
              copy: "Let it out, untangle a thought, or just have a little company.",
              label: "I’m here to listen",
              href: "/talk",
            },
            {
              kind: "plan",
              title: "Make Plan",
              copy: "Find one manageable next step. Make it yours, and adjust as you go.",
              label: "One small step at a time",
              href: "/plan",
            },
            {
              kind: "resources",
              title: "Resources",
              copy: "Explore support, thoughtful resources, and ways to ask for help.",
              label: "A little guidance, when you need it",
              href: "/resources",
            },
          ].map((c) => (
            <Link className={"entry-card " + c.kind} href={c.href} key={c.kind}>
              <div className="card-art">
                <CardArt kind={c.kind} />
              </div>
              <div className="entry-body">
                <h3>
                  {c.title}
                  <ArrowRight size={20} />
                </h3>
                <p>{c.copy}</p>
                <span>{c.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      {(conversations.length > 0 || plans.length > 0) && (
        <div className="continue-row">
          <span>Pick up where you left off</span>
          {conversations.length > 0 && (
            <Link href={"/talk/" + conversations.at(-1)!.id}>
              <MessageCircle size={16} /> Your latest conversation{" "}
              <ArrowRight size={14} />
            </Link>
          )}
          {plans.some((x) => x.data.state === "active") && (
            <Link
              href={"/plan/" + plans.find((x) => x.data.state === "active")!.id}
            >
              <CalendarDays size={16} /> Your current plan{" "}
              <ArrowRight size={14} />
            </Link>
          )}
        </div>
      )}
      <footer className="home-footer">
        <Leaf size={18} />
        <p>
          Talk it through, share a picture, or explore something together.
          <span>
            This is a support prototype for adults 18+. It isn’t a substitute
            for professional care.
          </span>
        </p>
        <Link href="/space/privacy">
          A note on privacy <ArrowRight size={14} />
        </Link>
      </footer>
    </div>
  );
}
function Auth({
  path,
  refresh,
}: {
  path: string;
  refresh: () => Promise<void>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [character, setCharacter] = useState<CharacterId>("black_cat");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [adult, setAdult] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [demo, setDemo] = useState(false);
  useEffect(() => {
    if (!resendSeconds) return;
    const timer = setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);
  useEffect(() => {
    if (path === "/verify-email")
      setEmail(sessionStorage.getItem("haven.verificationEmail") || "");
  }, [path]);
  useEffect(() => {
    api<{ demo: boolean }>("config")
      .then((c) => setDemo(c.demo))
      .catch(() => {});
  }, []);
  const signup = path === "/signup";
  const forgot = path === "/forgot-password";
  const reset = path === "/reset-password";
  const verify = path === "/verify-email";
  const isLogin = !signup && !forgot && !reset && !verify;
  const title = signup
    ? "A space of your own."
    : forgot
      ? "Let’s get you back in."
      : reset
        ? "A fresh start."
        : verify
          ? "Check your inbox."
          : "Good to see you.";
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNote("");
    if ((signup || reset) && password !== confirm) {
      setError("Your passwords don’t match.");
      return;
    }
    setBusy(true);
    try {
      const action = signup
        ? "signup"
        : forgot
          ? "forgot"
          : reset
            ? "reset"
            : verify
              ? "verify"
              : "login";
      const result = await api<{ requiresEmailVerification?: boolean }>("auth/" + action, "POST", {
        email: email.trim(),
        password,
        adult,
        character,
        code: verificationCode,
      });
      if (signup) {
        if (result.requiresEmailVerification === false) {
          sessionStorage.removeItem("haven.verificationEmail");
          window.location.assign(new URL("/welcome", window.location.origin).href);
        } else {
          sessionStorage.setItem("haven.verificationEmail", email.trim());
          router.push("/verify-email");
        }
      } else if (forgot) {
        setNote(
          "If this address is eligible, an email is on its way. Please check your inbox.",
        );
      } else if (reset) router.push("/home");
      else {
        sessionStorage.removeItem("haven.verificationEmail");
        // Start with the newly issued cookies and discard cached signed-out routes.
        window.location.assign(
          sessionStorage.getItem("haven.friendInvite")
            ? "/friends"
            : "/welcome",
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function resendCode() {
    if (busy || resendSeconds) return;
    setError("");
    setNote("");
    setBusy(true);
    try {
      await api("auth/resend", "POST", { email: email.trim() });
      sessionStorage.setItem("haven.verificationEmail", email.trim());
      setVerificationCode("");
      setResendSeconds(60);
      router.replace("/verify-email");
      setNote("If this email still needs verification, a new code will be sent. Already verified your email? Sign in instead; verified accounts do not need another signup code.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={"auth-page" + (isLogin ? " milo-login" : "")}>
      {isLogin && (
        <header className="milo-login-header">
          <Link href="/" aria-label="Milo home">
            <MiloBrand />
          </Link>
        </header>
      )}
      {!isLogin && (
        <div className="auth-story">
          <Link href="/" className="brand">
            <MiloBrand />
          </Link>
          <div>
            <p className="eyebrow">A LITTLE SPACE FOR YOU</p>
            <h1>
              A softer place
              <br />
              to begin.
            </h1>
            <p>
              A little company. Room to reflect.
              <br />
              One small step, whenever you’re ready.
            </p>
            <Plant />
          </div>
          <p className="auth-bottom">
            Built with care for Cal Hacks 13.0 · Adults 18+
          </p>
        </div>
      )}
      <div className="auth-panel">
        <div className="auth-form">
          {isLogin && (
            <div className="milo-login-cat" aria-hidden="true">
              <Companion type="black_cat" large />
            </div>
          )}
          {!isLogin && (
            <span className="eyebrow">
              {signup
                ? "WELCOME"
                : verify
                  ? "ONE MORE STEP"
                  : "COME AS YOU ARE"}
            </span>
          )}
          <h1>{title}</h1>
          {!isLogin && (
            <p>
              {verify
                ? "Enter the verification code from your latest email. You can open the email on any device. If you already verified this email, sign in instead of requesting another signup code."
                : "A warm space for adults navigating binge-eating or self-induced vomiting difficulties. No diagnosis needed."}
            </p>
          )}
          <form onSubmit={submit}>
            {signup && (
              <fieldset className="character-fieldset">
                <legend>Choose your listener</legend>
                <CharacterPicker
                  value={character}
                  onChange={setCharacter}
                  disabled={busy}
                />
                <p>You can change your listener after signing up.</p>
              </fieldset>
            )}
            {!reset && (
              <label>
                {isLogin ? "Email" : "Email address"}
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setVerificationCode(""); }}
                  placeholder={isLogin ? "Your email" : "you@example.com"}
                />
              </label>
            )}
            {!forgot && !verify && (
              <label>
                Password
                <div className="password-input">
                  <input
                    type={show ? "text" : "password"}
                    minLength={10}
                    maxLength={128}
                    required
                    autoComplete={
                      signup || reset ? "new-password" : "current-password"
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      isLogin ? "Your password" : "At least 10 characters"
                    }
                  />
                  <button
                    type="button"
                    className="icon"
                    onClick={() => setShow(!show)}
                    aria-label={show ? "Hide password" : "Show password"}
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            )}
            {verify && (
              <label>
                Verification code
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6,10}"
                  minLength={6}
                  maxLength={10}
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\s/g, ""))}
                  placeholder="Code from your email"
                />
              </label>
            )}
            {(signup || reset) && (
              <label>
                Confirm password
                <input
                  type={show ? "text" : "password"}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </label>
            )}
            {signup && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={adult}
                  onChange={(e) => setAdult(e.target.checked)}
                  required
                />
                I am 18 or older. I understand this is virtual support, not
                medical care.
              </label>
            )}
            {isLogin && (
              <div className="milo-login-forgot">
                <Link href="/forgot-password">Forgot password?</Link>
              </div>
            )}
            <ErrorBox error={error || (verify ? verificationFailure(searchParams.get("error")) : "")} />
            {note && (
              <div className="notice" role="status">
                {note}
              </div>
            )}
            <button className="button primary wide" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={18} /> : null}
              {signup
                ? "Create account"
                : forgot
                  ? "Send reset link"
                  : reset
                    ? "Update password"
                    : verify
                      ? "Verify email and continue"
                      : "Log in"}
              {!isLogin && <ArrowRight size={17} />}
            </button>
          </form>
          {verify && (
            <button type="button" className="button outline wide" disabled={busy || resendSeconds > 0 || !email.trim()} onClick={resendCode}>
              {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend verification code"}
            </button>
          )}
          <div className="auth-links">
            <Link href={signup || forgot || verify ? "/login" : "/signup"}>
              {signup || forgot || verify
                ? "Back to sign in"
                : "New here? Create an account"}
            </Link>
            {isLogin && (
              <Link href="/verify-email">Verify email or resend code</Link>
            )}
          </div>
          {demo && (
            <>
              <div className="divider">OR EXPLORE FIRST</div>
              <button
                className="button outline wide"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("demo", "POST");
                    router.push("/onboarding");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Try the fictional demo <ArrowRight size={17} />
              </button>
              <small className="muted">
                No account needed. Sample replies, not a live AI. Please use
                fictional information only.
              </small>
            </>
          )}
          {isLogin ? (
            <details className="milo-login-privacy">
              <summary>Privacy</summary>
              <p>
                Your data is processed by Milo and configured AI providers. You
                control Memory in Settings. Nothing is automatically shared with
                friends.
              </p>
            </details>
          ) : (
            <div className="auth-privacy">
              <Shield size={16} />
              <span>
                Your data is processed by the app and configured AI providers.
                Automatic memory has controls in Settings. No automatic sharing
                with anyone you know.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function Onboarding({ profile, done }: { profile: Profile; done: () => void }) {
  const [p, setP] = useState(profile);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="onboarding">
      <Link href="/home" className="brand">
        <MiloBrand />
      </Link>
      <div className="onboard-card">
        <div className="step-dots">
          {[0, 1, 2].map((n) => (
            <span key={n} className={n <= step ? "active" : ""} />
          ))}
        </div>
        <span className="eyebrow">LET’S MAKE THIS YOURS · {step + 1} OF 3</span>
        <h1>
          {
            [
              "What should we call you?",
              "What feels supportive?",
              "A little company, your way.",
            ][step]
          }
        </h1>
        <p className="subtitle">
          {
            [
              "A nickname is enough. You decide how much to share.",
              "There’s no right answer. You can change this later.",
              "Choose a black cat or a white cat. You can personalize your companion next.",
            ][step]
          }
        </p>
        {step === 0 ? (
          <label>
            Your nickname
            <input
              maxLength={40}
              value={p.nickname}
              onChange={(e) => setP({ ...p, nickname: e.target.value })}
            />
          </label>
        ) : step === 1 ? (
          <>
            <div className="choice-grid">
              {["Listen first", "Help me reflect", "Be more direct"].map(
                (s) => (
                  <button
                    key={s}
                    className={
                      "choice " + (p.preference === s ? "selected" : "")
                    }
                    onClick={() => setP({ ...p, preference: s })}
                  >
                    <Heart size={20} />
                    {s}
                    {p.preference === s && <Check size={17} />}
                  </button>
                ),
              )}
            </div>
            <label>
              Response length
              <select
                value={p.length}
                onChange={(e) => setP({ ...p, length: e.target.value })}
              >
                <option>Adaptive</option>
                <option>Short</option>
                <option>Balanced</option>
              </select>
            </label>
          </>
        ) : (
          <>
            <CharacterPicker
              value={characterId(p.companion)}
              onChange={(id) => setP({ ...p, companion: id })}
            />
            <div className="notice">
              <Shield size={18} />
              <div>
                <strong>A note about memory</strong>
                <p>
                  Automatic memory can keep selected things you share across
                  conversations. View, correct, delete, or turn it off in
                  Settings. Temporary chats save neither app history nor
                  long-term memory; AI providers may retain requests separately.
                </p>
              </div>
            </div>
          </>
        )}
        <ErrorBox error={error} />
        <div className="form-actions">
          {step > 0 && (
            <button
              className="button outline"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          <button
            className="button primary"
            disabled={busy || !p.nickname.trim()}
            onClick={async () => {
              if (step < 2) {
                setStep(step + 1);
                return;
              }
              setBusy(true);
              try {
                await api("profile", "PATCH", {
                  nickname: p.nickname,
                  companion: p.companion,
                  preference: p.preference,
                  length: p.length,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  onboarded: true,
                });
                done();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {step < 2 ? "Continue" : "Make yourself at home"}
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
function Talk({
  p,
  demo,
  prefill,
}: {
  p: Profile;
  demo: boolean;
  prefill?: string;
}) {
  const listener = mobileState(p.mobile).listener;
  const avatar = listenerAvatar(listener);
  const path = usePathname();
  const router = useRouter();
  const id = path.split("/")[2];
  const [history, setHistory] = useState<Item[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [focus, setFocus] = useState<ChatFocus>("open");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [web, setWeb] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [replyStyle] = useState("Adaptive");
  const [activity, setActivity] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  useEffect(() => {
    if (prefill) setInput(prefill);
  }, [prefill]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const temporary = p.memoryMode === "temporary";
  const dontRemember = false;
  const [copied, setCopied] = useState(-1);
  const [cid, setCid] = useState<string | undefined>(id);
  const controller = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const composerArea = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Item[]>("conversations")
      .then(setHistory)
      .catch(() => {});
    if (id) {
      api<Item[]>("conversations/" + id)
        .then((rows) => {
          setChat(
            rows.map((r) => ({
              role: String(r.data.role),
              text: String(r.data.text),
              state: String(r.data.state || "completed"),
              attachments: (r.data.attachments || []) as Attachment[],
              sources: (r.data.sources || []) as {
                title: string;
                url: string;
              }[],
            })),
          );
          setCid(id);
          const savedFocus = [...rows].reverse().find((r) => r.data.focus)
            ?.data.focus;
          if (typeof savedFocus === "string" && savedFocus in chatFocus)
            setFocus(savedFocus as ChatFocus);
        })
        .catch((e) => setError(e.message));
    } else {
      setChat([]);
      setCid(undefined);
    }
  }, [id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "instant" });
  }, [chat]);
  async function pickImages(files: FileList | File[] | null) {
    if (!files || busy || uploading) return;
    setError("");
    setUploading(true);
    try {
      if (attachments.length + files.length > 2)
        throw new Error("Choose up to two images per message.");
      const next: Attachment[] = [];
      for (const file of Array.from(files)) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
          throw new Error("Choose a JPEG, PNG or WebP image.");
        if (file.size > 12000000)
          throw new Error("Choose an image smaller than 12 MB.");
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("This browser could not prepare the image.");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const url = canvas.toDataURL("image/jpeg", 0.85);
        if (url.length > 2000000)
          throw new Error("Please choose a smaller image.");
        next.push({ name: file.name.slice(0, 120), url });
      }
      setAttachments((old) => [...old, ...next]);
      setWeb(false);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  async function send(
    value = input,
    chosenFocus = focus,
    chosenAttachments = attachments,
  ) {
    if ((!value.trim() && !chosenAttachments.length) || busy || uploading)
      return;
    value = value.trim() || "I’d like to talk about this image.";
    setFocus(chosenFocus);
    setToolsOpen(false);
    setAttachments([]);
    setActivity("");
    setInput("");
    setError("");
    setBusy(true);
    setChat((old) => [
      ...old,
      { role: "user", text: value, attachments: chosenAttachments },
      { role: "assistant", text: "", state: "generating" },
    ]);
    controller.current = new AbortController();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: value,
          requestId: crypto.randomUUID(),
          conversationId: cid,
          temporary,
          dontRemember,
          focus: chosenFocus,
          attachments: chosenAttachments,
          web,
          replyStyle,
        }),
        signal: controller.current.signal,
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error);
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        buffer += decoder.decode(r.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.type === "meta" && event.conversationId)
            setCid(event.conversationId);
          if (event.type === "delta")
            setChat((old) =>
              old.map((m, i) =>
                i === old.length - 1 ? { ...m, text: m.text + event.text } : m,
              ),
            );
          if (event.type === "activity") setActivity(event.text);
          if (event.type === "source")
            setChat((old) =>
              old.map((m, i) =>
                i === old.length - 1
                  ? {
                      ...m,
                      sources: [
                        ...(m.sources || []).filter(
                          (item) => item.url !== event.url,
                        ),
                        { title: event.title, url: event.url },
                      ],
                    }
                  : m,
              ),
            );
          if (event.type === "error") setError(event.error);
          if (event.type === "done")
            setChat((old) =>
              old.map((m, i) =>
                i === old.length - 1 ? { ...m, state: event.state } : m,
              ),
            );
        }
      }
      api<Item[]>("conversations")
        .then(setHistory)
        .catch(() => {});
    } catch (e) {
      setError(
        (e as Error).name === "AbortError"
          ? "Response stopped."
          : (e as Error).message,
      );
      setChat((old) =>
        old.map((m, i) =>
          i === old.length - 1 ? { ...m, state: "failed" } : m,
        ),
      );
    } finally {
      setBusy(false);
      setActivity("");
    }
  }
  return (
    <div className="talk-page">
      <div className="talk-layout">
        <div
          className={
            "chat-panel " + (chat.length ? "has-messages" : "is-empty")
          }
        >
          <ChatBackdrop theme={mobileState(p.mobile).chatTheme} mode={mobileState(p.mobile).chatMode} />
          <div className="chat-toolbar">
            <button
              className="text-button"
              onClick={() => {
                if (busy) return;
                setChat([]);
                setCid(undefined);
                setAttachments([]);
                setFocus("open");
                setWeb(false);
                router.push("/talk");
              }}
            >
              <Plus size={15} /> New conversation
            </button>
          </div>
          <div className="chat-scroll">
            {chat.length === 0 ? (
              <div className="chat-message assistant chat-greeting" aria-label="Start a conversation">
                <span className={`message-label cat-headshot ${avatar === "white_cat" ? "cat-headshot-white" : "cat-headshot-black"}`}><Companion type={avatar} pose="portrait" /></span>
                <p>I’m here. What’s on your mind?</p>
              </div>
            ) : (
              chat.map((m, i) => (
                <div className={"chat-message " + m.role} key={i}>
                  {m.role === "user" && <span className="message-user-avatar" aria-label="You">{Array.from(p.nickname.trim())[0]?.toLocaleUpperCase() || "Y"}</span>}
                  {m.role === "assistant" && (
                    <span className={`message-label cat-headshot ${avatar === "white_cat" ? "cat-headshot-white" : "cat-headshot-black"}`}>
                      <Companion type={avatar} pose="portrait" />
                    </span>
                  )}
                  {m.attachments?.length ? (
                    <div className="message-images">
                      {m.attachments.map((image, n) => (
                        <Image
                          key={n}
                          src={image.url}
                          alt={image.name}
                          width={480}
                          height={320}
                          unoptimized
                        />
                      ))}
                    </div>
                  ) : null}
                  {m.text ? (
                    m.role === "assistant" ? (
                      <div className="chat-markdown">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: (props) => (
                              <a
                                {...props}
                                target="_blank"
                                rel="noopener noreferrer"
                              />
                            ),
                          }}
                        >
                          {m.text}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p>{m.text}</p>
                    )
                  ) : (
                    busy && (
                      <span className="thinking" role="status" aria-label={activity || "Taking a moment with you…"}>
                        <span className="chat-typing-dots" aria-hidden="true"><i /><i /><i /></span>
                        {activity && <span className="chat-activity">{activity}</span>}
                      </span>
                    )
                  )}
                  {!!m.sources?.length && (
                    <div className="source-cards">
                      {m.sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Globe size={15} />
                          <span>{source.title}</span>
                          <ExternalLink size={13} />
                        </a>
                      ))}
                    </div>
                  )}
                  {m.role === "assistant" && m.text && (
                    <div className="message-actions">
                      <button
                        aria-label="Copy response"
                        className="text-button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(m.text);
                          setCopied(i);
                        }}
                      >
                        {copied === i ? (
                          <Check size={13} />
                        ) : (
                          <Copy size={13} />
                        )}{" "}
                        {copied === i ? "Copied" : "Copy"}
                      </button>
                      <small>
                        {m.state === "failed"
                          ? "Failed"
                          : m.state === "stopped"
                            ? "Stopped"
                            : ""}
                      </small>
                    </div>
                  )}
                </div>
              ))
            )}
            <div ref={bottom} />
          </div>
          <div className="composer-area" ref={composerArea}>
            <ErrorBox error={error} />
            {error && !busy && (
              <button
                className="text-button"
                onClick={() => {
                  const last = [...chat]
                    .reverse()
                    .find((m) => m.role === "user");
                  if (last) send(last.text, focus, last.attachments || []);
                }}
              >
                Retry last message
              </button>
            )}
            <div className="composer-tools" id="chat-composer-tools" hidden={!toolsOpen}>
              <input
                ref={fileInput}
                type="file"
                hidden
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => pickImages(e.target.files)}
              />
              <button
                className="tool-pill"
                type="button"
                disabled={busy || uploading || demo}
                onClick={() => fileInput.current?.click()}
              >
                <ImagePlus size={17} />
                {uploading ? "Preparing…" : "Add an image"}
              </button>
              <button
                type="button"
                className={"tool-pill " + (web ? "active" : "")}
                aria-pressed={web}
                disabled={busy || !!attachments.length || demo}
                onClick={() => setWeb(!web)}
              >
                <Globe size={17} />
                Public web {web ? "on" : "off"}
              </button>
            </div>
            {web && (
              <p className="web-note">
                Search public sources or paste a public webpage link. Only this
                message is used for research; private history and memories stay
                out of the web request. Search may incur additional API charges.
              </p>
            )}
            {!!attachments.length && (
              <div className="attachment-tray">
                {attachments.map((image, i) => (
                  <div key={i}>
                    <Image
                      src={image.url}
                      alt={image.name}
                      width={100}
                      height={80}
                      unoptimized
                    />
                    <button
                      type="button"
                      aria-label={"Remove " + image.name}
                      onClick={() =>
                        setAttachments(attachments.filter((_, n) => n !== i))
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!!attachments.length && (
              <p className="web-note">
                Images are sent to Claude and saved with this conversation,
                unless Temporary chat is on. Image text is not added to
                long-term memory automatically.
              </p>
            )}
            <form
              className="composer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                pickImages(e.dataTransfer.files);
              }}
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <button type="button" className="composer-more" aria-label="More message options" aria-expanded={toolsOpen} aria-controls="chat-composer-tools" onClick={() => setToolsOpen(open => !open)}><Plus size={21} /></button>
              <textarea
                aria-label="Your message"
                rows={1}
                onPaste={(e) => {
                  if (e.clipboardData.files.length) {
                    e.preventDefault();
                    pickImages(e.clipboardData.files);
                  }
                }}
                placeholder={"Message " + listener.name + "…"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              {busy ? (
                <button
                  type="button"
                  className="send-button"
                  aria-label="Stop response"
                  onClick={() => controller.current?.abort()}
                >
                  <Square size={17} />
                </button>
              ) : (
                <button
                  className="send-button"
                  disabled={(!input.trim() && !attachments.length) || uploading}
                  aria-label="Send message"
                >
                  <ArrowUp size={20} />
                </button>
              )}
            </form>
          </div>
        </div>
        <aside className="talk-aside">
          <Companion type={avatar} large />
          <h3>Meet {listener.name}.</h3>
          <span className="presence-pill">
            <span className="status-dot" />
            {busy ? "Thinking with you…" : "Here with you"}
          </span>
          <p>
            A little curiosity. A lot of room.
            <br />
            Let’s take it one thought at a time.
          </p>
          <div className="capability-card">
            <span className="eyebrow">MORE WAYS TO CONNECT</span>
            <div>
              <MessageCircle size={17} />
              <span>A conversation that follows you.</span>
            </div>
            <div>
              <ImagePlus size={17} />
              <span>Share a photo or screenshot.</span>
            </div>
            <div>
              <Globe size={17} />
              <span>Explore public sources together.</span>
            </div>
          </div>
          <div className="aside-divider" />
          <span className="eyebrow">RECENT CONVERSATIONS</span>
          {history.length ? (
            history
              .slice(-5)
              .reverse()
              .map((c) => (
                <Link
                  key={c.id}
                  href={"/talk/" + c.id}
                  className="history-link"
                >
                  <MessageCircle size={14} />
                  {String(c.data.title)}
                </Link>
              ))
          ) : (
            <p className="muted">Your conversations will appear here.</p>
          )}
          <Link href="/space/memories" className="memory-link">
            <Shield size={15} /> You’re in control of memory{" "}
            <ArrowRight size={13} />
          </Link>
        </aside>
      </div>
    </div>
  );
}
function PlanList({ checkins }: { checkins: boolean }) {
  const [plans, setPlans] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<Item[]>("plans")
      .then(setPlans)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <>
      <Heading
        eyebrow={checkins ? "A MOMENT TO REFLECT" : "SMALL STEPS, YOUR WAY"}
        title={
          checkins ? "Your check-in space." : "A little plan. Room to change."
        }
        action={
          <Link className="button primary" href="/plan/new">
            <Plus size={17} /> Make a plan
          </Link>
        }
      >
        {checkins
          ? "Choose a plan to check in, reflect, or make an adjustment."
          : "Plans are invitations, not obligations. Start small and make it yours."}
      </Heading>
      <ErrorBox error={error} />
      {loading ? (
        <p>Loading your plans…</p>
      ) : plans.length === 0 ? (
        <div className="empty-card">
          <CardArt kind="plan" />
          <h2>What would a small next step look like?</h2>
          <p>
            We’ll talk it through, make an editable draft, and start only when
            you choose.
          </p>
          <Link className="button primary" href="/plan/new">
            Find a small next step <ArrowRight size={17} />
          </Link>
        </div>
      ) : (
        ["draft", "active", "paused", "finished"].map((state) => {
          const group = plans.filter((p) => p.data.state === state);
          return (
            group.length > 0 && (
              <section className="plan-group" key={state}>
                <p className="eyebrow">
                  {state.toUpperCase()} · {group.length}
                </p>
                <div className="plan-grid">
                  {group.map((p) => (
                    <Link
                      href={
                        p.data.state === "draft"
                          ? "/plan/new?id=" + p.id
                          : "/plan/" + p.id
                      }
                      className="plan-card"
                      key={p.id}
                    >
                      <span className={"pill " + state}>
                        <CalendarDays size={14} />
                        {state}
                      </span>
                      <h2>{String(p.data.title)}</h2>
                      <p>{String(p.data.task)}</p>
                      <div>
                        <span>
                          {String(p.data.days)} days · From{" "}
                          {String(p.data.start)}
                        </span>
                        <ArrowRight size={18} />
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )
          );
        })
      )}
      <div className="gentle-note">
        <Leaf size={17} /> Trying, adjusting, and pausing all belong here.
        There’s no score to keep.
      </div>
    </>
  );
}
type Draft = {
  title: string;
  task: string;
  steps: string[];
  days: number;
  start: string;
  minutes: number;
  weekendsFree?: boolean;
};
function PlanBuilder({ p, demo }: { p: Profile; demo: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const existingId = search.get("id");
  const [discussion, setDiscussion] = useState(
    search.get("resource")
      ? "I would like a small support plan inspired by: " +
          resources.find((r) => r.id === search.get("resource"))?.title
      : "",
  );
  const [start, setStart] = useState(localDate(p.timezone));
  const [days, setDays] = useState(7);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [record, setRecord] = useState<Item | null>(null);
  const [state, setState] = useState("Discussing");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (existingId)
      api<{ plan: Item }>("plans/" + existingId)
        .then(({ plan }) => {
          setRecord(plan);
          setDraft(plan.data as Draft);
          setState("Saved");
        })
        .catch((e) => setError(e.message));
    const cid = search.get("conversation");
    if (cid)
      api<Item[]>("conversations/" + cid)
        .then((ms) =>
          setContextNote(
            ms
              .filter((m) => m.data.role === "user")
              .slice(-3)
              .map((m) => String(m.data.text))
              .join("\n"),
          ),
        )
        .catch((e) => setError(e.message));
  }, [existingId, search]);
  function edit(patch: Partial<Draft>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setState("Unsaved changes");
  }
  async function generate() {
    setBusy(true);
    setState("Generating…");
    setError("");
    try {
      const d = await api<Draft>("plans/generate", "POST", {
        discussion:
          (contextNote ? "Conversation context: " + contextNote + "\n" : "") +
          discussion,
        start,
        days,
      });
      setDraft(d);
      const saved = await api<Item>(
        record ? "plans/" + record.id : "plans",
        record ? "PATCH" : "POST",
        { ...d, version: record?.version },
      );
      setRecord(saved);
      setState("Saved");
    } catch (e) {
      setError((e as Error).message);
      setState("Generation failed — discussion preserved");
    } finally {
      setBusy(false);
    }
  }
  const save = useCallback(
    async (accept = false) => {
      if (!draft) return;
      setBusy(true);
      setState("Saving…");
      setError("");
      try {
        const r = await api<Item>(
          record ? "plans/" + record.id : "plans",
          record ? "PATCH" : "POST",
          { ...draft, version: record?.version },
        );
        setRecord(r);
        setState("Saved");
        if (accept) {
          await api("plans/" + r.id + "/accept", "POST", {
            version: r.version,
          });
          router.push("/plan/" + r.id);
        }
      } catch (e) {
        setError((e as Error).message);
        setState("Save failed — draft preserved");
      } finally {
        setBusy(false);
      }
    },
    [draft, record, router],
  );
  useEffect(() => {
    if (state !== "Unsaved changes" || busy || !draft || !record) return;
    const timer = setTimeout(() => {
      save();
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, state, busy, record, save]);
  return (
    <>
      <Link href="/plan" className="back-link">
        <ChevronLeft size={16} /> Your plans
      </Link>
      <Heading
        eyebrow="ONE SMALL NEXT STEP"
        title={
          draft
            ? "A draft, ready to make yours."
            : "Let’s find something manageable."
        }
      >
        {draft
          ? "Change anything you need. Nothing starts until you choose."
          : "What kind of support would feel useful, and what is one small action you might like to try?"}
      </Heading>
      <div className="builder-layout">
        <section className="panel">
          <div className="panel-title">
            <MessageCircle size={20} />
            <h2>Talk it through</h2>
          </div>
          {contextNote && (
            <div className="notice">
              <p>
                Context from your conversation is included for this draft. Your
                conversation stays where it is.
              </p>
            </div>
          )}
          <label>
            What would you like a little support with?
            <textarea
              rows={6}
              value={discussion}
              onChange={(e) => setDiscussion(e.target.value)}
              placeholder="For example: I’d like a quiet moment to notice what I need, without pressure to fix anything."
            />
          </label>
          <div className="two-col">
            <label>
              Start date
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </label>
            <label>
              How many days?
              <input
                type="number"
                min={1}
                max={31}
                value={days}
                onChange={(e) => setDays(+e.target.value)}
              />
            </label>
          </div>
          <p className="muted">
            Keep it non-food-related. This plan won’t replace advice from your
            care team.
          </p>
          <button
            className="button primary wide"
            disabled={busy || !discussion.trim()}
            onClick={generate}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Sprout size={17} />
            )}{" "}
            {draft ? "Generate a new draft" : "Create an editable draft"}
          </button>
          {demo && (
            <small className="demo-note">
              Demo: this creates a fictional example plan, not an AI-generated
              recommendation.
            </small>
          )}
        </section>
        <section className="panel draft-panel">
          <div className="panel-title">
            <CalendarDays size={20} />
            <h2>Your plan draft</h2>
            <Save state={state} />
          </div>
          {draft ? (
            <>
              <label>
                Plan title
                <input
                  value={draft.title}
                  onChange={(e) => edit({ title: e.target.value })}
                  maxLength={100}
                />
              </label>
              <label>
                One manageable action
                <input
                  value={draft.task}
                  onChange={(e) => edit({ task: e.target.value })}
                  maxLength={200}
                />
              </label>
              <label>
                Steps · one per line
                <textarea
                  rows={3}
                  value={draft.steps.join("\n")}
                  onChange={(e) => edit({ steps: e.target.value.split("\n") })}
                />
              </label>
              <div className="three-col">
                <label>
                  Start
                  <input
                    type="date"
                    value={draft.start}
                    onChange={(e) => edit({ start: e.target.value })}
                  />
                </label>
                <label>
                  Days
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={draft.days}
                    onChange={(e) => edit({ days: +e.target.value })}
                  />
                </label>
                <label>
                  Minutes · optional
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={draft.minutes}
                    onChange={(e) => edit({ minutes: +e.target.value })}
                  />
                </label>
              </div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={!!draft.weekendsFree}
                  onChange={(e) => edit({ weekendsFree: e.target.checked })}
                />{" "}
                Leave weekends free
              </label>
              <div className="revision-input">
                <label>
                  Ask for a change
                  <input
                    value={revision}
                    onChange={(e) => setRevision(e.target.value)}
                    placeholder="One task per day, leave weekends free…"
                  />
                </label>
                <button
                  className="button outline small"
                  disabled={busy || !revision}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      if (/weekends? free/i.test(revision)) {
                        edit({ weekendsFree: true });
                      } else if (/one task per day/i.test(revision)) {
                        edit({ steps: draft.steps.slice(0, 1) });
                      } else {
                        const d = await api<Draft>("plans/generate", "POST", {
                          discussion:
                            JSON.stringify(draft) +
                            "\nRequested revision: " +
                            revision,
                          start: draft.start,
                          days: draft.days,
                        });
                        edit(d);
                      }
                      setRevision("");
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Revise draft
                </button>
              </div>
              <div className="form-actions">
                <button
                  className="button outline"
                  disabled={busy}
                  onClick={() => save()}
                >
                  Save draft
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => save(true)}
                >
                  Start this plan <ArrowRight size={16} />
                </button>
              </div>
              <p className="muted">
                Your plan activates only after selecting Start this plan.
              </p>
            </>
          ) : (
            <div className="draft-empty">
              <CardArt kind="plan" />
              <p>
                A little conversation first.
                <br />
                Your editable draft will appear here.
              </p>
            </div>
          )}
          <ErrorBox error={error} />
        </section>
      </div>
    </>
  );
}
function Checkins({ id, p }: { id: string; p: Profile }) {
  const [plan, setPlan] = useState<Item | null>(null);
  const [tasks, setTasks] = useState<Item[]>([]);
  const [checkins, setCheckins] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [state, setState] = useState("");
  const [preview, setPreview] = useState<Item | null>(null);
  const [newTask, setNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState(localDate(p.timezone));
  const [adjust, setAdjust] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await api<{ plan: Item; tasks: Item[]; checkins: Item[] }>(
        "plans/" + id,
      );
      setPlan(data.plan);
      setTasks(
        data.tasks.sort((a, b) =>
          String(a.data.date).localeCompare(String(b.data.date)),
        ),
      );
      setCheckins(data.checkins);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);
  async function revision(task: string) {
    setBusy(true);
    setError("");
    try {
      setPreview(
        await api<Item>("plans/" + id + "/revision", "POST", { task }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!plan)
    return (
      <>
        <ErrorBox error={error} />
        <p>Loading your plan…</p>
      </>
    );
  return (
    <>
      <Link href="/plan" className="back-link">
        <ChevronLeft size={16} /> Your plans
      </Link>
      <Heading
        eyebrow="A LITTLE CHECK-IN"
        title={String(plan.data.title)}
        action={
          <Link className="button outline small" href="/talk">
            <MessageCircle size={16} /> Talk for a while
          </Link>
        }
      >
        A record of your experience, at your pace. Trying and helpfulness are
        different things.
      </Heading>
      <div className="plan-overview">
        <span className="pill active">{String(plan.data.state)}</span>
        <span>
          <CalendarDays size={16} />
          {String(plan.data.start)} · {String(plan.data.days)} days
        </span>
        <span>{p.timezone}</span>
        <Save state={state} />
        <select
          aria-label="Plan state"
          value={String(plan.data.state)}
          onChange={async (e) => {
            try {
              await api("plans/" + id + "/state", "POST", {
                state: e.target.value,
                version: plan.version,
              });
              await load();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="finished">Finished</option>
        </select>
      </div>
      <ErrorBox error={error} />
      <section className="panel table-panel">
        <div className="section-label">
          <h2>Your days, with room to change.</h2>
          <button
            className="button outline small"
            onClick={() => setNewTask(!newTask)}
          >
            <Plus size={15} /> Add task
          </button>
        </div>
        {newTask && (
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api("plans/" + id + "/tasks", "POST", {
                  title: newTitle,
                  date: newDate,
                  steps: [],
                });
                setNewTask(false);
                setNewTitle("");
                await load();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label>
              Task
              <input
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </label>
            <label>
              Date
              <input
                required
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </label>
            <button className="button primary small">Add task</button>
          </form>
        )}
        <div className="checkin-table">
          <div className="table-head">
            <span>DAY</span>
            <span>YOUR SMALL STEP</span>
            <span>STATUS</span>
            <span>EXPERIENCE</span>
            <span />
          </div>
          {tasks.map((t) => {
            const c = checkins.find((c) => c.data.taskId === t.id);
            const d = new Date(String(t.data.date) + "T12:00:00Z");
            return (
              <button
                className="table-row"
                key={t.id}
                onClick={() => setSelected(t)}
              >
                <span className="day-cell">
                  <strong>
                    {d.toLocaleDateString("en-US", {
                      weekday: "short",
                      timeZone: "UTC",
                    })}
                  </strong>
                  <small>
                    {d.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </small>
                </span>
                <span>
                  {String(t.data.title)}
                  <small>
                    {Array.isArray(t.data.steps)
                      ? t.data.steps.length + " small steps"
                      : ""}
                  </small>
                </span>
                <span>
                  <span
                    className={
                      "status-pill " +
                      (c?.data.status === "Completed" ? "complete" : "")
                    }
                  >
                    {c?.data.status === "Completed" ? (
                      <Check size={12} />
                    ) : null}
                    {String(c?.data.status || "Not started")}
                  </span>
                </span>
                <span className="experience-cell">
                  {Array.isArray(c?.data.tags) && c.data.tags.length
                    ? c.data.tags.join(" · ")
                    : "Room for a reflection"}
                </span>
                <ArrowRight size={16} />
              </button>
            );
          })}
        </div>
      </section>
      <div className="adjustment-card">
        <div>
          <span className="eyebrow">PLANS CAN CHANGE WITH YOU</span>
          <h2>Need a little more room?</h2>
          <p>Preview a smaller next step. Past records stay as they are.</p>
        </div>
        <button
          className="button outline"
          disabled={busy}
          onClick={() => revision("Pause and notice one thing I need")}
        >
          <Sprout size={17} /> Make it smaller
        </button>
        <button
          className="button outline"
          onClick={() => setAdjust(adjust ? "" : "Take one quiet moment")}
        >
          Adjust together <ArrowRight size={16} />
        </button>
        {adjust && (
          <div className="inline-form wide">
            <label>
              A future action
              <input
                value={adjust}
                onChange={(e) => setAdjust(e.target.value)}
              />
            </label>
            <button
              className="button primary small"
              disabled={busy}
              onClick={() => revision(adjust)}
            >
              Preview changes
            </button>
          </div>
        )}
      </div>
      {preview && (
        <div className="modal-backdrop">
          <div className="modal">
            <button
              className="icon modal-close"
              aria-label="Close preview"
              onClick={() => setPreview(null)}
            >
              <X />
            </button>
            <span className="eyebrow">NOT APPLIED YET</span>
            <h2>A little adjustment.</h2>
            <p>Only dates after today in {p.timezone} are included.</p>
            {(
              preview.data.changes as {
                id: string;
                before: string;
                after: string;
                date: string;
              }[]
            ).length === 0 ? (
              <p>No future tasks to adjust.</p>
            ) : (
              (
                preview.data.changes as {
                  id: string;
                  before: string;
                  after: string;
                  date: string;
                }[]
              ).map((c) => (
                <div className="diff" key={c.id}>
                  <small>{c.date}</small>
                  <del>{c.before}</del>
                  <span>
                    <ArrowRight size={14} />
                    {c.after}
                  </span>
                </div>
              ))
            )}
            <div className="form-actions">
              <button
                className="button outline"
                onClick={() => setPreview(null)}
              >
                Keep my plan
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api("plans/" + id + "/apply", "POST", {
                      revisionId: preview.id,
                    });
                    setPreview(null);
                    setState("Saved");
                    await load();
                  } catch (e) {
                    setError((e as Error).message);
                    setPreview(null);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Accept changes <Check size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
      {selected && (
        <DayEditor
          task={selected}
          entry={checkins.find((c) => c.data.taskId === selected.id)}
          planId={id}
          close={() => setSelected(null)}
          saved={async () => {
            setSelected(null);
            setState("Saved");
            await load();
          }}
        />
      )}
      <p className="muted bottom-note">
        Dates describe when the activity happened. Save times are recorded
        separately in UTC. You can edit earlier days.
      </p>
    </>
  );
}
function DayEditor({
  task,
  entry,
  planId,
  close,
  saved,
}: {
  task: Item;
  entry?: Item;
  planId: string;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(String(task.data.title));
  const [date, setDate] = useState(String(task.data.date));
  const [steps, setSteps] = useState(
    ((task.data.steps as string[]) || []).join("\n"),
  );
  const [status, setStatus] = useState(
    String(entry?.data.status || "Not started"),
  );
  const [tags, setTags] = useState<string[]>(
    (entry?.data.tags as string[]) || [],
  );
  const [tag, setTag] = useState("");
  const [before, setBefore] = useState(String(entry?.data.before || ""));
  const [after, setAfter] = useState(String(entry?.data.after || ""));
  const [message, setMessage] = useState(
    String(entry?.data.message ?? messages[0]),
  );
  const [helpful, setHelpful] = useState(String(entry?.data.helpful || ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [taskVersion, setTaskVersion] = useState(task.version);
  async function save() {
    setBusy(true);
    setError("");
    try {
      if (
        title !== task.data.title ||
        date !== task.data.date ||
        steps !== ((task.data.steps as string[]) || []).join("\n")
      ) {
        const t = await api<Item>("tasks/" + task.id, "PATCH", {
          title,
          date,
          steps: steps.split("\n").filter(Boolean),
          version: taskVersion,
        });
        setTaskVersion(t.version);
      }
      await api("checkins", "POST", {
        planId,
        taskId: task.id,
        status,
        tags,
        before,
        after,
        message,
        helpful,
        version: entry?.version,
      });
      await saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div className="modal day-modal">
        <button
          className="icon modal-close"
          aria-label="Close day editor"
          onClick={close}
        >
          <X />
        </button>
        <span className="eyebrow">A MOMENT TO NOTICE</span>
        <h2>How did this feel for you?</h2>
        <p>Every field is an invitation. Feelings are optional.</p>
        <div className="two-col">
          <label>
            Your action
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label>
            Activity date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <label>
          Small steps
          <textarea
            rows={2}
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>Where did you get to?</legend>
          <div className="tag-options">
            {statuses.map((s) => (
              <button
                key={s}
                className={"tag " + (status === s ? "selected" : "")}
                onClick={() => setStatus(s)}
              >
                {status === s && <Check size={13} />} {s}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>What was the experience like?</legend>
          <div className="tag-options">
            {Array.from(
              new Set([
                "Helpful",
                "Too difficult",
                "Not a good fit",
                "Want to try again",
                ...tags,
              ]),
            ).map((s) => (
              <button
                key={s}
                className={"tag " + (tags.includes(s) ? "selected" : "")}
                onClick={() =>
                  setTags(
                    tags.includes(s)
                      ? tags.filter((t) => t !== s)
                      : [...tags, s],
                  )
                }
              >
                {s}
                {tags.includes(s) && <X size={12} />}
              </button>
            ))}
          </div>
          <div className="custom-tag">
            <input
              aria-label="Custom experience tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              maxLength={50}
              placeholder="Your own words…"
            />
            <button
              className="text-button"
              onClick={() => {
                if (tag.trim()) setTags([...new Set([...tags, tag.trim()])]);
                setTag("");
              }}
            >
              Add tag
            </button>
          </div>
        </fieldset>
        <div className="two-col">
          <label>
            Before · optional
            <textarea
              rows={2}
              value={before}
              onChange={(e) => setBefore(e.target.value)}
              placeholder="What was on your mind?"
            />
          </label>
          <label>
            After · optional
            <textarea
              rows={2}
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              placeholder="Anything you noticed?"
            />
          </label>
        </div>
        <label>
          Was it helpful? · separate from completing it
          <select value={helpful} onChange={(e) => setHelpful(e.target.value)}>
            <option value="">Prefer not to say</option>
            <option>Yes</option>
            <option>No</option>
            <option>Unsure</option>
          </select>
        </label>
        <div className="daily-message">
          <label>
            A little note for today
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Message hidden"
            />
          </label>
          <div>
            <button
              className="text-button"
              onClick={() =>
                setMessage(
                  messages[(messages.indexOf(message) + 1) % messages.length],
                )
              }
            >
              Replace
            </button>
            <button className="text-button" onClick={() => setMessage("")}>
              Hide
            </button>
          </div>
        </div>
        <small className="muted">
          Reflections are saved separately from permission to use them for AI or
          memory. Change these controls in Privacy.
        </small>
        <ErrorBox error={error} />
        <div className="form-actions">
          <button
            className="button outline small"
            disabled={busy}
            onClick={async () => {
              try {
                await api("plans/" + planId + "/tasks", "POST", {
                  title,
                  date,
                  steps: steps.split("\n").filter(Boolean),
                });
                await saved();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Copy size={14} /> Copy task
          </button>
          <button className="button primary" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save check-in"}
            <Check size={16} />
          </button>
        </div>
        <div className="danger-links">
          {entry && (
            <button
              disabled={busy}
              onClick={async () => {
                try {
                  await api("checkins/" + entry.id, "DELETE");
                  await saved();
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Delete reflection
            </button>
          )}
          <button
            disabled={busy}
            onClick={async () => {
              try {
                await api("tasks/" + task.id, "DELETE");
                await saved();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Delete this task
          </button>
        </div>
        {entry && (
          <small className="muted">
            Recorded {new Date(String(entry.data.recordedAt)).toLocaleString()}{" "}
            · activity date {String(entry.data.localDate)}
          </small>
        )}
      </div>
    </div>
  );
}
function Resources({ path }: { path: string }) {
  const [favorites, setFavorites] = useState<Item[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("All regions");
  const [language, setLanguage] = useState("English");
  const [format, setFormat] = useState("Online");
  const [summary, setSummary] = useState(
    "I would like support with eating-related difficulties.\n\nWhat I would like you to understand:\n\nQuestions I would like to ask:",
  );
  const [preview, setPreview] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api<Item[]>("favorites")
      .then(setFavorites)
      .catch(() => {});
  }, []);
  const detail = resources.find((r) => path === "/resources/skills/" + r.id);
  const isHelp = path === "/resources/help";
  async function favorite(id: string) {
    try {
      await api("favorites", "POST", { resourceId: id });
      setFavorites(await api<Item[]>("favorites"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (detail)
    return (
      <>
        <Link href="/resources/skills" className="back-link">
          <ChevronLeft size={16} /> Coping Skills
        </Link>
        <Heading eyebrow={detail.category} title={detail.title}>
          {detail.review}
        </Heading>
        <article className="panel resource-detail">
          <Leaf size={30} />
          <p className="resource-content">{detail.content}</p>
          <div className="detail-facts">
            <div>
              <span className="eyebrow">WHEN IT MAY FIT</span>
              <p>{detail.applicability}</p>
            </div>
            <div>
              <span className="eyebrow">LIMITATIONS</span>
              <p>{detail.limitations}</p>
            </div>
          </div>
          <div className="notice">
            This item is not a professionally reviewed intervention and is
            excluded from the AI’s published clinical knowledge retrieval.
          </div>
          <p>
            Source:{" "}
            <a href={detail.url} target="_blank" rel="noreferrer">
              {detail.source} <ArrowRight size={14} />
            </a>
          </p>
          <small className="muted">
            Version {detail.version} · Link checked {detail.updatedAt} ·
            Original text with external reference; no endorsement.
          </small>
          <div className="form-actions">
            <button
              className="button outline"
              onClick={() => favorite(detail.id)}
            >
              <Bookmark size={16} />
              {favorites.some((f) => f.data.resourceId === detail.id)
                ? "Saved to favorites"
                : "Save resource"}
            </button>
            <Link
              className="button primary"
              href={"/plan/new?resource=" + detail.id}
            >
              Use as a draft prompt <Plus size={16} />
            </Link>
          </div>
        </article>
        <ErrorBox error={error} />
      </>
    );
  return (
    <>
      <Heading
        eyebrow="A LITTLE GUIDANCE"
        title={
          isHelp
            ? "You deserve support."
            : path === "/resources/skills"
              ? "Find what feels useful."
              : "Support, in your own time."
        }
      >
        {isHelp
          ? "A starting point for finding help and putting your thoughts into words."
          : "Explore at your own pace. Take what feels helpful, and leave the rest."}
      </Heading>
      {path === "/resources" ? (
        <>
          <div className="resource-entry-grid">
            <Link href="/resources/skills" className="panel">
              <CardArt kind="resources" />
              <span className="eyebrow">SPACE TO EXPLORE</span>
              <h2>
                Coping Skills <ArrowRight size={21} />
              </h2>
              <p>
                Optional reflection prompts and official information, with clear
                sources and review status.
              </p>
            </Link>
            <Link href="/resources/help" className="panel">
              <CardArt kind="talk" />
              <span className="eyebrow">YOU DON’T HAVE TO DO THIS ALONE</span>
              <h2>
                Therapists & Help <ArrowRight size={21} />
              </h2>
              <p>
                Find trusted organizations and prepare for a conversation with a
                professional.
              </p>
            </Link>
          </div>
          <div className="gentle-note">
            <Shield size={18} /> No one is automatically contacted. You choose
            what to share and when.
          </div>
        </>
      ) : isHelp ? (
        <>
          <div className="urgent-notice">
            <Heart size={20} />
            <div>
              <strong>Need urgent help?</strong>
              <p>
                If you’re in immediate physical danger, seek local emergency
                medical help. In the US call 911; for emotional crisis support
                call or text{" "}
                <a
                  href="https://988lifeline.org/"
                  target="_blank"
                  rel="noreferrer"
                >
                  988
                </a>
                . This app cannot assess emergencies.
              </p>
            </div>
          </div>
          <div className="filters">
            <label>
              Region
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option>All regions</option>
                <option>US</option>
                <option>UK</option>
                <option>Other</option>
              </select>
            </label>
            <label>
              Language
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option>English</option>
                <option>Other language</option>
              </select>
            </label>
            <label>
              Format
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                <option>Online</option>
                <option>In person</option>
              </select>
            </label>
          </div>
          <div className="plan-grid">
            {resources
              .filter(
                (r) =>
                  ["understanding", "asking-for-help"].includes(r.id) &&
                  (region === "All regions" || r.region === region) &&
                  r.language === language &&
                  r.format === format,
              )
              .map((r) => (
                <div className="panel organization" key={r.id}>
                  <span className="pill">{r.region} · English · Online</span>
                  <h2>{r.source}</h2>
                  <p>
                    {r.id === "understanding"
                      ? "General information and guidance on seeking professional support."
                      : "UK information and support for people affected by eating disorders."}
                  </p>
                  <a
                    className="text-button"
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Visit official website <ArrowRight size={15} />
                  </a>
                  <small className="muted">
                    Source link checked {r.updatedAt}. Availability is not
                    verified.
                  </small>
                </div>
              ))}
          </div>
          <div className="honest-empty">
            <Shield size={17} />
            <p>
              No individual therapist listings are verified in this prototype.
              We don’t invent qualifications, appointments, or availability. If
              your filters show no organizations, try another region or format.
            </p>
          </div>
          <section className="panel consultation">
            <span className="eyebrow">BEFORE A CONVERSATION</span>
            <h2>Find the words, at your pace.</h2>
            <p>
              Write only what you want to share. This text is not saved or sent
              to anyone.
            </p>
            <label>
              Your help-seeking summary
              <textarea
                rows={7}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </label>
            <button className="button primary" onClick={() => setPreview(true)}>
              Preview summary <ArrowRight size={16} />
            </button>
          </section>
          {preview && (
            <div className="modal-backdrop">
              <div className="modal">
                <button
                  className="icon modal-close"
                  aria-label="Close summary preview"
                  onClick={() => setPreview(false)}
                >
                  <X />
                </button>
                <span className="eyebrow">ONLY THE TEXT YOU WROTE</span>
                <h2>Your summary preview.</h2>
                <pre className="summary-preview">{summary}</pre>
                <p className="muted">
                  Copying or downloading does not send this to anyone.
                </p>
                <div className="form-actions">
                  <button
                    className="button outline"
                    onClick={() => download(summary, "support-summary.txt")}
                  >
                    <Download size={16} /> Download
                  </button>
                  <button
                    className="button primary"
                    onClick={async () => {
                      await navigator.clipboard.writeText(summary);
                      setCopied(true);
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                    {copied ? "Copied" : "Copy summary"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="resource-search">
            <label>
              Find by situation or topic
              <input
                type="search"
                placeholder="Try “support”, “pause”, or “understanding”…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <span className="pill">Keyword search</span>
          </div>
          <div className="notice">
            <Shield size={18} />
            <p>
              These original examples have not received professional review.
              Official information is linked separately. No clinical approval is
              implied.
            </p>
          </div>
          <div className="skills-grid">
            {resources
              .filter((r) =>
                JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
              )
              .map((r) => (
                <div className="skill-card" key={r.id}>
                  <div className="skill-top">
                    <span className="eyebrow">{r.category}</span>
                    <button
                      className="icon"
                      aria-label={
                        favorites.some((f) => f.data.resourceId === r.id)
                          ? "Remove favorite"
                          : "Save favorite"
                      }
                      onClick={() => favorite(r.id)}
                    >
                      <Bookmark
                        size={17}
                        fill={
                          favorites.some((f) => f.data.resourceId === r.id)
                            ? "currentColor"
                            : "none"
                        }
                      />
                    </button>
                  </div>
                  <Leaf size={27} />
                  <h2>{r.title}</h2>
                  <p>{r.content}</p>
                  <small>{r.review}</small>
                  <Link href={"/resources/skills/" + r.id}>
                    Explore resource <ArrowRight size={15} />
                  </Link>
                </div>
              ))}
          </div>
          <ErrorBox error={error} />
        </>
      )}
    </>
  );
}
function Space({
  path,
  p,
  refresh,
  demo,
}: {
  path: string;
  p: Profile;
  refresh: () => Promise<void>;
  demo: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(p);
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const [memories, setMemories] = useState<
    {
      id: string;
      text?: string;
      memory?: string;
      source?: string;
      date?: string;
      version?: number;
    }[]
  >([]);
  const [memoryText, setMemoryText] = useState("");
  const [editId, setEditId] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const isMemory = path === "/space/memories";
  const isPrivacy = path === "/space/privacy";
  const isAccount = path === "/space/account";
  const loadMemory = useCallback(async () => {
    try {
      const data = await api<{
        items: {
          id: string;
          text?: string;
          memory?: string;
          source?: string;
          date?: string;
          version?: number;
        }[];
      }>("memories");
      setMemories(data.items);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    if (isMemory) loadMemory();
  }, [isMemory, loadMemory]);
  async function save() {
    setBusy(true);
    setState("Saving…");
    setError("");
    try {
      await api("profile", "PATCH", {
        nickname: form.nickname,
        companion: form.companion,
        preference: form.preference,
        length: form.length,
        timezone: form.timezone,
        memoryMode: form.memoryMode,
        reflectionAI: form.reflectionAI,
        reflectionMemory: form.reflectionMemory,
      });
      await refresh();
      setState("Saved");
    } catch (e) {
      setError((e as Error).message);
      setState("Not saved");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        eyebrow="YOUR SPACE, YOUR CHOICES"
        title={
          isMemory
            ? "A memory you can shape."
            : isPrivacy
              ? "Privacy, in plain words."
              : isAccount
                ? "Your account. Your choices."
                : "Make yourself comfortable."
        }
      >
        {isMemory
          ? "See what is kept across conversations. Correct or remove anything."
          : isPrivacy
            ? "Clear choices about what is saved and how it may be used."
            : "Small preferences that help this space feel more like yours."}
      </Heading>
      <nav className="space-nav">
        {[
          ["preferences", "Preferences"],
          ["memories", "Memory"],
          ["privacy", "Privacy"],
          ["account", "Account"],
        ].map(([id, label]) => (
          <Link
            className={path === "/space/" + id ? "active" : ""}
            href={"/space/" + id}
            key={id}
          >
            {label}
          </Link>
        ))}
      </nav>
      <ErrorBox error={error} />
      <div className="settings-content">
        {!isMemory && !isPrivacy && !isAccount ? (
          <section className="panel">
            <h2>A little about your space</h2>
            <div className="two-col">
              <label>
                Nickname
                <input
                  value={form.nickname}
                  onChange={(e) =>
                    setForm({ ...form, nickname: e.target.value })
                  }
                  maxLength={40}
                />
              </label>
              <label>
                Timezone
                <input
                  value={form.timezone}
                  onChange={(e) =>
                    setForm({ ...form, timezone: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              How would you like support?
              <select
                value={form.preference}
                onChange={(e) =>
                  setForm({ ...form, preference: e.target.value })
                }
              >
                {["Listen first", "Help me reflect", "Be more direct"].map(
                  (o) => (
                    <option key={o}>{o}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Response length
              <select
                value={form.length}
                onChange={(e) => setForm({ ...form, length: e.target.value })}
              >
                <option>Adaptive</option>
                <option>Short</option>
                <option>Balanced</option>
              </select>
            </label>
            <h3>Your listener</h3>
            <div className="companion-choices">
              {characterIds.map((c) => (
                <button
                  className={
                    "choice " + (form.companion === c ? "selected" : "")
                  }
                  onClick={() => setForm({ ...form, companion: c })}
                  key={c}
                >
                  <Companion type={c} />
                  <span>
                    {c === "black_cat"
                      ? "Black cat · male voice"
                      : "White cat · female voice"}
                  </span>
                </button>
              ))}
            </div>
            <p className="muted">
              Changing appearance keeps your account, memories, and plans.
            </p>
            <div className="form-actions">
              <Save state={state} />
              <button className="button primary" disabled={busy} onClick={save}>
                Save preferences <Check size={16} />
              </button>
            </div>
          </section>
        ) : isMemory ? (
          <>
            <section className="panel">
              <div className="panel-title">
                <Shield size={20} />
                <h2>How memory works here</h2>
              </div>
              <p>
                In automatic mode, selected things you explicitly share can be
                organized after a completed conversation turn. There are no
                per-memory approval dialogs. You can correct or withdraw
                memories, and change modes below.
              </p>
              <label>
                Memory mode
                <select
                  value={form.memoryMode}
                  onChange={(e) =>
                    setForm({ ...form, memoryMode: e.target.value })
                  }
                >
                  <option value="automatic">
                    Automatic · selected details across conversations
                  </option>
                  <option value="manual">Manual · only memories you add</option>
                  <option value="temporary">
                    Temporary · no app history or long-term memory
                  </option>
                  <option value="off">
                    Off · save conversation history, no long-term memory
                  </option>
                </select>
              </label>
              <p className="muted">
                Temporary chat does not mean zero retention by external AI
                providers. Turning memory off does not delete existing memories.
              </p>
              <div className="form-actions">
                <Save state={state} />
                <button
                  className="button primary"
                  onClick={save}
                  disabled={busy}
                >
                  Save memory mode
                </button>
              </div>
            </section>
            <section className="panel">
              <div className="section-label">
                <h2>What’s remembered</h2>
                <span className="pill">{p.memoryMode}</span>
              </div>
              {memories.length === 0 ? (
                <div className="memory-empty">
                  <Leaf size={28} />
                  <p>No active memories to show.</p>
                  <small>Memories are not invented to fill this page.</small>
                </div>
              ) : (
                memories.map((m) => (
                  <div className="memory-card" key={m.id}>
                    <p>{m.text || m.memory}</p>
                    <small>
                      {m.source || "Conversation memory"} ·{" "}
                      {m.date
                        ? new Date(m.date).toLocaleDateString()
                        : "Date unavailable"}
                    </small>
                    <div>
                      <button
                        className="text-button"
                        onClick={() => {
                          setMemoryText(m.text || m.memory || "");
                          setEditId(m.id);
                        }}
                      >
                        Correct
                      </button>
                      <button
                        className="text-button danger"
                        onClick={async () => {
                          try {
                            await api("memories/" + m.id, "DELETE");
                            await loadMemory();
                          } catch (e) {
                            setError((e as Error).message);
                            await loadMemory();
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
              <label>
                {editId
                  ? "Correct this memory"
                  : "Add something you want remembered"}
                <textarea
                  rows={2}
                  value={memoryText}
                  onChange={(e) => setMemoryText(e.target.value)}
                  placeholder="A continuing support preference, in your words…"
                />
              </label>
              <button
                className="button outline"
                disabled={
                  !memoryText.trim() ||
                  ["off", "temporary"].includes(p.memoryMode)
                }
                onClick={async () => {
                  try {
                    await api(
                      "memories" + (editId ? "/" + editId : ""),
                      editId ? "PATCH" : "POST",
                      { text: memoryText },
                    );
                    setMemoryText("");
                    setEditId("");
                    await loadMemory();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                {editId ? "Save correction" : "Add memory"}
                <Plus size={16} />
              </button>
              {demo && (
                <small className="demo-note">
                  Demo memories are fictional local records. The live adapter
                  uses internal Mem0 OSS.
                </small>
              )}
            </section>
          </>
        ) : isPrivacy ? (
          <>
            <section className="panel prose">
              <Shield size={28} />
              <h2>Private doesn’t mean invisible to providers.</h2>
              <p>
                In live mode, your account uses Supabase Auth. Application
                records are stored in PostgreSQL with ownership policies.
                Configured Anthropic Claude services process conversation
                context, selected memories, and requested plan discussion. Mem0
                runs internally for selected long-term memories.
              </p>
              <p>
                Claude API requests follow Anthropic’s data retention policies.
                This prototype does not guarantee zero provider retention. Data
                is not end-to-end encrypted by this prototype; configured
                service operators may have access. Encryption at rest and
                backups depend on your deployment providers.
              </p>
              <p>
                No family member, friend, or clinician receives automatic
                access. There is no session replay, advertising tracking, or
                automatic external sharing in this application.
              </p>
              <h3>Your reflections have separate controls.</h3>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.reflectionAI}
                  onChange={(e) =>
                    setForm({ ...form, reflectionAI: e.target.checked })
                  }
                />{" "}
                Allow new reflections to be used in AI review
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.reflectionMemory}
                  onChange={(e) =>
                    setForm({ ...form, reflectionMemory: e.target.checked })
                  }
                />{" "}
                Allow new reflections to be considered for long-term memory
              </label>
              <p className="muted">
                Defaults are off. These permissions are recorded for each new
                save. Reflection AI review and extraction are not scheduled by
                this prototype; enabling a permission does not trigger
                processing.
              </p>
              <div className="form-actions">
                <Save state={state} />
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={save}
                >
                  Save privacy choices
                </button>
              </div>
              <h3>Corrections and deletion</h3>
              <p>
                Withdrawing a memory excludes it from retrieval immediately.
                Associated queued work and source extraction are blocked. Remote
                cleanup can remain pending if a provider is unavailable.
                Requests already transmitted cannot be recalled. Backups and
                provider retention are subject to their own policies.
              </p>
              {demo && (
                <div className="notice">
                  Demo records are stored in isolated files on this machine for
                  up to the configured cleanup period, not in browser
                  localStorage. Use fictional information only. The local demo
                  is not a production security boundary.
                </div>
              )}
              <Link href="/space/account">
                Export or delete your account <ArrowRight size={15} />
              </Link>
            </section>
          </>
        ) : (
          <>
            <section className="panel">
              <h2>A copy, for you.</h2>
              <p>
                Download your own saved application records and active memories.
                The file contains private data; choose where to keep it.
              </p>
              <button
                className="button outline"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await fetch("/api/export");
                    if (!res.ok) {
                      const d = await res.json();
                      throw new Error(d.error);
                    }
                    download(
                      await res.text(),
                      "haven-export.json",
                      "application/json",
                    );
                    setState("Export downloaded");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Download size={16} /> Export my data
              </button>
              <Save state={state} />
            </section>
            <section className="panel danger-panel">
              <h2>Close this space.</h2>
              <p>
                Account deletion immediately blocks access and queues
                application and Mem0 cleanup. It cannot recall transmitted
                requests or erase provider backups on demand.
              </p>
              {deleteConfirm ? (
                <>
                  <label className="checkbox">
                    <input type="checkbox" checked readOnly /> I understand
                    access will be blocked and cleanup may remain pending.
                  </label>
                  <div className="form-actions">
                    <button
                      className="button outline"
                      onClick={() => setDeleteConfirm(false)}
                    >
                      Keep account
                    </button>
                    <button
                      className="button destructive"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api("account", "DELETE");
                          router.push("/login");
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Delete my account
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="button outline danger"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 size={16} /> Delete account
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
