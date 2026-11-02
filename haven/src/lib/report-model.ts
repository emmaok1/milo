import { foodCategories, type JournalEntry } from "./listener-model";
export type ReportPeriod = "week" | "month";
export type ReportCount = { label: string; count: number };
export type ReportSuggestion = {
  id: string;
  evidence: string;
  text: string;
  href: string;
  action: string;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T12:00:00Z");
export function reportRange(anchor: string, period: ReportPeriod) {
  const start = parse(anchor);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(anchor) ||
    Number.isNaN(start.getTime()) ||
    iso(start) !== anchor
  )
    throw new Error("Invalid report date.");
  if (period === "month") start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start);
  if (period === "month") end.setUTCMonth(end.getUTCMonth() + 1, 0);
  else end.setUTCDate(end.getUTCDate() + 6);
  const dates: string[] = [];
  const day = new Date(start);
  while (day <= end) {
    dates.push(iso(day));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return { start: iso(start), end: iso(end), dates };
}
export function moveReportAnchor(
  anchor: string,
  period: ReportPeriod,
  direction: number,
) {
  const d = parse(anchor);
  if (period === "month") {
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + direction);
  } else d.setUTCDate(d.getUTCDate() + 7 * direction);
  return iso(d);
}
const count = (
  entries: JournalEntry[],
  key: "feelings" | "reactions" | "behaviors",
): ReportCount[] => {
  const result = new Map<string, number>();
  for (const e of entries)
    for (const tag of new Set(e[key] || []))
      result.set(tag, (result.get(tag) || 0) + 1);
  return [...result]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};
