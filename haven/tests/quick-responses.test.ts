import test from "node:test";
import assert from "node:assert/strict";
import {
  quickResponses,
  validateLibrary,
  responseSchema,
  indexedLibrary,
} from "../src/lib/quick-responses/library";
import {
  routeQuickResponse,
  preferencesFor,
  sensitiveContext,
} from "../src/lib/quick-responses/router";
import {
  expectedAsset,
  manifestSchema,
  assetSchema,
  turnRecordId,
} from "../src/lib/quick-responses/assets";
import { nextPlaybackState } from "../src/lib/quick-responses/playback";
import { Pcm16Decoder, FinalTurnGuard } from "../src/lib/voice-audio";

test("library has exactly the 100 unique IDs and valid routing/asset metadata", () => {
  assert(validateLibrary());
  assert.equal(quickResponses.length, 100);
  assert.deepEqual(
    quickResponses.map((r) => r.id),
    Array.from({ length: 100 }, (_, i) => String(i + 1).padStart(3, "0")),
  );
  for (const r of quickResponses) {
    assert(responseSchema.safeParse(r).success);
    assert.equal(r.audioAssets.contentVersion, "english-v1");
  }
  const indexed = indexedLibrary([
    {
      id: "047",
      voiceId: "voice-a",
      contentVersion: "english-v1",
      key: "asset-key",
    },
  ]);
  assert.equal(
    indexed.find((r) => r.id === "047")?.audioAssets.voices[
      "voice-a:english-v1"
    ],
    "asset-key",
  );
  assert.equal(quickResponses.filter((r) => r.autoRouteEnabled).length, 5);
  for (const r of quickResponses.filter((r) => r.autoRouteEnabled))
    assert(r.matchingRules.patterns.length);
});
test("enabled examples match conservatively; decline needs a preceding question", () => {
  for (const r of quickResponses.filter((r) => r.autoRouteEnabled)) {
    const history =
      r.id === "049" ? [{ role: "assistant", text: "What happened?" }] : [];
    const d = routeQuickResponse(r.exampleUtterances[0], {
      history,
      language: "en-US",
    });
    assert.equal(d.response?.id, r.id, r.id + ": " + d.reason);
  }
  assert.equal(
    routeQuickResponse("I don't want to answer that question.").path,
    "claude",
  );
  assert.equal(
    routeQuickResponse("Nothing sounds appealing to eat.").path,
    "claude",
  );
});
test("negation, quotes, third parties, past experiences, ambiguity and mixed requests fall back", () => {
  for (const t of [
    "I don't feel guilty after eating",
    "My friend says she feels guilty after eating",
    "I used to feel guilty, but today was fine",
    "I'm not anxious, just tired",
    "If I feel guilty after eating what then?",
    'She said "I feel guilty after eating"',
    "'I feel guilty after eating'",
    "I feel guilty after eating and I need help writing an email",
    "I need to go, but answer this first",
    "You already asked me that",
    "I feel guilty after eating, or maybe I am just bored",
    "food",
    "I feel better sometimes",
  ])
    assert.equal(routeQuickResponse(t).path, "claude", t);
  assert.equal(
    routeQuickResponse("I don't want to talk about my body").path,
    "claude",
  );
});
test("sensitive context bypasses ordinary replies, including prior unresolved context", () => {
  for (const t of [
    "Stay with me; I feel faint",
    "I want to kill myself",
    "I am purging",
    "How many calories should I eat?",
    "Give me weight-loss instructions",
    "Which medication should I take?",
    "I am dizzy and want quiet company",
    "I can't breathe",
    "I want to make myself sick",
  ])
    assert.equal(routeQuickResponse(t).path, "safety", t);
  assert(sensitiveContext("I feel faint"));
  assert.equal(
    routeQuickResponse("I just want quiet company", {
      history: [{ role: "user", text: "I passed out earlier" }],
    }).path,
    "safety",
  );
});
test("no questions, quiet company, boundaries and no advice persist and constrain routing", () => {
  const history = [{ role: "user", text: "Please no more questions." }];
  assert.equal(
    routeQuickResponse("I feel guilty after eating", { history }).path,
    "claude",
  );
  assert.equal(
    routeQuickResponse("I don't want to talk about my body", { history }).path,
    "claude",
  );
  assert.equal(
    routeQuickResponse("Please no more questions.").response?.id,
    "090",
  );
  assert.equal(
    routeQuickResponse("Ask me an easy question", { history }).path,
    "claude",
  );
  assert.equal(
    routeQuickResponse("I feel guilty after eating", {
      history: [{ role: "user", text: "I don't want to talk about food" }],
    }).path,
    "claude",
  );
  assert.equal(
    routeQuickResponse("I feel overwhelmed right now", {
      history: [{ role: "user", text: "I do not want advice" }],
    }).path,
    "claude",
  );
  const p = preferencesFor([
    { role: "user", text: "I just want quiet company" },
  ]);
  assert(p.quiet && p.noQuestions);
  assert(
    preferencesFor(
      Array.from({ length: 40 }, () => ({ role: "user", text: "Hello" })),
      "",
      p,
    ).noQuestions,
  );
});
test("recent replies and questions just asked are suppressed; compatible alternatives only", () => {
  assert.equal(
    routeQuickResponse("I feel guilty after eating", { recentIds: ["021"] })
      .path,
    "claude",
  );
  assert.equal(
    routeQuickResponse("Let's change to a lighter topic", {
      recentIds: ["018"],
    }).path,
    "claude",
  );
  assert.equal(
    routeQuickResponse("Let's change to a lighter topic", {
      recentIds: ["018", "097"],
    }).path,
    "claude",
  );
  assert.equal(
    routeQuickResponse("I feel guilty after eating", {
      history: [
        {
          role: "assistant",
          text: "What are you saying to yourself right now?",
        },
      ],
    }).path,
    "claude",
  );
  assert.equal(
    routeQuickResponse("I feel guilty after eating", { language: "fr-FR" })
      .path,
    "claude",
  );
  assert.equal(
    routeQuickResponse("Please no more questions.", {
      availableIds: new Set(),
    }).reason,
    "audio_not_ready",
  );
  assert.equal(
    routeQuickResponse("Please no more questions.", {
      availableIds: new Set(["090"]),
    }).response?.id,
    "090",
  );
});
test("disabled conversational variants stay on Claude even when audio is ready", () => {
  assert.equal(
    routeQuickResponse("Let's change to a lighter topic", {
      availableIds: new Set(["097"]),
    }).path,
    "claude",
  );
});
test("audio keys include actual voice, text/settings version and format, manifests reject invalid refs", () => {
  const a = expectedAsset("047", "black_cat"),
    b = expectedAsset("047", "white_cat");
  assert.notEqual(a.key, b.key);
  const old = process.env.CARTESIA_MODEL;
  process.env.CARTESIA_MODEL = "test-settings";
  try {
    assert.notEqual(expectedAsset("047", "black_cat").key, a.key);
  } finally {
    if (old === undefined) delete process.env.CARTESIA_MODEL;
    else process.env.CARTESIA_MODEL = old;
  }
  assert(manifestSchema.safeParse({ version: 1, assets: [] }).success);
  assert(
    !assetSchema.safeParse({
      ...a,
      key: "../../private",
      bytes: 100,
      sha256: "a".repeat(64),
    }).success,
  );
  assert.notEqual(
    turnRecordId("user-a", "turn"),
    turnRecordId("user-b", "turn"),
  );
});
test("turn IDs deduplicate final transcript events without deduplicating repeated words", () => {
  const g = new FinalTurnGuard();
  assert(g.accept("one"));
  assert(!g.accept("one"));
  assert(g.accept("two"));
  g.clear();
  assert(g.accept("one"));
});
test("playback terminal states cannot regress or trigger fallback after speech began", () => {
  assert.equal(nextPlaybackState("pending", "fallback"), "fallback");
  assert.equal(nextPlaybackState("started", "fallback"), "started");
  assert.equal(nextPlaybackState("interrupted", "started"), "interrupted");
  assert.equal(nextPlaybackState("completed", "interrupted"), "completed");
  assert.equal(nextPlaybackState("fallback", "started"), "fallback");
});
test("PCM decoder preserves odd fetch chunk boundaries and rejects truncated samples", () => {
  const d = new Pcm16Decoder();
  assert.deepEqual([...d.decode(Uint8Array.of(0))], []);
  assert.deepEqual(
    [...d.decode(Uint8Array.of(128, 255, 127))],
    [-1, 32767 / 32768],
  );
  assert.throws(() => new Pcm16Decoder().decode(Uint8Array.of(3), true));
});
