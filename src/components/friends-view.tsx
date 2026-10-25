"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { friendsDemoSnapshot, demoNina } from "@/lib/friends-demo";
import DemoMealVideo from "./demo-meal-video";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowLeft,
  
  Check,
  Copy,

  Share2,

  Utensils,
  Video,
  X,
  ChevronRight,
  MoreHorizontal,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { api } from "@/lib/client";
import { privateInvite, type FriendsSnapshot } from "@/lib/friends-model";
import PrivateGroupChat from "./private-group-chat";
import MealVideo from "./meal-video";
import FriendActivityArt from "./friend-activity-art";
import FriendActivityIcon from "./friend-activity-icon";
import DigitalMeal from "./digital-meal";
import { friendColor, friendInitial } from "@/lib/friends-ui";
const pendingKey = "haven.friendInvite";
export default function FriendsView({
  inviteRequest,
  nickname,
  avatar,
  companionName,
}: {
  inviteRequest: number;
  nickname: string;
  avatar: string;
  companionName: string;
}) {
  const router = useRouter(),
    search = useSearchParams();
  const demo = search.get("preview") === "1";
  const [demoState, setDemoState] = useState(() =>
    friendsDemoSnapshot(nickname),
  );
  const [liveState, setState] = useState<FriendsSnapshot | null>(null),
    [mode, setMode] = useState<"home" | "chat" | "meal-choice" | "digital-meal" | "meal">(() => search.get("mode") === "digital-meal" ? "digital-meal" : "home"),
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
    [loading, setLoading] = useState(true),
    [sendFailed, setSendFailed] = useState(false);
  const state = demo ? demoState : liveState;
  const messageRequest = useRef<{ text: string; id: string } | null>(null),
    sendingMessage = useRef(false);
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
            kind: data.kind as "moment" | undefined, images: data.images as string[] | undefined,
          });
        if (action === "status" && next.group) next.group.members = next.group.members.map(m => m.id === next.userId ? {...m,status:data.status as "good"|"hard"|"company"|"break"} : m);
        if (action === "pat" && next.group) { const target = next.group.members.find(m=>m.id===data.targetId); if(target) next.messages.push({id:crypto.randomUUID(),senderId:next.userId,name:nickname,text:`${nickname} patted ${target.name} — here with you.`,kind:"pat",createdAt:new Date().toISOString()}); }
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
      setCode(fragment ? `${window.location.origin}/friends#invite=${fragment}` : pending.startsWith("http") ? pending : `${window.location.origin}/friends#invite=${pending}`);
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
      privateInvite(code, window.location.origin);
      setPreview(
        await api("friends", "POST", { action: "preview", link: code }),
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
    const next = await act("join", { link: code });
    if (next) {
      sessionStorage.removeItem(pendingKey);
      setModal(null);
      setCode("");
      setPreview(null);
      setMode("home");
    }
  }
  const shareText = demo
    ? `Milo demo preview: ${typeof window !== "undefined" ? window.location.origin : ""}/friends?preview=1`
    : invite
      ? `Join my private Milo space: ${typeof window !== "undefined" ? window.location.origin : ""}/friends#invite=${invite.code}`
      : "";
  async function share() {
    if (!shareText) return;
    try {
      if (navigator.share)
        await navigator.share({ title: "Join me on Milo", text: shareText });
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
    if (!text.trim() || busy || sendingMessage.current) return;
    sendingMessage.current = true;
    const message = text.trim();
    if (!messageRequest.current || messageRequest.current.text !== message)
      messageRequest.current = { text: message, id: crypto.randomUUID() };
    const requestId = messageRequest.current.id;
    setSendFailed(false);
    try {
      if (await act("message", { text: message, requestId })) {
        messageRequest.current = null;
        setText(current => current.trim() === message ? "" : current);
      } else setSendFailed(true);
    } finally { sendingMessage.current = false; }
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
    <div className={`f-friends f-view-${mode}`}>
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
      {loading && mode !== "digital-meal" ? (
        <p className="f-loading" role="status">
          Opening your space…
        </p>
      ) : mode === "home" ? (
        <div className="f-home-actions">
          <section className="m-card f-feature f-feature-chat">
            <FriendActivityIcon kind="chat" />
            <div className="f-feature-content"><h2>Private Chat</h2></div>
            <button className="f-feature-open" aria-label="Open private chat" disabled={busy} onClick={async () => { if (group || (await act("open"))) setMode("chat"); }}><ChevronRight size={21} /></button>
          </section>
          <section className="m-card f-feature f-feature-meal">
            <FriendActivityIcon kind="meal" />
            <div className="f-feature-content"><h2>Eat Together</h2></div>
            <button className="f-feature-open" aria-label="Choose who to eat with" disabled={busy} onClick={() => setMode("meal-choice")}><ChevronRight size={21} /></button>
          </section>
        </div>
      ) : mode === "meal-choice" ? (
        <div className="f-meal-choice">
          <div className="f-pane-heading"><button aria-label="Back to Friends" onClick={() => setMode("home")}><ArrowLeft size={21} /></button><h2>Eat Together</h2></div>
          <div className="f-company-grid">
          <button className="f-company-option f-company-cat" onClick={() => setMode("digital-meal")}><FriendActivityIcon kind="cat" /><span className="f-company-label">With your cat</span><ChevronRight size={20} /></button>
          <button className="f-company-option f-company-friends" disabled={busy} onClick={async () => { if (meal || await act("start-meal")) setMode("meal"); }}><FriendActivityIcon kind="video" /><span className="f-company-label">With friends</span><ChevronRight size={20} /></button>
          </div>
        </div>
      ) : mode === "digital-meal" ? (
        <DigitalMeal avatar={avatar} name={companionName} onBack={() => setMode("meal-choice")} />
      ) : mode === "chat" ? (
        <>
          {state && <PrivateGroupChat state={state} busy={busy} text={text} setText={setText} send={()=>void send()} act={act} back={()=>setMode("home")} members={()=>setModal("members")} meal={()=>setMode("meal-choice")} />}
          {sendFailed && <button className="f-send-retry" onClick={()=>void send()}><RotateCcw size={14}/> Try sending again</button>}
        </>
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
            <span className="f-channel-icon"><Utensils size={22} /></span><div className="f-pane-title"><h2>Eat Together</h2><small>{video ? "A little company at the table" : "There’s no rush"}</small></div>
            {meal && (meal.createdBy === state?.userId || group?.ownerId === state?.userId) && <details className="f-meal-menu"><summary aria-label="Meal options"><MoreHorizontal size={23} /></summary><button type="button" disabled={busy} onClick={async () => {
              if (window.confirm("End this meal for everyone?")) { videoGeneration.current++;setVideo(null);if(await act("end-meal"))setMode("home"); }
            }}>End meal for everyone</button></details>}
          </div>
          {meal ? (
            <>
              <div className="f-checkins">
                {group?.members.map((m) => (
                  <div key={m.id}>
                    <span className="f-person" style={{background:friendColor(m.id)}}>{friendInitial(m.name)}</span>
                    <span>{m.id === state?.userId ? "You" : m.name}</span><small>{meal.checkedIn.includes(m.id) ? "Here" : "Not here yet"}</small>
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
                      nickname={nickname}
                      onReconnect={checkIn}
                      onLeave={() => void leaveVideo()}
                      onError={(message) => setError(message)}
                    />
                  )}
                </>
              ) : (
                <section className="m-card f-meal-waiting">
                  <FriendActivityArt kind="meal" />
                  <h3>{checked ? "You're here." : "A seat for you."}</h3>
                  <p>
                    {state?.videoReady && meal.roomUrl
                      ? "Camera and microphone start off."
                      : "You can still check in and share this moment."}
                  </p>
                  <button
                    className="m-primary"
                    disabled={busy}
                    onClick={() => void checkIn()}
                  >
                    {checked
                      ? state?.videoReady && meal.roomUrl
                        ? "Join video"
                        : "You’re checked in"
                      : state?.videoReady && meal.roomUrl ? "Join the table" : "I'm here"}
                  </button>
                </section>
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
          className={`f-dialog ${modal === "invite" ? "f-dialog-invite" : ""}`}
          aria-label={modal === "invite" ? "Invite a friend" : modal === "join" ? "Join your friend" : "Group members"}
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
              {invite ? <>
                <output className="f-invite-code" aria-label="Private invitation link">{typeof window !== "undefined" ? window.location.origin : ""}/friends#invite={invite.code}</output>
                <div className="f-invite-actions">
                  <button className="m-primary" onClick={async () => { try { await navigator.clipboard.writeText(`${window.location.origin}/friends#invite=${invite.code}`);setCopied(true); } catch { setError("Copy isn't available. Select the key above."); } }}>{copied ? <Check size={17} /> : <Copy size={17} />} Copy</button>
                  <button className="m-outline" onClick={() => void share()}><Share2 size={17} /> Share</button>
                </div>
              </> : <span className="f-invite-loading" role="status" aria-label={busy ? "Creating invitation" : "Invitation unavailable"}><LoaderCircle className={busy ? "spin" : ""} size={24} /></span>}
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
                    Use another link
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
                    Private invitation link
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
              {group?.ownerId === state?.userId && <button className="m-outline" disabled={busy} onClick={async () => { if(await act("revoke"))setModal(null); }}>Revoke invite</button>}
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
