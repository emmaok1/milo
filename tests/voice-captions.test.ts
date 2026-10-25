import test from "node:test";
import assert from "node:assert/strict";
import { VoiceCaptions } from "../src/lib/voice-captions";

test("captions reveal progressively, never all text before completion", () => {
  const updates: string[] = [];
  const c = new VoiceCaptions(t => updates.push(t));
  c.start("What happened when you saw him?");
  assert.equal(updates.at(-1), "What");
  c.progress(1, 3);
  assert(updates.at(-1)!.length > 4);
  c.progress(3, 3);
  assert.notEqual(updates.at(-1), "What happened when you saw him?");
  c.finish();
  assert.equal(updates.at(-1), "What happened when you saw him?");
});
test("cancel freezes partial text and rejects delayed progress or completion", () => {
  const updates: string[] = [];
  const c = new VoiceCaptions(t => updates.push(t));
  c.start("We can take our time."); c.progress(.5, 3); c.cancel();
  const count = updates.length;
  c.progress(10, 3); c.boundary(20); c.finish();
  assert.equal(updates.length, count);
  c.start("What happened?");
  assert.equal(updates.at(-1), "What");
  c.finish();
  assert.equal(updates.at(-1), "What happened?");
});
test("native word boundaries and non-space languages reveal text without rewinding", () => {
  const updates: string[] = [];
  const c = new VoiceCaptions(t => updates.push(t));
  c.start("Take your time."); c.boundary(5, 4);
  assert.equal(updates.at(-1), "Take your");
  c.progress(0, 9);
  assert.equal(updates.at(-1), "Take your");
  c.start("今天感觉怎么样？");
  assert.notEqual(updates.at(-1), "今天感觉怎么样？");
  c.finish(); assert.equal(updates.at(-1), "今天感觉怎么样？");
});
test("cancel releases estimated device caption timer", async () => {
  const updates: string[] = [];
  const c = new VoiceCaptions(t => updates.push(t));
  c.start("Take your time and tell me whenever you want.", true);
  c.cancel();
  await new Promise(r => setTimeout(r, 100));
  assert.equal(updates.length, 1);
});
