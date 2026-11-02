"use client";
import { useEffect, useState, useRef, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Home,
  Camera,
  Bell,
  Phone,
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
  Info,
  SquarePen,
  Star,
  Mail,
  Download,
  Shield,
  LogOut,
  Leaf,
  Trash2,
} from "lucide-react";
import { Companion } from "./illustrations";
import ReportView from "./report-view";
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

function InstagramMark() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".8" fill="currentColor" />
    </svg>
  );
}
type Props = {
  p: Profile;
  demo: boolean;
  refresh: () => Promise<void>;
  renderChat: (prefill?: string) => ReactNode;
  children: ReactNode;
};
type Sheet =
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
          ? "Haven"
          : path === "/report"
            ? "Report"
            : path === "/friends"
              ? "Friends"
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
      className={
        "listener-phone " +
        (path === "/home" ? "reference-home " : "") +
        (isChat ? "chat-screen" : isRecord || isListener ? "form-screen" : "")
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
            Invite
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
            <div className="m-room">
              <button
                className="m-room-notice"
                aria-label="About this space"
                onClick={() => open("help")}
              >
                <Bell size={25} />
              </button>
              <span className="m-room-wall" />
              <span className="m-room-floor left" />
              <span className="m-room-floor right" />
              <Link
                href="/listener"
                className="m-room-listener"
                aria-label={"Customize " + listener.name}
              >
                <Companion type={listenerAvatar(listener)} large />
              </Link>
            </div>
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
                  <h2>
                    {month.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h2>
                  <ChevronDown size={21} />
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
                <p>
                  {date === localDate(p.timezone)
                    ? "No records for today yet"
                    : "No records for this day yet"}
                </p>
              </div>
            )}
            <Link
              href="/record"
              className="m-floating-add"
              aria-label="Add meal record"
            >
              <Plus size={34} />
            </Link>
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
          <FriendsView inviteRequest={friendInvite} nickname={p.nickname} />
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
        ) : isSettings ? (
          <>
            <Link className="m-settings-banner" href="/listener/personalize">
              <span>
                <strong>My listener</strong>
                <p>
                  A little company,
                  <br />
                  made your way.
                </p>
                <small>Choose your cat, name, language & style</small>
              </span>
              <Companion type={listenerAvatar(listener)} />
            </Link>
            <h2 className="m-settings-heading">Your space</h2>
            <div className="m-card m-menu-list">
              <Link href="/listener/personalize">
                <Heart />
                Personalize companion
                <ChevronRight />
              </Link>
              <Link href="/space/memories">
                <Leaf />
                Memories
                <ChevronRight />
              </Link>
              <Link href="/space/privacy">
                <Shield />
                Privacy & export
                <ChevronRight />
              </Link>
              <button onClick={() => open("install")}>
                <Download />
                Add to Home Screen
                <ChevronRight />
              </button>
              <Link href="/plan">
                <Check />
                My small steps
                <ChevronRight />
              </Link>
            </div>
            <h2 className="m-settings-heading">Communication</h2>
            <div className="m-card m-menu-list">
              {[
                { label: "Contact", Icon: Info },
                { label: "User Interview", Icon: SquarePen },
                { label: "Write a review", Icon: Star },
                { label: "Send Feedback", Icon: Mail },
              ].map(({ label, Icon }) => (
                <button
                  key={label}
                  onClick={() => {
                    setFeedback("");
                    setRating(0);
                    open(label as Sheet);
                  }}
                >
                  <Icon />
                  {label}
                  <ChevronRight />
                </button>
              ))}
            </div>
            <h2 className="m-settings-heading">Connection</h2>
            <div className="m-card m-menu-list">
              {[
                {
                  label: "Instagram",
                  url: "https://www.instagram.com",
                  Icon: InstagramMark,
                },
                { label: "X (Twitter)", url: "https://x.com", Icon: X },
                {
                  label: "Reddit",
                  url: "https://www.reddit.com",
                  Icon: MessageCircle,
                },
              ].map(({ label, url, Icon }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon />
                  {label}
                  <ChevronRight />
                </a>
              ))}
            </div>
            <p className="m-footnote">
              Platform links open their homepages. Haven does not have linked
              social accounts.
            </p>
            <div className="m-card m-menu-list">
              <button onClick={() => open("about")}>
                <Info />
                About Haven
                <ChevronRight />
              </button>
              <button
                onClick={async () => {
                  await api("auth/logout", "POST");
                  router.push("/login");
                }}
              >
                <LogOut />
                Sign out
                <ChevronRight />
              </button>
            </div>
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
                    : sheet === "install"
                      ? "Keep Haven close"
                      : sheet === "about"
                        ? "A little about Haven"
                        : sheet === "help"
                          ? "Your space, your pace"
                          : sheet}
            </h2>
            {sheet === "history" ? (
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
                          title: "Meet my Haven listener",
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
                  Paste a Haven listener code from your friend. This imports the
                  listener’s settings, not their account or conversations.
                </p>
                <textarea
                  aria-label="Friend's listener code"
                  placeholder="HAVEN-…"
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
            ) : sheet === "install" ? (
              <>
                <Companion type={listenerAvatar(listener)} />
                <ol>
                  <li>Open Haven’s HTTPS address in Safari on your iPhone.</li>
                  <li>Tap Share, then Add to Home Screen.</li>
                  <li>Leave Open as Web App enabled, then tap Add.</li>
                </ol>
                <p>
                  Use an address reachable from your phone. localhost points to
                  the iPhone itself. Chatting needs an internet connection.
                </p>
              </>
            ) : sheet === "about" ? (
              <>
                <p>
                  Haven is a private place to journal and talk with a listener
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

function ChatCallInvite({
  avatar,
}: {
  avatar: Parameters<typeof Companion>[0]["type"];
}) {
  const [inviting, setInviting] = useState(true);
  const router = useRouter();
  return (
    <div className="m-call-invite">
      <button
        className={
          "m-companion-help m-call-cat" + (inviting ? "" : " holding-phone")
        }
        aria-label={inviting ? "Voice call invitation" : "Start a voice call"}
        aria-expanded={inviting}
        onClick={() => {
          if (!inviting) router.push("/call");
        }}
      >
        <Companion type={avatar} />
        {!inviting && (
          <Phone className="m-cat-phone" size={21} aria-hidden="true" />
        )}
      </button>
      {inviting && (
        <div
          className="m-call-bubble"
          role="group"
          aria-label="Voice call invitation"
        >
          <p>Wanna have a voice call?</p>
          <div>
            <Link href="/call">Yes</Link>
            <button onClick={() => setInviting(false)}>No</button>
          </div>
        </div>
      )}
    </div>
  );
}
