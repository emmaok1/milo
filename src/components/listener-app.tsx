"use client";
import { useEffect, useState, useRef, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Home,
  Bell,
  Sun,
  Moon,
  Camera,
  UserRound,
  ChartNoAxesColumnIncreasing,
  MessageCircle,
  Heart,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Plus,
  X,
  Copy,
  Share2,
  Check,
  Star,
  Shield,
  LogOut,
  Leaf,
  Trash2,
} from "lucide-react";
import { Companion } from "./illustrations";
import ReportView from "./report-view";
import AccountAvatar from "./account-avatar";
import SettingsMemory from "./settings-memory";
import SettingsIcon from "./settings-icon";
import HomeRoom from "./home-room";
import ChatCallInvite from "./chat-call-invite";
import ChatBackdrop from "./chat-backdrop";
import { chatThemes } from "@/lib/chat-themes";
import FriendsView from "./friends-view";
import CharacterPicker from "./character-picker";
import { characterId, characterPreset } from "@/lib/characters";
import { api } from "@/lib/client";
import type { Profile, Item } from "@/lib/types";
import { localDate } from "@/lib/types";
import {
  mobileState,
  listenerAvatar,
  recordFeelings,
  mealReactions,
  hasJournalContent,
  journalText,
  journalTime,
  journalDiscussion,
  mealBehaviors,
  encodeListener,
  decodeListener,
  type Listener,
  type MobileState,
  type JournalEntry,
} from "@/lib/listener-model";

type Props = {
  p: Profile;
  demo: boolean;
  refresh: () => Promise<void>;
  renderChat: (prefill?: string) => ReactNode;
  children: ReactNode;
};
type Sheet =
  | "Appearance"
  | "Help"
  | "Notifications"
  | "history"
  | "help"
  | "share"
  | "enter"
  | "install"
  | "about"
  | "Contact"
  | "User Interview"
  | "Write a review"
  | "Send Feedback"
  | null;
