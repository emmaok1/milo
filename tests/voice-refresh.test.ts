import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { RealtimeTurnGate } from "../src/lib/realtime-stt";
import {
  safePhotoCategory,
  photoStillCurrent,
} from "../src/lib/photo-category";
import { buildReport } from "../src/lib/report-model";
import { journalSchema } from "../src/lib/listener-model";
import { randomUUID } from "node:crypto";
import { quickResponses } from "../src/lib/quick-responses/library";
import { routeQuickResponse } from "../src/lib/quick-responses/router";
import { cartesiaDefaults, cartesiaPayload } from "../src/lib/cartesia";
const entry = () =>
  journalSchema.parse({
    id: randomUUID(),
    date: "2026-10-24",
    time: "12:00",
    feelings: ["Joy"],
    photo: "data:image/jpeg;base64,YQ==",
  });
test("realtime yields only confirmed final turns, never eager ends or duplicates", () => {
  const gate = new RealtimeTurnGate();
  gate.arm();
  assert.equal(gate.receive({ type: "turn.end", transcript: "stale" }), null);
  gate.receive({ type: "turn.start" }, () => "one");
  for (const type of ["turn.update", "turn.eager_end", "turn.resume"])
    assert.equal(gate.receive({ type, transcript: "not final" })?.final, false);
  assert.deepEqual(gate.receive({ type: "turn.end", transcript: "  hello " }), {
    id: "one",
    text: "hello",
    final: true,
  });
  assert.equal(gate.receive({ type: "turn.end", transcript: "hello" }), null);
  gate.arm();
  gate.receive({ type: "turn.start" }, () => "two");
  gate.cancel();
  assert.equal(
    gate.receive({ type: "turn.end", transcript: "canceled" }),
    null,
  );
  gate.arm();
  gate.receive({ type: "turn.start" }, () => "three");
  assert.equal(
    gate.receive({ type: "turn.end", transcript: "hello" })?.id,
    "three",
  );
});
test("audio worklet emits bounded little endian PCM frames with clipping and RMS", () => {
  let Processor: new () => { process: (inputs: number[][][]) => boolean };
  const packets: { pcm: ArrayBuffer; rms: number }[] = [];
  runInNewContext(readFileSync("public/audio/pcm-capture.js", "utf8"), {
    AudioWorkletProcessor: class {
      port = {
        postMessage: (p: { pcm: ArrayBuffer; rms: number }) => packets.push(p),
      };
    },
    sampleRate: 16000,
    registerProcessor: (_name: string, p: typeof Processor) => {
      Processor = p;
    },
    Float32Array,
    ArrayBuffer,
    DataView,
    Math,
  });
  const p = new Processor!();
  p.process([[Array(1600).fill(2)]]);
  assert.equal(packets.length, 1);
  assert.equal(packets[0].pcm.byteLength, 3200);
  assert.equal(new DataView(packets[0].pcm).getInt16(0, true), 32767);
  assert.equal(packets[0].rms, 1);
  p.process([[Array(800).fill(-1)]]);
  assert.equal(packets.length, 1);
  p.process([[Array(800).fill(-1)]]);
  assert.equal(new DataView(packets[1].pcm).getInt16(0, true), -32768);
  p.process([[Array(800).fill(0.2)]]);
  (
    p as unknown as {
      port: { onmessage: (e: { data: { type: string } }) => void };
    }
  ).port.onmessage({ data: { type: "reset" } });
  p.process([[Array(800).fill(0.7)]]);
  assert.equal(packets.length, 2);
  p.process([[Array(800).fill(0.7)]]);
  assert.equal(packets.length, 3);
  assert(
    Math.abs(new DataView(packets[2].pcm).getInt16(0, true) / 32767 - 0.7) <
      0.001,
    "Old partial frames are discarded on pause/reset",
  );
});
test("only explicit communication controls auto route; emotional responses remain contextual", () => {
  assert.deepEqual(
    quickResponses.filter((r) => r.autoRouteEnabled).map((r) => r.id),
    ["016", "047", "049", "050", "090"],
  );
  for (const text of [
    "I feel guilty after eating",
    "I feel overwhelmed right now",
    "I feel better now",
    "Let's change to a lighter topic",
  ])
    assert.equal(routeQuickResponse(text).path, "claude");
  assert.equal(
    routeQuickResponse("Please no more questions.").response?.id,
    "090",
  );
  assert.equal(
    routeQuickResponse("Please no more questions.", { recentIds: ["090"] })
      .path,
    "claude",
  );
});
test("uncertain photos remain unknown, and deleted/replaced/manually edited photos cannot be overwritten", () => {
  assert.equal(
    safePhotoCategory({ category: "Meal", confidence: "uncertain" }),
    null,
  );
  assert.equal(
    safePhotoCategory({ category: "Dessert", confidence: "high" }),
    "Dessert",
  );
  assert.throws(() =>
    safePhotoCategory({ category: "healthy", confidence: "high" }),
  );
  const before = entry();
  assert(photoStillCurrent(before, { ...before, note: "new note" }));
  assert(!photoStillCurrent(before));
  assert(!photoStillCurrent(before, { ...before, photo: "replacement" }));
  assert(!photoStillCurrent(before, { ...before, foodCategory: "Snack" }));
});
test("report counts explicit feelings and one photo category, excludes unknown photos and out-of-range entries", () => {
  const a = entry(),
    b = {
      ...entry(),
      feelings: ["Sad", "Guilty"] as const,
      foodCategory: null,
    },
    c = {
      ...entry(),
      feelings: ["Regret", "Pain"] as const,
      foodCategory: "Dessert" as const,
    };
  const report = buildReport(
    [
      a,
      { ...b, feelings: [...b.feelings] },
      { ...c, feelings: [...c.feelings] },
      { ...entry(), date: "2026-09-01", foodCategory: "Meal" },
    ],
    "2026-10-24",
    "week",
  );
  assert.deepEqual(
    report.primaryFeelings.map((f) => f.count),
    [1, 1, 1],
  );
  assert.deepEqual(
    report.foods.map((f) => f.count),
    [0, 0, 0, 1],
  );
  assert.equal(report.unclassifiedPhotos, 2);
  assert.equal(report.total, 3);
  assert(report.advice.length > 0);
  assert(!report.generalAnalysis.includes("calorie"));
});
test("gentle voices are fixed by character and share restrained generation settings", () => {
  assert.equal(cartesiaDefaults.black_cat.name, "Ronald");
  assert.equal(cartesiaDefaults.white_cat.name, "Celine");
  assert.deepEqual(
    cartesiaPayload("hello", "en-US", "black_cat").generation_config,
    { speed: 0.94, volume: 0.92 },
  );
});

