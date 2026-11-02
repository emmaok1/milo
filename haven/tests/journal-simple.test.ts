import test from "node:test";
import assert from "node:assert/strict";
import {
  journalSchema,
  journalReport,
  journalText,
  journalTime,
  journalDiscussion,
  hasJournalContent,
  mobileState,
  recordFeelings,
} from "../src/lib/listener-model";
const base = {
  id: "61989a72-d4ec-4416-98e9-6b061357f6bb",
  date: "2026-10-24",
  time: "13:00",
  recordVersion: 2 as const,
};
test("simple journal accepts a photo, feeling, reaction or either text field without legacy required metadata", () => {
  for (const content of [
    { note: "Lunch at home." },
    { feelings: ["Worried"] },
    { reactions: ["Wanted company"] },
    { behaviorNote: "I needed some quiet." },
    { photo: "data:image/jpeg;base64,/9j/2Q==" },
  ]) {
    const entry = journalSchema.parse({ ...base, ...content });
    assert.equal(entry.private, true);
    assert.equal(entry.mealType, undefined);
    assert.equal(entry.location, undefined);
    assert.equal(entry.company, undefined);
    assert.equal(entry.satiety, undefined);
    assert(hasJournalContent(entry));
  }
  assert(!journalSchema.safeParse(base).success);
  assert(
    !journalSchema.safeParse({
      ...base,
      note: "  ",
      feelings: [],
      reactions: [],
    }).success,
  );
  assert(
    !journalSchema.safeParse({ ...base, note: "hello", date: "2026-02-31" })
      .success,
  );
});
test("new feelings are bounded and unique while legacy labels and entries remain editable", () => {
  assert.equal(recordFeelings.length, 12);
  assert(
    journalSchema.safeParse({
      ...base,
      feelings: ["Calm", "Happy", "Satisfied"],
    }).success,
  );
  assert(
    !journalSchema.safeParse({
      ...base,
      feelings: ["Calm", "Happy", "Satisfied", "Tired"],
    }).success,
  );
  assert(
    !journalSchema.safeParse({ ...base, feelings: ["Sad", "Sad"] }).success,
  );
  const legacy = {
    ...base,
    recordVersion: undefined,
    mealType: "Lunch",
    location: "Home",
    company: "Alone",
    satiety: "Moderate",
    feelings: ["Anxious", "Shamed", "Lonely", "Afraid"],
    behaviors: ["Binge"],
    food: "Noodles",
    note: "A fictional note",
  };
  const entry = journalSchema.parse(legacy);
  assert.deepEqual(entry.feelings, legacy.feelings);
  assert.equal(entry.food, "Noodles");
  assert.equal(entry.mealType, "Lunch");
  assert.deepEqual(entry.behaviors, ["Binge"]);
  assert.equal(journalText(entry), "Noodles\nA fictional note");
  assert.equal(journalText({ food: "Same", note: "Same" }), "Same");
});
test("urge and loss-of-control reactions never become recorded compensatory or binge behaviors", () => {
  const reaction = journalSchema.parse({
    ...base,
    reactions: ["Urge to compensate", "Felt out of control"],
    feelings: ["Guilty"],
  });
  assert.deepEqual(reaction.behaviors, []);
  const report = journalReport([reaction]);
  assert.equal(report.selected, 0);
  assert.equal(report.reactionsRecorded, 1);
  assert.deepEqual(report.reactionCounts, [
    ["Urge to compensate", 1],
    ["Felt out of control", 1],
  ]);
  assert.equal(journalReport([reaction], "Binge").selected, 0);
});
test("report coverage counts only provided fields; missing context and feelings remain unknown", () => {
  const photo = journalSchema.parse({
    ...base,
    photo: "data:image/jpeg;base64,/9j/2Q==",
  });
  const feeling = journalSchema.parse({
    ...base,
    id: "d0cab33c-1490-4d98-bcfc-675895abec0a",
    feelings: ["Calm"],
    behaviors: ["Other"],
  });
  const report = journalReport([photo, feeling]);
  assert.equal(report.count, 2);
  assert.equal(report.feelingsRecorded, 1);
  assert.equal(report.reactionsRecorded, 0);
  assert.deepEqual(report.locations, []);
  assert.equal(
    report.enjoyable.length,
    1,
    "positive feeling is explicit, not inferred from absent behaviors",
  );
  assert.deepEqual(journalReport([]).reactionCounts, []);
});
test("legacy migration supplies only empty collections, not invented labels or context", () => {
  const state = mobileState({ journal: [{ ...base, note: "Photo later" }] });
  assert.deepEqual(state.journal[0].feelings, []);
  assert.deepEqual(state.journal[0].behaviors, []);
  assert.deepEqual(state.journal[0].reactions, []);
  assert.equal(state.journal[0].mealType, undefined);
});
test("sharing summaries handle sparse records and distinguish reactions from actions", () => {
  const entry = journalSchema.parse({
    ...base,
    reactions: ["Urge to compensate"],
    behaviorNote: "Fictional reaction.",
    note: "Noodles.",
  });
  const summary = journalDiscussion(entry);
  assert(!summary.includes("undefined"));
  assert(!summary.includes("Recorded behaviors:"));
  assert(summary.includes("not necessarily actions"));
  assert(summary.includes("Fictional reaction."));
  assert(summary.includes("Noodles."));
});
test("time defaults follow the account timezone without midnight 24:00", () => {
  const date = new Date("2026-10-25T07:00:00Z");
  assert.equal(journalTime("America/Los_Angeles", date), "00:00");
  assert.equal(journalTime("UTC", date), "07:00");
});