const navigation = [
  { href: "/home", label: "Home", Icon: Home },
  { href: "/report", label: "Report", Icon: ChartNoAxesColumnIncreasing },
  { href: "/talk", label: "Chat", Icon: MessageCircle },
  { href: "/friends", label: "Friends", Icon: Heart },
  { href: "/settings", label: "Settings", Icon: Settings },
];
export default function ListenerApp({
  p,
  demo,
  refresh,
  renderChat,
  children,
}: Props) {
  const path = usePathname(),
    router = useRouter(),
    search = useSearchParams();
  const [state, setState] = useState<MobileState>(() => mobileState(p.mobile));
  const [draft, setDraft] = useState<Listener>(
    () => mobileState(p.mobile).listener,
  );
  const [sheet, setSheet] = useState<Sheet>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState("");
  const [code, setCode] = useState(""),
    [copied, setCopied] = useState(false),
    [feedback, setFeedback] = useState(""),
    [rating, setRating] = useState(0);
  const [accountId, setAccountId] = useState("");
  const [idCopied, setIdCopied] = useState(false);
  const [date, setDate] = useState(() => localDate(p.timezone));
  const [entry, setEntry] = useState<Partial<JournalEntry>>({
    private: true,
    feelings: [],
    behaviors: [],
    reactions: [],
    recordVersion: 2,
    note: "",
    time: journalTime(p.timezone),
  });
  const dialogRef = useRef<HTMLElement>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [friendInvite, setFriendInvite] = useState(0);
  const [conversations] = useState<Item[]>([]);
  const [loadingHistory] = useState(false);
  const listener = state.listener;
  const isChat = path.startsWith("/talk"),
    isRecord = path === "/record",
    isListener = path === "/listener";
  const showCompanionHelp = isChat || path === "/report" || path === "/friends";
  const isSettings = path === "/settings" || path === "/space/preferences";
  useEffect(() => {
    if (!isSettings) return;
    let active = true;
    api<{ userId: string }>("session").then(value => { if (active) setAccountId(value.userId); }).catch(() => {});
    return () => { active = false; };
  }, [isSettings]);
  useEffect(() => {
    setState(mobileState(p.mobile));
    setDraft(mobileState(p.mobile).listener);
  }, [p.mobile]);
  useEffect(() => {
    setError("");
    setSaved("");
  }, [path]);
  useEffect(() => {
    if (path === "/record") {
      const id = search.get("id");
      const found = state.journal.find((e) => e.id === id);
      if (found) {
        setEntry({ ...found, note: journalText(found), food: undefined });
        setDate(found.date);
      } else
        setEntry({
          private: true,
          feelings: [],
          behaviors: [],
          reactions: [],
          recordVersion: 2,
          note: "",
          time: journalTime(p.timezone),
        });
    }
  }, [path, search, state.journal, p.timezone]);
  useEffect(() => {
    if (!sheet) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("button, input, textarea, a")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheet(null);
      if (event.key !== "Tab" || !dialog) return;
      const elements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not(:disabled),input,textarea,a[href],select",
        ),
      );
      const first = elements[0],
        last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [sheet]);
  async function mutate(action: string, value?: unknown, id?: string) {
    setBusy(true);
    setError("");
    try {
      const next = await api<MobileState>("mobile", "POST", {
        action,
        value,
        id,
      });
      setState(next);
      await refresh();
      return next;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  function open(value: Sheet) {
    setError("");
    setSaved("");
    setCopied(false);
    setSheet(value);
  }
  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const month = new Date(date + "T12:00:00");
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const monthDays = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const monthOffset = (monthStart.getDay() + 6) % 7;
  function moveMonth(amount: number) {
    setDate(
      dateKey(new Date(month.getFullYear(), month.getMonth() + amount, 1, 12)),
    );
  }
  const daily = state.journal
    .filter((e) => e.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
  const chosen = state.journal.find(
    (e) => e.id === search.get("entry") && e.private === false,
  );
  const prefill = chosen ? journalDiscussion(chosen) : undefined;
  const title = isRecord
    ? "Meal journal"
    : isListener
      ? "Your listener"
      : isChat
        ? "Chat"
        : path === "/home"
          ? "Milo"
          : path === "/report"
            ? "Report"
            : path === "/friends"
              ? "Friends"
              : path === "/space/memories"
                ? "Memory"
                : isSettings
                ? "Settings"
                : "Your space";
  const toggle = (values: string[], value: string) =>
    values.includes(value)
      ? values.filter((v) => v !== value)
      : [...values, value];
  const complete = !!(date && entry.time && hasJournalContent(entry));
  async function attachMealPhoto(file?: File) {
    if (!file) return;
    setPhotoBusy(true);
    setError("");
    try {
      if (
        !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type) ||
        file.size > 15000000
      )
        throw new Error(
          "Choose an image under 15 MB. If HEIC is unsupported, use JPEG.",
        );
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const ratio = Math.min(1, 480 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser cannot process the photo.");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      let photo = canvas.toDataURL("image/jpeg", 0.7);
      if (photo.length > 50000) photo = canvas.toDataURL("image/jpeg", 0.35);
      if (photo.length > 50000)
        throw new Error("Please choose a simpler or smaller photo.");
      setEntry((current) => ({ ...current, photo, foodCategory: undefined }));
    } catch (e) {
      setError(
        (e as Error).message || "Unable to read photo. Try a JPEG image.",
      );
    } finally {
      setPhotoBusy(false);
    }
  }
  return (
    <div
      data-chat-theme={state.chatTheme}
      data-chat-mode={state.chatMode}
      className={
        "listener-phone " +
        (path === "/home" ? "reference-home " : "") +
        (isChat ? "chat-screen" : path === "/friends" ? "friends-screen" : isSettings ? "settings-screen" : isRecord || isListener ? "form-screen" : "")
      }
    >
      <header className="m-topbar">
        {isRecord ||
        isListener ||
        (!navigation.some((n) => path === n.href) &&
          !isChat &&
          path !== "/space/preferences") ? (
          <button
            aria-label="Go back"
            onClick={() => router.push(isRecord ? "/home" : "/settings")}
          >
            <ChevronLeft />
          </button>
        ) : (
          <span className="m-header-spacer" />
        )}
        <h1>
          {isRecord ? (
            <label className="m-title-date">
              <span>
                {date
                  ? new Intl.DateTimeFormat("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    }).format(new Date(date + "T12:00:00"))
                  : "Choose a date"}
                <ChevronDown size={16} />
              </span>
              <input
                aria-label="Entry date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          ) : (
            title
          )}
        </h1>
        {path === "/friends" ? (
          <button
            className="m-invite-button"
            onClick={() => setFriendInvite((n) => n + 1)}
          >
            <Plus size={15} aria-hidden="true" /> Invite
          </button>
        ) : path === "/report" ? (
          <button aria-label="Notifications" aria-haspopup="dialog" onClick={() => open("Notifications")}>
            <Bell size={22} />
          </button>
        ) : isChat ? (
          <ChatCallInvite key={path} avatar={listenerAvatar(listener)} />
        ) : (
          <button
            className={showCompanionHelp ? "m-companion-help" : undefined}
            aria-label={showCompanionHelp ? "Your space, your pace" : "Help"}
            aria-haspopup="dialog"
            onClick={() => open("help")}
          >
            {showCompanionHelp ? (
              <Companion type={listenerAvatar(listener)} />
            ) : (
              <CircleHelp />
            )}
          </button>
        )}
      </header>
      <main className={"m-body " + (isChat ? "m-chat-body" : "")}>
        {demo && <p className="m-demo">Fictional demo · sample replies</p>}
        {error && !sheet && (
          <p className="m-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="m-success" role="status">
            {saved}
          </p>
        )}
        {path === "/home" ? (
          <>
            <HomeRoom avatar={listenerAvatar(listener)} name={listener.name} onHelp={() => open("help")} />
            <section className="m-home-journal" aria-label="Your little moments">
            <h2 className="m-moments-title">Your little moments</h2>
            <section
              className="m-calendar m-card"
              aria-label="Meal journal calendar"
            >
              <div className="m-calendar-heading">
                <button
                  aria-label="Previous week or month"
                  onClick={() => {
                    const d = new Date(date + "T12:00:00");
                    if (calendarExpanded) moveMonth(-1);
                    else {
                      d.setDate(d.getDate() - 7);
                      setDate(dateKey(d));
                    }
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  className="m-calendar-expand"
                  aria-expanded={calendarExpanded}
                  onClick={() => setCalendarExpanded(!calendarExpanded)}
                >
                  <span>
                    {month.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <ChevronDown size={16} />
                </button>
                <button
                  aria-label="Next week or month"
                  onClick={() => {
                    const d = new Date(date + "T12:00:00");
                    if (calendarExpanded) moveMonth(1);
                    else {
                      d.setDate(d.getDate() + 7);
                      setDate(dateKey(d));
                    }
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="m-calendar-grid">
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span className="m-weekday" key={i}>
                    {d}
                  </span>
                ))}
                {calendarExpanded &&
                  Array.from({ length: monthOffset }, (_, i) => (
                    <span key={"blank" + i} />
                  ))}
                {Array.from(
                  { length: calendarExpanded ? monthDays : 7 },
                  (_, i) => {
                    const cell = new Date(date + "T12:00:00");
                    if (calendarExpanded) cell.setDate(i + 1);
                    else
                      cell.setDate(
                        cell.getDate() - ((cell.getDay() + 6) % 7) + i,
                      );
                    const key = dateKey(cell);
                    const logged = state.journal.some((e) => e.date === key);
                    return (
                      <button
                        key={key}
                        aria-label={key + (logged ? ", has records" : "")}
                        aria-pressed={date === key}
                        className={
                          (date === key ? "selected " : "") +
                          (key === localDate(p.timezone) ? "today " : "") +
                          (logged ? "has-record" : "")
                        }
                        onClick={() => setDate(key)}
                      >
                        {cell.getDate()}
                      </button>
                    );
                  },
                )}
              </div>
              <button
                className="m-calendar-today"
                onClick={() => setDate(localDate(p.timezone))}
              >
                Back to today
              </button>
            </section>
            {daily.length ? (
              daily.map((e) => (
                <Link
                  key={e.id}
                  href={"/record?id=" + e.id}
                  className="m-card m-entry"
                >
                  <span className="m-entry-time">{e.time}</span>
                  <div>
                    <strong>
                      {e.mealType || "Meal moment"}
                      {e.skipped ? " · Skipped" : ""}
                    </strong>
                    {e.food && <p className="m-entry-food">{e.food}</p>}
                    {e.photo && (
                      <Image
                        unoptimized
                        width={84}
                        height={84}
                        className="m-meal-thumbnail"
                        src={e.photo}
                        alt="Saved meal"
                      />
                    )}
                    <div className="m-entry-tags">
                      {(e.reactions || []).map((r) => (
                        <span key={r}>{r}</span>
                      ))}
                      {e.behaviors.map((b) => (
                        <span key={b}>{b}</span>
                      ))}
                    </div>
                    {[e.location, e.company, e.satiety].some(Boolean) && (
                      <p>
                        {[e.location, e.company, e.satiety]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {!!e.feelings.length && (
                      <p className="m-entry-feelings">
                        {e.feelings.join(" · ")}
                      </p>
                    )}
                    {e.behaviorNote && (
                      <p className="m-entry-note">
                        After eating: {e.behaviorNote}
                      </p>
                    )}
                    {e.note && <p className="m-entry-note">{e.note}</p>}
                  </div>
                  {e.private && <Shield size={16} />}
                  <ChevronRight size={20} />
                </Link>
              ))
            ) : (
              <div className="m-home-empty">
                <Leaf size={25} strokeWidth={1.4} aria-hidden="true" />
                <p>A little space for your day.</p>
              </div>
            )}
            <Link
              href="/record"
              className="m-home-add"
              aria-label="Add a moment"
            >
              <Plus size={20} /> Add a moment
            </Link>
            </section>
          </>
        ) : isRecord ? (
          <>
            <section className="m-card m-meal-log">
              <div className="m-meal-log-heading">
                <h2>
                  Photo <Camera size={22} />
                </h2>
              </div>
              <label className="m-photo-picker">
                {entry.photo ? (
                  <Image
                    unoptimized
                    width={480}
                    height={480}
                    src={entry.photo}
                    alt="Meal preview"
                  />
                ) : (
                  <span>
                    {photoBusy ? "Preparing photo…" : "Photo (optional)"}
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  disabled={photoBusy}
                  onChange={(e) => {
                    void attachMealPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                  aria-label="Add or replace meal photo"
                />
              </label>
              {entry.photo && (
                <label className="m-field">
                  Photo category
                  <select
                    aria-label="Photo category"
                    value={entry.foodCategory || ""}
                    onChange={(e) =>
                      setEntry({
                        ...entry,
                        foodCategory: (e.target.value ||
                          null) as JournalEntry["foodCategory"],
                      })
                    }
                  >
                    <option value="">Unknown</option>
                    {["Meal", "Snack", "Fast food", "Dessert"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
              )}
              {entry.photo && (
                <p className="m-footnote">
                  Claude labels photos for your report. You can edit the
                  category.
                </p>
              )}
              {entry.photo && (
                <button
                  className="m-text-action"
                  onClick={() =>
                    setEntry({
                      ...entry,
                      photo: undefined,
                      foodCategory: undefined,
                    })
                  }
                >
                  Remove photo
                </button>
              )}
            </section>
            <section className="m-card m-switch-row">
              <label htmlFor="meal-time">Time</label>
              <input
                id="meal-time"
                type="time"
                value={entry.time || ""}
                onChange={(e) => setEntry({ ...entry, time: e.target.value })}
              />
            </section>
            <section className="m-card m-field m-journal-feelings">
              <h2>Feelings</h2>
              <p>Choose up to 3, or leave this blank.</p>
              <div
                className="m-options m-journal-tags"
                role="group"
                aria-label="Feelings"
              >
                {[
                  ...recordFeelings,
                  ...(entry.feelings || []).filter(
                    (v) => !(recordFeelings as readonly string[]).includes(v),
                  ),
                ].map((feeling) => {
                  const selected = !!entry.feelings?.includes(feeling);
                  return (
                    <button
                      type="button"
                      key={feeling}
                      aria-pressed={selected}
                      className={selected ? "selected" : ""}
                      disabled={!selected && (entry.feelings?.length || 0) >= 3}
                      onClick={() =>
                        setEntry({
                          ...entry,
                          feelings: toggle(
                            entry.feelings || [],
                            feeling,
                          ) as JournalEntry["feelings"],
                        })
                      }
                    >
                      {feeling}
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="m-card m-field m-journal-reactions">
              <h2>After eating</h2>
              <p>Optional. Choose what fits.</p>
              <div
                className="m-options m-journal-tags"
                role="group"
                aria-label="After-eating reactions"
              >
                {mealReactions.map((reaction) => {
                  const selected = !!entry.reactions?.includes(reaction);
                  return (
                    <button
                      type="button"
                      key={reaction}
                      aria-pressed={selected}
                      className={selected ? "selected" : ""}
                      onClick={() =>
                        setEntry({
                          ...entry,
                          reactions: toggle(
                            entry.reactions || [],
                            reaction,
                          ) as JournalEntry["reactions"],
                        })
                      }
                    >
                      {reaction}
                    </button>
                  );
                })}
              </div>
              <label
                className="m-journal-note-label"
                htmlFor="after-eating-note"
              >
                Anything to add?
              </label>
              <textarea
                id="after-eating-note"
                placeholder="A little more about your reaction…"
                maxLength={800}
                value={entry.behaviorNote || ""}
                onChange={(e) =>
                  setEntry({ ...entry, behaviorNote: e.target.value })
                }
              />
              <details className="m-journal-more">
                <summary>
                  More options
                  {entry.behaviors?.length
                    ? ` · ${entry.behaviors.length} recorded`
                    : ""}
                </summary>
                <p>Only select what happened. Urges are recorded above.</p>
                <div
                  className="m-options m-journal-tags"
                  role="group"
                  aria-label="Recorded behaviors"
                >
                  {mealBehaviors.map((behavior) => {
                    const selected = !!entry.behaviors?.includes(behavior);
                    return (
                      <button
                        type="button"
                        key={behavior}
                        aria-pressed={selected}
                        className={selected ? "selected" : ""}
                        onClick={() =>
                          setEntry({
                            ...entry,
                            behaviors: toggle(
                              entry.behaviors || [],
                              behavior,
                            ) as JournalEntry["behaviors"],
                          })
                        }
                      >
                        {behavior}
                      </button>
                    );
                  })}
                </div>
              </details>
            </section>
            <section className="m-card m-field">
              <h2>Anything you’d like to share?</h2>
              <textarea
                aria-label="Anything you’d like to share?"
                placeholder="What you ate, how it felt, or anything on your mind…"
                maxLength={1500}
                value={entry.note || ""}
                onChange={(e) => setEntry({ ...entry, note: e.target.value })}
              />
            </section>
            <section className="m-card m-switch-row">
              <span>
                Private{" "}
                <button
                  className="m-inline-help"
                  aria-label="About private entries"
                  onClick={() => open("help")}
                >
                  <CircleHelp size={18} />
                </button>
              </span>
              <button
                role="switch"
                aria-checked={entry.private ?? true}
                aria-label="Keep entry private"
                className={"m-toggle " + ((entry.private ?? true) ? "on" : "")}
                onClick={() => setEntry({ ...entry, private: !entry.private })}
              >
                <span />
              </button>
            </section>
            {entry.skipped && (
              <p className="m-footnote">Previously marked as skipped.</p>
            )}
            <p className="m-footnote">
              Private entries stay out of chat. Nothing is shared with friends.
            </p>
            <div className="m-sticky-action">
              <button
                className="m-primary"
                disabled={!complete || busy || photoBusy}
                onClick={async () => {
                  const value = {
                    ...entry,
                    id: entry.id || crypto.randomUUID(),
                    date,
                  };
                  if (await mutate("entry", value)) {
                    router.push("/home");
                    if (value.photo && value.foodCategory === undefined) {
                      void api("journal/analyze-photo", "POST", {
                        id: value.id,
                      })
                        .then(() => refresh())
                        .catch(() => {});
                    }
                  }
                }}
              >
                {busy ? "Saving…" : "Save moment"}
              </button>
            </div>
            {entry.id && (
              <div className="m-record-actions">
                {entry.private === false && (
                  <Link className="m-outline" href={"/talk?entry=" + entry.id}>
                    Talk about this with {listener.name}
                  </Link>
                )}
                <button
                  className="m-danger"
                  disabled={busy}
                  onClick={async () => {
                    if (window.confirm("Delete this journal entry?")) {
                      if (await mutate("delete-entry", undefined, entry.id))
                        router.push("/home");
                    }
                  }}
                >
                  <Trash2 size={16} />
                  Delete entry
                </button>
              </div>
            )}
          </>
        ) : path === "/report" ? (
          <ReportView
            entries={state.journal}
            onRefresh={refresh}
            timezone={p.timezone}
            onOpenDay={(day) => {
              setDate(day);
              router.push("/home");
            }}
          />
        ) : isChat ? (
          renderChat(prefill)
        ) : path === "/friends" ? (
          <FriendsView inviteRequest={friendInvite} nickname={p.nickname} avatar={listenerAvatar(listener)} companionName={listener.name} />
        ) : isListener ? (
          <>
            <p className="m-intro">
              Someone gentle. Someone playful. Someone who listens your way.
            </p>
            <CharacterPicker
              value={characterId(draft)}
              onChange={(id) => setDraft(characterPreset(id, p.nickname))}
              disabled={busy}
            />
            <section className="m-card m-listener-preview">
              <Companion type={listenerAvatar(draft)} large />
              <h2>{draft.name || "Your listener"}</h2>
              <p>
                {draft.kind === "pet"
                  ? `A little company, ${draft.address || "friend"}. I’m here to listen.`
                  : "I’m here to listen, at your pace."}
              </p>
            </section>
            <button
              className="m-primary"
              disabled={
                busy ||
                !draft.name.trim() ||
                !draft.address.trim() ||
                !draft.traits.length
              }
              onClick={async () => {
                if (await mutate("listener", draft))
                  router.push("/listener/personalize");
              }}
            >
              {busy ? "Saving…" : "Continue"}
              <Heart size={19} />
            </button>
            <p className="m-footnote">
              You can change your listener at any time. Your journal and
              memories stay with you.
            </p>
          </>
        ) : path === "/space/memories" ? (
          <SettingsMemory />
        ) : isSettings ? (
          <>
            <section className="s-account" aria-label="Account">
              <AccountAvatar value={p.avatar} refresh={refresh} />
              <div><h2>{p.nickname}</h2><div className="s-account-id"><span>ID</span><code title={accountId}>{accountId ? `${accountId.slice(0, 8)}…${accountId.slice(-4)}` : "Unavailable"}</code></div></div>
              <button className="s-icon-button" aria-label={idCopied ? "ID copied" : "Copy account ID"} disabled={!accountId} onClick={async () => {
                try { await navigator.clipboard.writeText(accountId); setIdCopied(true); setSaved("ID copied."); }
                catch { setError("Could not copy your ID. Please try again."); }
              }}>{idCopied ? <Check size={19} /> : <Copy size={19} />}</button>
            </section>
            <div className="s-visual-grid">
              <Link href="/listener/personalize" className="s-visual-card">
                <div className="s-companion-preview"><Companion type={listenerAvatar(listener)} /></div>
                <span><SettingsIcon name="companion" />Companion<ChevronRight size={16} /></span>
              </Link>
              <button className="s-visual-card" onClick={() => open("Appearance")} aria-haspopup="dialog">
                <div className="s-background-preview"><ChatBackdrop theme={state.chatTheme} mode={state.chatMode} /><span className="s-mode-icon">{state.chatMode === "day" ? <Sun size={18} /> : <Moon size={18} />}</span></div>
                <span><SettingsIcon name="appearance" />Appearance<ChevronRight size={16} /></span>
              </button>
            </div>
            <div className="s-settings-list" aria-label="Settings">
              <Link href="/space/memories"><span className="s-row-icon"><SettingsIcon name="memory" /></span><span>Memory</span><ChevronRight /></Link>
              <Link href="/space/privacy"><span className="s-row-icon"><SettingsIcon name="privacy" /></span><span>Privacy</span><ChevronRight /></Link>
            </div>
            <div className="s-settings-list" aria-label="Support">
              <button onClick={() => open("Help")} aria-haspopup="dialog"><span className="s-row-icon"><SettingsIcon name="help" /></span><span>Help</span><ChevronRight /></button>
              <button onClick={() => open("about")} aria-haspopup="dialog"><span className="s-row-icon"><SettingsIcon name="about" /></span><span>About Milo</span><ChevronRight /></button>
            </div>
            <button className="s-sign-out" onClick={async () => {
              try { await api("auth/logout", "POST"); router.push("/login"); }
              catch (e) { setError((e as Error).message); }
            }}><LogOut size={18} />Sign out</button>
            <p className="s-version">Milo · v1.0</p>
          </>
        ) : (
          children
        )}
      </main>
      {!isRecord && !isListener && (
        <nav className="m-bottom-nav" aria-label="Main navigation">
          {navigation.map(({ href, label, Icon }) => {
            const active =
              href === "/settings"
                ? isSettings || path.startsWith("/space")
                : href === "/talk"
                  ? isChat
                  : path === href;
            return (
              <Link
                key={href}
                href={href}
                className={
                  (href === "/talk" ? "m-nav-chat " : "") +
                  (active ? "active" : "")
                }
                aria-current={active ? "page" : undefined}
              >
                <Icon size={25} strokeWidth={active ? 2.5 : 1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
      {sheet && (
        <div className="m-sheet-scrim" onClick={() => setSheet(null)}>
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={sheet}
            className="m-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="m-sheet-handle" />
            <button
              className="m-sheet-close"
              aria-label="Close dialog"
              onClick={() => setSheet(null)}
            >
              <X />
            </button>
            <h2>
              {sheet === "history"
                ? "Your conversations"
                : sheet === "share"
                  ? "Share my listener"
                  : sheet === "enter"
                    ? "Add a friend’s listener"
                      : sheet === "about"
                        ? "A little about Milo"
                        : sheet === "help"
                          ? "Your space, your pace"
                          : sheet}
            </h2>
            {sheet === "Appearance" ? (
            <section className="m-card chat-theme-settings" aria-label="Chat background">
              <div className="s-appearance-preview"><ChatBackdrop theme={state.chatTheme} mode={state.chatMode} /></div>
              <p className="s-appearance-status" role="status">{saved || "Choose your background"}</p>
              <div className="chat-mode-options" role="group" aria-label="Day or night mode">
                {(["day", "night"] as const).map(mode => <button type="button" key={mode} aria-pressed={state.chatMode === mode} disabled={busy} onClick={async () => {
                  if (mode === state.chatMode) return;
                  if (await mutate("chat-mode", mode)) setSaved("Chat appearance saved.");
                }}>{mode === "day" ? <Sun size={17} /> : <Moon size={17} />}{mode === "day" ? "Day" : "Night"}</button>)}
              </div>
              <div className="chat-theme-options" role="group" aria-label="Choose a chat background">
                {chatThemes.map(theme => <button key={theme.id} type="button" className="chat-theme-choice" aria-pressed={state.chatTheme === theme.id} disabled={busy} onClick={async () => {
                  if (theme.id === state.chatTheme) return;
                  const next = await mutate("chat-theme", theme.id);
                  if (next) setSaved("Chat background saved.");
                }}>
                  <span className="chat-theme-preview"><ChatBackdrop theme={theme.id} mode={state.chatMode} />{state.chatTheme === theme.id && <Check size={16} />}</span>
                  <strong>{theme.name}</strong>

                </button>)}
              </div>
            </section>

            ) : sheet === "Help" ? (
              <div className="s-help-list">
                <div><Camera /><span><strong>Record</strong><p>Save a meal, photo or feeling.</p></span></div>
                <div><ChartNoAxesColumnIncreasing /><span><strong>Report</strong><p>Explore your weekly or monthly patterns.</p></span></div>
                <div><Leaf /><span><strong>Memory</strong><p>View, edit or remove saved memories.</p></span></div>
              </div>
            ) : sheet === "history" ? (
              <>
                {loadingHistory ? (
                  <p>Opening your conversations…</p>
                ) : conversations.length ? (
                  <div className="m-menu-list">
                    {conversations
                      .slice(-20)
                      .reverse()
                      .map((c) => (
                        <Link
                          key={c.id}
                          href={"/talk/" + c.id}
                          onClick={() => setSheet(null)}
                        >
                          <MessageCircle size={18} />
                          <span className="m-conversation-title">
                            {String(c.data.title || "A little conversation")}
                          </span>
                          <ChevronRight size={17} />
                        </Link>
                      ))}
                  </div>
                ) : (
                  <p>No conversations yet. Start wherever you’d like.</p>
                )}
              </>
            ) : sheet === "share" ? (
              <>
                <p>
                  Your code includes only your listener’s name, character,
                  address and traits. It never includes conversations or journal
                  entries.
                </p>
                <textarea
                  readOnly
                  aria-label="Your listener code"
                  value={encodeListener(listener)}
                />
                <button
                  className="m-primary"
                  onClick={async () => {
                    try {
                      const text = encodeListener(listener);
                      if (navigator.share)
                        await navigator.share({
                          title: "Meet my Milo listener",
                          text,
                        });
                      else {
                        await navigator.clipboard.writeText(text);
                        setCopied(true);
                      }
                    } catch (e) {
                      if ((e as Error).name !== "AbortError")
                        setError(
                          "Sharing is unavailable. Select and copy the code above.",
                        );
                    }
                  }}
                >
                  {copied ? <Check size={18} /> : <Share2 size={18} />}{" "}
                  {copied ? "Copied" : "Share my code"}
                </button>
                <button
                  className="m-text-action"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        encodeListener(listener),
                      );
                      setCopied(true);
                    } catch {
                      setError("Select and copy the code above.");
                    }
                  }}
                >
                  <Copy size={15} />
                  Copy code
                </button>
              </>
            ) : sheet === "enter" ? (
              <>
                <p>
                  Paste a Milo listener code from your friend. This imports the
                  listener’s settings, not their account or conversations.
                </p>
                <textarea
                  aria-label="Friend's listener code"
                  placeholder="MILO-…"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <button
                  className="m-primary"
                  disabled={busy || !code.trim()}
                  onClick={async () => {
                    try {
                      const value = decodeListener(code);
                      if (await mutate("friend", value)) {
                        setCode("");
                        setSheet(null);
                      }
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Add listener
                </button>
              </>
            ) : sheet === "about" ? (
              <>
                <p>
                  Milo is a private place to journal and talk with a listener
                  you shape.
                </p>
                <p>
                  Listeners are software-generated fictional characters, not
                  real people, animals or health professionals. Responses may be
                  mistaken; this is not treatment or emergency care.
                </p>
                <p>
                  Your chosen personality changes how your listener responds.
                  You control your memories and what you share.
                </p>
                <Link
                  className="m-primary"
                  href="/space/privacy"
                  onClick={() => setSheet(null)}
                >
                  Privacy controls
                </Link>
              </>
            ) : sheet === "Notifications" ? (
              <p>No notifications yet.</p>
            ) : sheet === "help" ? (
              <p>
                <strong>Private:</strong> marked entries stay out of chat. Other
                users can’t see your chats or journal.
              </p>
            ) : sheet === "Contact" ? (
              <>
                <p>
                  This prototype has no configured external support inbox. Use
                  Send Feedback to save notes in your account for your own
                  export; they are not sent to a support team.
                </p>
                <button
                  className="m-primary"
                  onClick={() => {
                    setFeedback("");
                    setSheet("Send Feedback");
                  }}
                >
                  Write feedback
                </button>
                <Link
                  className="m-text-action"
                  href="/resources/help"
                  onClick={() => setSheet(null)}
                >
                  Find external support resources
                </Link>
              </>
            ) : (
              <>
                <p>
                  {sheet === "User Interview"
                    ? "What felt helpful, what felt missing, and what would make this space more comfortable?"
                    : "Tell us about your experience."}{" "}
                  Notes are saved privately in your account, not sent or
                  published.
                </p>
                {sheet === "Write a review" && (
                  <div className="m-rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        aria-label={n + " stars"}
                        aria-pressed={rating === n}
                        onClick={() => setRating(n)}
                      >
                        <Star fill={n <= rating ? "#b0bf9e" : "none"} />
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  aria-label="Feedback notes"
                  maxLength={1000}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Your thoughts…"
                />
                <button
                  className="m-primary"
                  disabled={busy || !feedback.trim()}
                  onClick={async () => {
                    if (
                      await mutate("feedback", {
                        topic: sheet,
                        note: feedback,
                        rating,
                      })
                    ) {
                      setSaved(
                        "Saved privately in your account. Nothing was sent or published.",
                      );
                      setSheet(null);
                    }
                  }}
                >
                  Save my notes
                </button>
              </>
            )}
            {error && (
              <p className="m-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

