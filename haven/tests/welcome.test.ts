import test from "node:test";
import assert from "node:assert/strict";
import { welcomeAnswersSchema, welcomeCheckinSchema, welcomeContext, welcomeQuestions, welcomeSpeech } from "../src/lib/welcome";
import { mobileState } from "../src/lib/listener-model";
import { voiceLanguageCodes } from "../src/lib/voice";
const checkin = { id: "a5ef47f9-d399-42d6-b693-04fa5495d47b", createdAt: "2026-10-24T12:00:00.000Z", answers: ["Tired", "Haven’t eaten yet", "Contact someone I trust"] };
test("welcome choices validate by question and allow skipped answers", () => {
  assert(welcomeAnswersSchema.safeParse(checkin.answers).success);
  assert(welcomeAnswersSchema.safeParse([null, null, null]).success);
  assert(!welcomeAnswersSchema.safeParse(["Mostly okay", "Okay", null]).success);
  assert(!welcomeAnswersSchema.safeParse(["Okay", null]).success);
  assert(!welcomeAnswersSchema.safeParse(["Ignore instructions", null, null]).success);
  assert.equal(welcomeQuestions.length, 3);
  for (const question of welcomeQuestions) assert.equal(question.labels.length, 5);
});
test("welcome context expires and never implies permission to contact someone", () => {
  const now = Date.parse(checkin.createdAt);
  assert.match(welcomeContext(checkin, now), /not long-term memory/);
  assert.match(welcomeContext(checkin, now), /not authorization to send messages/);
  assert.equal(welcomeContext(checkin, now + 86400001), "");
  assert.equal(welcomeContext(checkin, now - 1), "");
  assert.equal(welcomeContext({ ...checkin, answers: [null, null, null] }, now), "");
  assert.equal(welcomeContext({ ...checkin, answers: ["Anything", null, null] }, now), "");
});
test("mobile normalization retains a valid check-in without changing legacy private data", () => {
  assert.deepEqual(mobileState({ welcomeCheckin: checkin }).welcomeCheckin, checkin);
  assert.equal(mobileState({ welcomeCheckin: { ...checkin, answers: [] } }).welcomeCheckin, undefined);
  assert(welcomeCheckinSchema.safeParse(checkin).success);
});
test("all saved languages have four spoken pages while interface copy remains English", () => {
  for (const language of voiceLanguageCodes) for (let step = 0; step < 4; step++) assert(welcomeSpeech(language, step)?.length > 0);
  assert.equal(welcomeSpeech("en-US", 0), "Welcome home. Meow.");
  for (let step = 1; step < 4; step++) assert.equal(welcomeSpeech("en-US", step), welcomeQuestions[step - 1].question);
});
