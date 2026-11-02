"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { friendsDemoSnapshot, demoNina } from "@/lib/friends-demo";
import DemoMealVideo from "./demo-meal-video";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  MessageCircle,
  Share2,
  Users,
  Utensils,
  Video,
  X,
} from "lucide-react";
import { api } from "@/lib/client";
import { extractInvite, type FriendsSnapshot } from "@/lib/friends-model";
import MealVideo from "./meal-video";
const pendingKey = "haven.friendInvite";
export default function FriendsView({
  inviteRequest,
  nickname,
}: {
  inviteRequest: number;
  nickname: string;
}) {
  const router = useRouter(),
    search = useSearchParams();
  const demo = search.get("preview") === "1";
  const [demoState, setDemoState] = useState(() =>
    friendsDemoSnapshot(nickname),
  );
  const [liveState, setState] = useState<FriendsSnapshot | null>(null),
    [mode, setMode] = useState<"home" | "chat" | "meal">("home"),
    [modal, setModal] = useState<"invite" | "join" | "members" | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [text, setText] = useState(""),
    [code, setCode] = useState(""),
    [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(
      null,
    ),
    [preview, setPreview] = useState<{
      inviter: string;
      members: number;
    } | null>(null),
    [copied, setCopied] = useState(false),
    [video, setVideo] = useState<{
      url: string;
      token: string;
      mealId: string;
    } | null>(null),
    [loading, setLoading] = useState(true);
  const state = demo ? demoState : liveState;
  const dialog = useRef<HTMLDialogElement>(null),
    bottom = useRef<HTMLDivElement>(null),
    inFlight = useRef(false),
    lastInviteRequest = useRef(0),
    active = useRef(true),
    lastFetch = useRef(0),
    videoGeneration = useRef(0);
  const load = useCallback(async () => {
    if (demo) {
      setLoading(false);
      return;
    }
    if (inFlight.current || Date.now() - lastFetch.current < 600) return;
    inFlight.current = true;
    lastFetch.current = Date.now();
    try {
      const next = await api<FriendsSnapshot>("friends");
      if (active.current) setState(next);
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      inFlight.current = false;
      if (active.current) setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    active.current = true;
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 5000);
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => {
      active.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [load]);
  useEffect(() => {
    const key = state?.group?.notificationKey;
    if (
      demo ||
      !key ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
      return;
    const realtime = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const channel = realtime
      .channel("friends-" + key)
      .on("broadcast", { event: "changed" }, () => void load())
      .subscribe();
    return () => {
      void realtime.removeChannel(channel);
    };
  }, [state?.group?.notificationKey, load, demo]);
  useEffect(() => {
    if (mode === "chat")
      bottom.current?.scrollIntoView({ block: "nearest", behavior: "auto" });
  }, [state?.messages.length, mode]);
  useEffect(() => {
    if (!video) return;
    const meal = state?.group?.meal;
    if (
      !meal ||
      meal.id !== video.mealId ||
      !state.group?.members.some((m) => m.id === state.userId)
    )
      setVideo(null);
  }, [state, video]);
  useEffect(() => {
    const element = dialog.current;
    if (modal) {
      element?.showModal();
      element?.querySelector<HTMLElement>("button,input")?.focus();
    }
    return () => element?.close();
  }, [modal]);
  const act = useCallback(
    async (action: string, data: Record<string, unknown> = {}) => {
      setBusy(true);
      setError("");
      if (demo) {
        const next = structuredClone(demoState);
        if (action === "message")
          next.messages.push({
            id: crypto.randomUUID(),
            senderId: next.userId,
            name: nickname,
            text: String(data.text),
            createdAt: new Date().toISOString(),
          });
        if (action === "start-meal" && next.group && !next.group.meal)
          next.group.meal = {
            id: crypto.randomUUID(),
            createdBy: next.userId,
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7200000).toISOString(),
            checkedIn: [demoNina],
            roomUrl: "demo",
          };
        if (action === "check-in" && next.group?.meal)
          next.group.meal.checkedIn = [
            ...new Set([...next.group.meal.checkedIn, next.userId]),
          ];
        if (action === "leave-meal" && next.group?.meal)
          next.group.meal.checkedIn = next.group.meal.checkedIn.filter(
            (id) => id !== next.userId,
          );
        if (action === "end-meal" && next.group) next.group.meal = null;
        if (action === "leave-group") next.group = null;
        setDemoState(next);
        setBusy(false);
        return {
          ...next,
          ...(action === "invite"
            ? {
                code: "DEMO-PREVIEW",
                expiresAt: new Date(Date.now() + 86400000).toISOString(),
              }
            : {}),
        };
      }
      try {
        const next = await api<
          FriendsSnapshot & { code?: string; expiresAt?: string }
        >("friends", "POST", { action, ...data });
        if (!active.current) return null;
        setState(next);
        return next;
      } catch (e) {
        if (active.current) setError((e as Error).message);
        return null;
      } finally {
        if (active.current) setBusy(false);
      }
    },
    [demo, demoState, nickname],
  );
  const openInvite = useCallback(async () => {
    if (busy) return;
    setModal("invite");
    setInvite(null);
    setCopied(false);
    const next = await act("invite");
    if (next?.code && next.expiresAt)
      setInvite({ code: next.code, expiresAt: next.expiresAt });
  }, [act, busy]);
  useEffect(() => {
    if (inviteRequest > lastInviteRequest.current) {
      lastInviteRequest.current = inviteRequest;
      void openInvite();
    }
  }, [inviteRequest, openInvite]);
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1)).get(
      "invite",
    );
    const pending = fragment || sessionStorage.getItem(pendingKey);
    if (pending) {
      setCode(pending);
      setModal("join");
      setPreview(null);
      sessionStorage.setItem(pendingKey, pending);
      if (fragment)
        history.replaceState(null, "", location.pathname + location.search);
    }
  }, []);
  async function inspect() {
    if (demo) {
      setPreview({ inviter: "Nina", members: 2 });
      return;
    }
    setBusy(true);
    setError("");
    try {
      const token = extractInvite(code);
      setCode(token);
      setPreview(
        await api("friends", "POST", { action: "preview", code: token }),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Please check the invite code.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function join() {
    if (demo) {
      setModal(null);
      setPreview(null);
      return;
    }
    const next = await act("join", { code: extractInvite(code) });
    if (next) {
      sessionStorage.removeItem(pendingKey);
      setModal(null);
      setCode("");
      setPreview(null);
      setMode("home");
    }
  }
  const shareText = demo
    ? `Haven demo preview: ${typeof window !== "undefined" ? window.location.origin : ""}/friends?preview=1`
    : invite
      ? `Join my private Haven space: ${typeof window !== "undefined" ? window.location.origin : ""}/friends#invite=${invite.code}\nInvite code: ${invite.code}`
      : "";
  async function share() {
    if (!shareText) return;
    try {
      if (navigator.share)
        await navigator.share({ title: "Join me on Haven", text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError("Sharing isn't available. Please copy the invitation.");
    }
  }
  async function send() {
    if (!text.trim() || busy) return;
    const message = text.trim();
    if (await act("message", { text: message, requestId: crypto.randomUUID() }))
      setText("");
  }
  async function checkIn() {
    const epoch = ++videoGeneration.current;
    const meal = state?.group?.meal;
    if (!meal) return;
    const next = await act("check-in", { mealId: meal.id });
    if (
      next?.videoReady &&
      next.group?.meal?.roomUrl &&
      epoch === videoGeneration.current
    ) {
      if (demo) {
        setVideo({ url: "demo", token: "", mealId: meal.id });
        return;
      }
      setBusy(true);
      try {
        const result = await api<{
          url: string;
          token: string;
          mealId: string;
        }>("friends", "POST", { action: "video", mealId: meal.id });
        if (active.current && epoch === videoGeneration.current)
          setVideo(result);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }
  }
  async function leaveVideo() {
    videoGeneration.current++;
    const id = video?.mealId;
    setVideo(null);
    if (id) await act("leave-meal", { mealId: id });
  }
  const group = state?.group,
    meal = group?.meal,
    checked = !!meal?.checkedIn.includes(state?.userId || "");
  return (
    <div className="f-friends">
      {demo && (
        <div className="f-preview-banner">
          <span>Demo preview</span>
          <button
            onClick={() => {
              setMode("home");
              setVideo(null);
              setModal(null);
              setError("");
              router.replace("/friends");
            }}
          >
            Exit preview
          </button>
        </div>
      )}
      {error && (
        <p className="m-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="f-loading" role="status">
          Opening your space…
        </p>
      ) : mode === "home" ? (
        <>
          <section className="m-card f-feature">
            <span className="f-feature-icon">
              <MessageCircle size={25} />
            </span>
            <h2>Private Chat</h2>
            <p>A little company, just for us.</p>
            <button
              className="m-primary"
              disabled={busy}
              onClick={async () => {
                if (group || (await act("open"))) setMode("chat");
              }}
            >
              Open chat
            </button>
          </section>
          <section className="m-card f-feature">
            <span className="f-feature-icon">
              <Utensils size={25} />
            </span>
            <h2>Eat Together</h2>
            <p>Share a meal, wherever you are.</p>
            <button
              className="m-primary"
              disabled={busy}
              onClick={async () => {
                if (meal || (await act("start-meal"))) setMode("meal");
              }}
            >
              {meal ? "Join meal" : "Start a meal"}
            </button>
          </section>
          {group && (
            <button
              className="f-members-link"
              onClick={() => setModal("members")}
            >
              <span className="f-avatar-stack">
                {group.members.map((m) => (
                  <i key={m.id} aria-label={m.name}>
                    {m.name.charAt(0).toUpperCase()}
                  </i>
                ))}
              </span>
              <span>
                {group.members.length}{" "}
                {group.members.length === 1 ? "member" : "members"}
              </span>
            </button>
          )}
          <button
            className="m-underlined f-join-code"
            onClick={() => {
              setModal("join");
              setPreview(null);
            }}
          >
            Join with a code
          </button>
          {!demo && (
            <button
              className="f-preview-link"
              onClick={() => {
                setMode("home");
                setVideo(null);
                setModal(null);
                setError("");
                router.replace("/friends?preview=1");
              }}
            >
              Preview demo
            </button>
          )}
        </>
      ) : mode === "chat" ? (
        <div className="f-chat">
          <div className="f-pane-heading">
            <button
              aria-label="Back to Friends"
              onClick={() => setMode("home")}
            >
              <ArrowLeft size={21} />
            </button>
            <h2>Private Chat</h2>
            <button
              aria-label="Group members"
              onClick={() => setModal("members")}
            >
              <Users size={21} />
            </button>
          </div>
          <div
            className="f-messages"
            aria-live="polite"
            aria-relevant="additions"
          >
            {!state?.messages.length && (
              <p className="f-empty">Your space to catch up.</p>
            )}
            {state?.messages.map((message) => (
              <article
                className={
                  "f-message " +
                  (message.senderId === state.userId ? "own" : "")
                }
                key={message.id}
              >
                {message.senderId !== state.userId && (
                  <small>{message.name}</small>
                )}
                <p>{message.text}</p>
                <time dateTime={message.createdAt}>
                  {new Date(message.createdAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </article>
            ))}
            <div ref={bottom} />
          </div>
          <form
            className="f-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              aria-label="Message your friends"
              placeholder="Message your friends…"
              value={text}
              rows={1}
              maxLength={2000}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              className="m-primary"
              aria-label="Send group message"
              disabled={busy || !text.trim()}
            >
              <ArrowUp size={21} />
            </button>
          </form>
        </div>
      ) : (
        <div className="f-meal">
          <div className="f-pane-heading">
            <button
              aria-label="Back to Friends"
              onClick={() => {
                void leaveVideo();
                setMode("home");
              }}
            >
              <ArrowLeft size={21} />
            </button>
            <h2>Eat Together</h2>
          </div>
          {meal ? (
            <>
              <div className="f-checkins">
                {group?.members.map((m) => (
                  <div key={m.id}>
                    <span className="f-person">
                      {m.name.charAt(0).toUpperCase()}
                    </span>
                    <span>{m.name}</span>
                    {meal.checkedIn.includes(m.id) && (
                      <Check size={16} aria-label="Checked in" />
                    )}
                  </div>
                ))}
              </div>
              {video ? (
                <>
                  {demo ? (
                    <DemoMealVideo
                      name={nickname}
                      onLeave={() => void leaveVideo()}
                    />
                  ) : (
                    <MealVideo
                      credentials={video}
                      onLeave={() => void leaveVideo()}
                      onError={(message) => setError(message)}
                    />
                  )}
                  {!demo && (
                    <button
                      className="m-outline"
                      onClick={() => void leaveVideo()}
                    >
                      Leave video
                    </button>
                  )}
                </>
              ) : (
                <section className="m-card f-meal-waiting">
                  <Video size={38} />
                  <h3>{checked ? "You're here." : "A seat for you."}</h3>
                  <p>
                    {state?.videoReady && meal.roomUrl
                      ? "Camera and microphone start off."
                      : "Video isn't available yet."}
                  </p>
                  <button
                    className="m-primary"
                    disabled={busy}
                    onClick={() => void checkIn()}
                  >
                    {checked
                      ? state?.videoReady && meal.roomUrl
                        ? "Join video"
                        : "Checked in"
                      : "I'm here"}
                  </button>
                </section>
              )}
              {(meal.createdBy === state?.userId ||
                group?.ownerId === state?.userId) && (
                <button
                  className="m-underlined"
                  disabled={busy}
                  onClick={async () => {
                    if (window.confirm("End this meal for everyone?")) {
                      setVideo(null);
                      if (await act("end-meal")) setMode("home");
                    }
                  }}
                >
                  End meal
                </button>
              )}
            </>
          ) : (
            <section className="m-card f-meal-waiting">
              <p>This meal has ended.</p>
              <button className="m-primary" onClick={() => setMode("home")}>
                Back to Friends
              </button>
            </section>
          )}
        </div>
      )}
      {modal && (
        <dialog
          ref={dialog}
          className="f-dialog"
          onCancel={() => setModal(null)}
        >
          <button
            className="f-dialog-close"
            aria-label="Close dialog"
            onClick={() => {
              setModal(null);
              if (modal === "join") sessionStorage.removeItem(pendingKey);
            }}
          >
            <X size={21} />
          </button>
          {modal === "invite" ? (
            <>
              <h2>Invite a friend</h2>
              {invite ? (
                <>
                  <p className="f-dialog-note">
                    {demo
                      ? "Preview only. No members will be added."
                      : "A private invitation, valid for 24 hours."}
                  </p>
                  <output className="f-invite-code">{invite.code}</output>
                  <button
                    className="m-primary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(shareText);
                        setCopied(true);
                      } catch {
                        setError(
                          "Copy isn't available. Select the code above.",
                        );
                      }
                    }}
                  >
                    {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
                    {copied ? "Copied" : "Copy invite"}
                  </button>
                  <button className="m-outline" onClick={() => void share()}>
                    <Share2 size={17} /> Share
                  </button>
                  <button
                    className="m-underlined"
                    disabled={busy}
                    onClick={async () => {
                      if (await act("revoke")) {
                        setInvite(null);
                        setModal(null);
                      }
                    }}
                  >
                    Revoke invitation
                  </button>
                </>
              ) : (
                <p role="status">
                  {busy
                    ? "Creating invitation…"
                    : "Invitation could not be created."}
                </p>
              )}
              <button
                className="m-underlined"
                onClick={() => {
                  setModal("join");
                  setPreview(null);
                }}
              >
                Join with a code
              </button>
            </>
          ) : modal === "join" ? (
            <>
              <h2>Join your friend</h2>
              {preview ? (
                <>
                  <p>Join {preview.inviter}’s private space?</p>
                  <button
                    className="m-primary"
                    disabled={busy}
                    onClick={() => void join()}
                  >
                    Join
                  </button>
                  <button
                    className="m-outline"
                    onClick={() => setPreview(null)}
                  >
                    Use another code
                  </button>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void inspect();
                  }}
                >
                  <label htmlFor="friend-invite-code">
                    Invite link or code
                  </label>
                  <input
                    id="friend-invite-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={500}
                  />
                  <button className="m-primary" disabled={busy || !code.trim()}>
                    {busy ? "Checking…" : "Continue"}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <h2>Our little space</h2>
              <div className="f-member-list">
                {group?.members.map((m) => (
                  <div key={m.id}>
                    <span className="f-person">
                      {m.name.charAt(0).toUpperCase()}
                    </span>
                    {m.name}
                    {m.id === group.ownerId && <small>Host</small>}
                  </div>
                ))}
              </div>
              <p className="f-dialog-note">
                Only members can see group messages. Your journal and Memory
                stay private.
              </p>
              <button
                className="m-danger"
                disabled={busy}
                onClick={async () => {
                  if (
                    window.confirm(
                      group?.ownerId === state?.userId
                        ? "Close this group for everyone?"
                        : "Leave this private group?",
                    )
                  ) {
                    setVideo(null);
                    if (await act("leave-group")) {
                      setModal(null);
                      setMode("home");
                    }
                  }
                }}
              >
                {group?.ownerId === state?.userId
                  ? "Close group"
                  : "Leave group"}
              </button>
            </>
          )}
          {error && (
            <p className="m-error" role="alert">
              {error}
            </p>
          )}
        </dialog>
      )}
    </div>
  );
}