export function buildReport(
  entries: JournalEntry[],
  anchor: string,
  period: ReportPeriod,
) {
  const range = reportRange(anchor, period);
  const selected = entries.filter(
    (e) => e.date >= range.start && e.date <= range.end,
  );
  const feelings = count(selected, "feelings"),
    reactions = count(selected, "reactions"),
    behaviors = count(selected, "behaviors");
  const feelingEntries = selected.filter((e) => e.feelings?.length).length;
  const reactionEntries = selected.filter((e) => e.reactions?.length).length;
  const series = feelings.slice(0, 2).map((f) => f.label);
  const days = range.dates.map((date) => {
    const items = selected.filter((e) => e.date === date),
      tagged = items.filter((e) => e.feelings?.length);
    return {
      date,
      entries: items.length,
      tagged: tagged.length,
      counts: Object.fromEntries(
        count(tagged, "feelings").map((item) => [item.label, item.count]),
      ),
      values: series.map((label) =>
        tagged.length
          ? (100 *
              tagged.filter((e) =>
                (e.feelings as readonly string[]).includes(label),
              ).length) /
            tagged.length
          : null,
      ),
    };
  });
  const times = selected.flatMap((e) => {
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(e.time);
    return m
      ? [
          {
            id: e.id,
            date: e.date,
            minutes: Number(m[1]) * 60 + Number(m[2]),
            time: e.time,
          },
        ]
      : [];
  });
  const report = {
    ...range,
    period,
    entries: selected,
    total: selected.length,
    recordedDays: days.filter((d) => d.entries).length,
    feelingEntries,
    reactionEntries,
    feelings,
    reactions,
    behaviors,
    series,
    days,
    times,
  };
  const primaryFeelings = ["Joy", "Regret", "Pain"].map((label) => ({
    label,
    count: feelings.find((f) => f.label === label)?.count || 0,
  }));
  const foods = foodCategories.map((label) => ({
    label,
    count: selected.filter((e) => e.photo && e.foodCategory === label).length,
  }));
  const unclassifiedPhotos = selected.filter(
    (e) => e.photo && !e.foodCategory,
  ).length;
  const tagged = primaryFeelings
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);
  const top = tagged.filter((f) => f.count === tagged[0]?.count);
  const classified = foods.reduce((n, f) => n + f.count, 0);
  const topFood = [...foods].sort((a, b) => b.count - a.count)[0];
  const generalAnalysis = !selected.length
    ? "No moments recorded in this period."
    : `${top.length ? `${top.map((f) => f.label).join(" and ")} ${top.length === 1 ? "was" : "were"} recorded most often (${top[0].count} ${top.length > 1 ? "each" : "times"}).` : "No Joy, Regret or Pain tags recorded yet."} ${classified ? `${topFood.label} was a leading photo label (${topFood.count} of ${classified} classified photos).` : "No classified food photos yet."}`;
  const suggestions = reportSuggestions(report);
  const advice =
    suggestions[0]?.text ||
    (tagged.some((f) => f.label === "Pain" || f.label === "Regret")
      ? "Consider talking through one difficult moment with someone you trust."
      : "When a moment feels supportive, add a short note about what helped.");
  return {
    ...report,
    suggestions,
    primaryFeelings,
    foods,
    unclassifiedPhotos,
    generalAnalysis,
    advice,
  };
}
export type HealthReport = ReturnType<typeof buildReport>;
type Facts = {
  total: number;
  feelingEntries: number;
  reactions: ReportCount[];
  feelings: ReportCount[];
  behaviors: ReportCount[];
};
export function reportSuggestions(facts: Facts): ReportSuggestion[] {
  const r = (name: string) =>
    facts.reactions.find((r) => r.label === name)?.count || 0;
  const f = (names: string[]) =>
    facts.feelings.filter((f) => names.includes(f.label));
  const actual = facts.behaviors
    .filter((b) => b.label !== "Other")
    .reduce((n, b) => n + b.count, 0);
  if (actual)
    return [
      {
        id: "professional-support",
        evidence: "Your entries include recorded behaviors.",
        text: "Consider reviewing these moments with a qualified health professional.",
        href: "/resources",
        action: "Support options",
      },
    ];
  if (r("Urge to compensate"))
    return [
      {
        id: "urge-support",
        evidence: `${r("Urge to compensate")} ${r("Urge to compensate") === 1 ? "entry mentions" : "entries mention"} an urge to compensate.`,
        text: "Consider sharing these urges with a qualified health professional.",
        href: "/resources",
        action: "Support options",
      },
    ];
  const result: ReportSuggestion[] = [];
  if (r("Wanted company"))
    result.push({
      id: "company",
      evidence: `${r("Wanted company")} ${r("Wanted company") === 1 ? "entry mentions" : "entries mention"} wanting company.`,
      text: "Try a voice call when you want some company.",
      href: "/call",
      action: "Start a call",
    });
  if (r("Kept thinking about the meal"))
    result.push({
      id: "lighter-topic",
      evidence: "You noted thoughts returning to the meal.",
      text: "A lighter conversation could offer a change of focus.",
      href: "/talk",
      action: "Open chat",
    });
  if (r("Wanted some quiet"))
    result.push({
      id: "quiet",
      evidence: "You noted wanting some quiet.",
      text: "Make room for a quiet pause, if that feels helpful.",
      href: "/home",
      action: "Your journal",
    });
  if (!result.length && facts.feelingEntries >= 3) {
    const difficult = f([
      "Worried",
      "Guilty",
      "Sad",
      "Frustrated",
      "Anxious",
      "Shamed",
      "Stressed",
      "Afraid",
      "Helpless",
      "Lonely",
    ]);
    if (difficult.length) {
      const top = difficult[0];
      result.push({
        id: "talk-through",
        evidence: `${top.label} appears in ${top.count} of ${facts.feelingEntries} feeling-tagged entries.`,
        text: "You could talk through one of these moments at your own pace.",
        href: "/talk",
        action: "Open chat",
      });
    } else if (f(["Calm", "Happy", "Satisfied", "Joy", "Proud"]).length)
      result.push({
        id: "supportive-moments",
        evidence: "Your entries include positive feelings.",
        text: "Notice what felt supportive in one of these moments.",
        href: "/home",
        action: "Your journal",
      });
  }
  return result.slice(0, 2);
}
/** A missing day ends a segment; never draw across unknown values. */
export function segmentedLine(
  values: (number | null)[],
  x: (index: number) => number,
  y: (value: number) => number,
) {
  let open = false;
  return values
    .map((value, i) => {
      if (value === null) {
        open = false;
        return "";
      }
      const part = `${open ? "L" : "M"}${x(i).toFixed(2)},${y(value).toFixed(2)}`;
      open = true;
      return part;
    })
    .filter(Boolean)
    .join(" ");
}
export function chartDate(date: string, month = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    ...(month ? { month: "short", day: "numeric" } : { weekday: "short" }),
  }).format(parse(date));
}