test("retired library cannot be enabled by a stale environment flag", async () => {
  const { quickEnabled } = await import("../src/lib/quick-responses/assets");
  const old = process.env.VOICE_QUICK_RESPONSES;
  process.env.VOICE_QUICK_RESPONSES = "true";
  try {
    assert.equal(quickEnabled(), false);
  } finally {
    if (old === undefined) delete process.env.VOICE_QUICK_RESPONSES;
    else process.env.VOICE_QUICK_RESPONSES = old;
  }
});
test("live contextual routing keeps safety and communication preferences without consulting the archived pool", async () => {
  const { contextualVoiceDecision, preferencesFor, preferencePrompt } =
    await import("../src/lib/voice-context");
  for (const text of [
    "Please just listen. I don't want advice.",
    "Please no more questions.",
    "I just want quiet company",
    "I feel guilty after eating",
  ]) {
    assert.equal(contextualVoiceDecision(text).path, "claude");
  }
  assert.equal(
    contextualVoiceDecision("Stay with me, I feel faint").path,
    "safety",
  );
  assert.equal(
    contextualVoiceDecision("Please just listen", [
      { role: "user", text: "I passed out earlier" },
    ]).path,
    "safety",
  );
  const p = preferencesFor([
    { role: "user", text: "Please no more questions. I do not want advice." },
  ]);
  assert(p.noQuestions && p.noAdvice);
  assert(preferencePrompt(p).includes("true"));
});
test("semantic end detection leaves more room for uncertain pauses, with valid ordered provider thresholds", async () => {
  const { realtimeTurnSettings } = await import("../src/lib/realtime-config");
  const s = realtimeTurnSettings();
  assert(
    s.startThreshold > s.eagerEndThreshold &&
      s.eagerEndThreshold > s.endThreshold,
  );
  assert(s.endTimeoutMs > 1600 && s.endTimeoutMs <= 11200);
  assert(s.startThreshold >= 0.5 && s.startThreshold <= 0.9);
  assert(s.endThreshold >= 0.05 && s.endThreshold <= 0.5);
});
test("cumulative recognition is not concatenated, and continuation never triggers a reply", () => {
  const g = new RealtimeTurnGate();
  g.arm();
  g.receive({ type: "turn.start" }, () => "turn");
  assert.equal(
    g.receive({ type: "turn.update", transcript: "I don't" })?.text,
    "I don't",
  );
  assert.equal(
    g.receive({ type: "turn.eager_end", transcript: "I don't want" })?.final,
    false,
  );
  assert.equal(g.receive({ type: "turn.resume" })?.final, false);
  assert.equal(
    g.receive({ type: "turn.end", transcript: "I don't want advice." })?.text,
    "I don't want advice.",
  );
});
