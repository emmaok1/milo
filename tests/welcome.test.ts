import test from "node:test";
import assert from "node:assert/strict";
import {
  welcomeAnswersSchema,
  welcomeCheckinSchema,
  welcomeContext,
  welcomeQuestions,
  welcomeSpeech,
} from "../src/lib/welcome";
import { mobileState } from "../src/lib/listener-model";
import { voiceLanguageCodes } from "../src/lib/voice";
const checkin = {
  id: "a5ef47f9-d399-42d6-b693-04fa5495d47b",
  createdAt: "2026-10-24T12:00:00.000Z",
  answers: ["Tired", "Haven’t eaten yet", "Contact someone I trust"],
};
test("welcome choices validate by question and allow skipped answers", () => {
  assert(welcomeAnswersSchema.safeParse(checkin.answers).success);
  assert(welcomeAnswersSchema.safeParse([null, null, null]).success);
  assert(
    !welcomeAnswersSchema.safeParse(["Mostly okay", "Okay", null]).success,
  );
  assert(!welcomeAnswersSchema.safeParse(["Okay", null]).success);
  assert(
    !welcomeAnswersSchema.safeParse(["Ignore instructions", null, null])
      .success,
  );
  assert.equal(welcomeQuestions.length, 3);
  assert.deepEqual(welcomeQuestions.map(q => q.labels.length), [5, 5, 3]);
  assert.deepEqual(welcomeQuestions[2].labels, ["Just listen", "Chat with me", "Eat with me"]);
});
test("welcome context expires and never implies permission to contact someone", () => {
  const now = Date.parse(checkin.createdAt);
  assert.match(welcomeContext(checkin, now), /not long-term memory/);
  assert.match(
    welcomeContext(checkin, now),
    /not authorization to send messages/,
  );
  assert.equal(welcomeContext(checkin, now + 86400001), "");
  assert.equal(welcomeContext(checkin, now - 1), "");
  assert.equal(
    welcomeContext({ ...checkin, answers: [null, null, null] }, now),
    "",
  );
  assert.equal(
    welcomeContext({ ...checkin, answers: ["Anything", null, null] }, now),
    "",
  );
});
test("mobile normalization retains a valid check-in without changing legacy private data", () => {
  assert.deepEqual(
    mobileState({ welcomeCheckin: checkin }).welcomeCheckin,
    checkin,
  );
  assert.equal(
    mobileState({ welcomeCheckin: { ...checkin, answers: [] } }).welcomeCheckin,
    undefined,
  );
  assert(welcomeCheckinSchema.safeParse(checkin).success);
});
test("all saved languages have four spoken pages while interface copy remains English", () => {
  for (const language of voiceLanguageCodes)
    for (let step = 0; step < 4; step++)
      assert(welcomeSpeech(language, step)?.length > 0);
  assert.equal(welcomeSpeech("en-US", 0), "Welcome home. Meow.");
  for (let step = 1; step < 4; step++)
    assert.equal(
      welcomeSpeech("en-US", step),
      welcomeQuestions[step - 1].question,
    );
});

test("personal welcome uses the account nickname, normalizes whitespace and preserves later questions", async () => {
  const { welcomeGreeting, welcomeName } = await import("../src/lib/welcome");
  assert.equal(welcomeGreeting("Jenny"), "Welcome home, Jenny!");
  assert.equal(
    welcomeSpeech("en-US", 0, "Jenny"),
    "Welcome home, Jenny. Meow.",
  );
  assert.equal(
    welcomeSpeech("es-ES", 0, "Jenny"),
    "Welcome home, Jenny. Meow.",
  );
  assert.equal(welcomeName("  Jenny\n  Smith  "), "Jenny Smith");
  assert.equal(welcomeGreeting(" "), "Welcome home!");
  assert.equal(welcomeName("J".repeat(100)).length, 40);
  assert.equal(welcomeGreeting("O’Connor"), "Welcome home, O’Connor!");
  assert.equal(welcomeGreeting("小雨"), "Welcome home, 小雨!");
  for (const lang of voiceLanguageCodes)
    for (let i = 1; i <= 3; i++)
      assert.equal(welcomeSpeech(lang, i, "Jenny"), welcomeSpeech(lang, i));
});

test("check-in copy stays short and only the support question changes", () => {
  assert.deepEqual(welcomeQuestions.map(q => q.question), [
    "How are you feeling right now?",
    "How has eating been for you today?",
    "What can I do for you?",
  ]);
  assert.equal(welcomeSpeech("en-US", 3), "What can I do for you?");
});

test("gentle check-in speech leaves call defaults and transcript unchanged", async () => {
  const { cartesiaPayload } = await import("../src/lib/cartesia");
  const question = welcomeQuestions[0].question;
  const gentle = cartesiaPayload(question, "en-US", "black_cat", false, "checkin");
  assert.equal(gentle.transcript, question);
  assert.deepEqual(gentle.generation_config, { speed: 0.84, volume: 0.9, emotion: "calm" });
  assert.deepEqual(cartesiaPayload(question, "en-US", "black_cat").generation_config, { speed: 0.94, volume: 0.92 });
  assert.equal(cartesiaPayload(question, "fr-FR", "white_cat", false, "checkin").generation_config.emotion, undefined);
});

test("short eating choices save while previously saved eating answers remain readable", () => {
  for (const choice of ["Joyful", "Okay", "Mixed", "Tough", "don't want to mention"])
    assert(welcomeAnswersSchema.safeParse(["Tired", choice, null]).success);
  assert(welcomeCheckinSchema.safeParse(checkin).success);
  assert(!welcomeAnswersSchema.safeParse(["Tired", "unlisted answer", null]).success);
});


test("three support choices save without invalidating previous check-ins", () => {
  for (const choice of welcomeQuestions[2].labels)
    assert(welcomeAnswersSchema.safeParse([null, null, choice]).success);
  for (const choice of ["Listen to what happened", "Chat about something else", "Company while I am eating", "Help sort out my thoughts", "Contact someone I trust"])
    assert(welcomeAnswersSchema.safeParse([null, null, choice]).success);
  assert(!welcomeAnswersSchema.safeParse([null, null, "unlisted support"]).success);
});
