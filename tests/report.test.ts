import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReport,
  reportRange,
  moveReportAnchor,
  segmentedLine,
  reportSuggestions,
} from "../src/lib/report-model";
import { journalSchema, type JournalEntry } from "../src/lib/listener-model";
import { randomUUID } from "node:crypto";
const entry = (date: string, fields: Partial<JournalEntry> = {}) =>
  journalSchema.parse({
    id: randomUUID(),
    date,
    time: "13:00",
    note: "Fictional meal moment.",
    ...fields,
  });
test("week and month windows use date-only calendar math across DST, year and leap boundaries", () => {
  assert.deepEqual(reportRange("2026-10-24", "week").dates, [
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
    "2026-10-24",
    "2026-10-25",
  ]);
  assert.equal(reportRange("2024-02-20", "month").dates.length, 29);
  assert.equal(reportRange("2026-02-20", "month").dates.length, 28);
  assert.equal(reportRange("2026-01-01", "week").start, "2025-12-29");
  assert.equal(reportRange("2026-03-08", "week").dates.length, 7);
  assert.equal(moveReportAnchor("2026-01-31", "month", 1), "2026-02-01");
  assert.equal(moveReportAnchor("2026-12-31", "month", 1), "2027-01-01");
  assert.throws(() => reportRange("2026-02-31", "week"));
  assert.throws(() => reportRange("invalid", "month"));
});
test("daily percentages use only feeling-tagged entries and preserve missing dates as gaps", () => {
  const data = [
    entry("2026-10-19", { feelings: ["Calm", "Worried"] }),
    entry("2026-10-19", { feelings: ["Calm"] }),
    entry("2026-10-19"),
    entry("2026-10-21", { feelings: ["Worried"] }),
    entry("2026-09-01", { feelings: ["Sad"] }),
  ];
  const report = buildReport(data, "2026-10-24", "week");
  assert.equal(report.total, 4);
  assert.equal(report.recordedDays, 2);
  assert.equal(report.feelingEntries, 3);
  assert.deepEqual(report.series, ["Calm", "Worried"]);
  assert.deepEqual(report.days[0].values, [100, 50]);
  assert.deepEqual(report.days[1].values, [null, null]);
  assert.deepEqual(report.days[2].values, [0, 100]);
  assert.equal(report.times.length, 4);
  assert.equal(report.reactionEntries, 0);
  assert(!JSON.stringify(report).includes("healthScore"));
});
test("line segments break at unknown days and do not fabricate interpolated observations", () => {
  assert.equal(
    segmentedLine(
      [0, null, 50, 100, null],
      (i) => i * 10,
      (v) => 100 - v,
    ),
    "M0.00,100.00 M20.00,50.00 L30.00,0.00",
  );
  assert.equal(
    segmentedLine(
      [null, null],
      (i) => i,
      (v) => v,
    ),
    "",
  );
});
test("reaction urges remain independent of recorded actions and trigger distinct support wording", () => {
  const urges = buildReport(
    [
      entry("2026-10-20", {
        reactions: ["Urge to compensate", "Felt out of control"],
      }),
    ],
    "2026-10-24",
    "week",
  );
  assert.deepEqual(urges.behaviors, []);
  assert.equal(urges.suggestions[0].id, "urge-support");
  assert(!urges.suggestions[0].evidence.includes("recorded behaviors"));
  const actions = buildReport(
    [
      entry("2026-10-20", {
        behaviors: ["Vomit"],
        reactions: ["Wanted company"],
      }),
    ],
    "2026-10-24",
    "week",
  );
  assert.equal(actions.suggestions.length, 1);
  assert.equal(actions.suggestions[0].id, "professional-support");
});
test("suggestions require explicit context, stay bounded, and never mine photos or private notes", () => {
  const simple = buildReport(
    [
      entry("2026-10-20", {
        note: "I want company, but this is private free text.",
      }),
    ],
    "2026-10-24",
    "week",
  );
  assert.deepEqual(simple.suggestions, []);
  const data = [
    entry("2026-10-20", {
      reactions: [
        "Wanted company",
        "Wanted some quiet",
        "Kept thinking about the meal",
      ],
    }),
  ];
  const report = buildReport(data, "2026-10-24", "week");
  assert.equal(report.suggestions.length, 2);
  assert.equal(report.suggestions[0].href, "/call");
  assert(
    !report.suggestions.some((s) =>
      /calorie|weight.loss|fasting|diagnos|recovery score/i.test(s.text),
    ),
  );
  const sparse = reportSuggestions({
    total: 1,
    feelingEntries: 1,
    feelings: [{ label: "Worried", count: 1 }],
    reactions: [],
    behaviors: [],
  });
  assert.deepEqual(sparse, []);
});
test("legacy tags work, monthly records are bounded, and recomputation reflects edits and deletions", () => {
  const a = entry("2026-10-20", {
      feelings: ["Anxious"],
      reactions: ["Wanted company"],
    }),
    b = entry("2026-11-01", { feelings: ["Calm"] });
  assert.equal(buildReport([a, b], "2026-10-24", "month").total, 1);
  assert.equal(buildReport([a, b], "2026-11-24", "month").total, 1);
  assert.equal(
    buildReport([a], "2026-10-24", "week").suggestions[0].id,
    "company",
  );
  assert.deepEqual(buildReport([], "2026-10-24", "week").suggestions, []);
  assert.deepEqual(
    buildReport([{ ...a, reactions: [] }], "2026-10-24", "week").reactions,
    [],
  );
});

test("sample reports contain valid fictional entries for each period without touching real data", async () => {
  const { sampleReportEntries } = await import("../src/lib/report-sample");
  for (const period of ["week", "month"] as const) {
    const sample = sampleReportEntries("2026-10-24", period);
    assert(sample.length > 0);
    assert(sample.length <= 100);
    assert.equal(new Set(sample.map((e) => e.id)).size, sample.length);
    for (const e of sample) {
      assert(journalSchema.safeParse(e).success);
      assert.equal(e.note, "Fictional sample moment.");
      assert.equal(e.private, true);
    }
    const report = buildReport(sample, "2026-10-24", period);
    assert(report.series.length > 0);
    assert(report.reactions.length > 0);
    assert(report.times.length > 0);
    assert(report.suggestions.length > 0);
    assert(report.days.some((d) => d.tagged === 0));
  }
  const real = [entry("2026-10-20", { feelings: ["Sad"] })];
  const snapshot = JSON.stringify(real);
  sampleReportEntries("2026-10-24", "month");
  assert.equal(JSON.stringify(real), snapshot);
  assert.deepEqual(
    sampleReportEntries("2026-10-24", "week"),
    sampleReportEntries("2026-10-24", "week"),
  );
});
test("preview mode is explicit for existing records, automatic for an empty account, and can be exited", async () => {
  const { showSampleReport, reportViewHref } =
    await import("../src/lib/report-sample");
  assert(showSampleReport(null, 0));
  assert(!showSampleReport(null, 3));
  assert(showSampleReport("1", 3));
  assert(!showSampleReport("0", 0));
  assert.equal(reportViewHref("month", true), "/report?period=month&preview=1");
  assert.equal(reportViewHref("week", false), "/report?period=week&preview=0");
});
