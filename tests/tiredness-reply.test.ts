import assert from "node:assert/strict";
import { test } from "node:test";
import { tirednessReply, tiredMusicReply, tiredComfort } from "../src/lib/tiredness-reply";
const history = [{ role: "user", text: "I'm tired." }];
test("second tired turn bypasses generation across English and Chinese", () => {
  assert.equal(tirednessReply("I'm just exhausted.", history), tiredMusicReply);
  assert.equal(tirednessReply("就是累了。", [{ role: "user", text: "今天好累。" }]), tiredMusicReply);
  assert.equal(tirednessReply("I'm tired.", []), undefined);
});
test("negation, other people, questions, requests and unsafe context stay with model", () => {
  for (const text of ["I'm not tired", "My friend is tired", "I'm tired, tell me a joke", "Why am I tired?", "我不累", "她累了", "累了，胸痛"]) {
    assert.equal(tirednessReply(text, history), undefined);
  }
  assert.equal(tirednessReply("I'm tired", [...history, { role: "user", text: "I have chest pain" }]), undefined);
  assert.equal(tirednessReply("I'm tired", [{ role: "assistant", text: "I'm tired" }]), undefined);
});
test("respect declined questions and avoid repeating music invitation", () => {
  assert.equal(tirednessReply("I'm tired", [...history, { role: "user", text: "No more questions" }]), tiredComfort);
  assert.equal(tirednessReply("I'm tired", [...history, { role: "assistant", text: tiredMusicReply }]), tiredComfort);
});
