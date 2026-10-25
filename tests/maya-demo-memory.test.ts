import test from "node:test";
import assert from "node:assert/strict";
import {
  mayaDemoBatch,
  mayaDemoMemories,
  mayaDemoText,
} from "../scripts/fixtures/maya-memories";
test("five fictional dated memories preserve dates, direct statements and support preferences", () => {
  assert.equal(mayaDemoMemories.length, 5);
  assert.equal(new Set(mayaDemoMemories.map((m) => m.key)).size, 5);
  assert(mayaDemoBatch.includes("fictional"));
  for (const e of mayaDemoMemories) {
    assert(e.date <= "2026-10-24");
    assert(mayaDemoText(e).startsWith("Fictional demo · Maya"));
    assert(mayaDemoText(e).includes("not verified personal history"));
    assert(!mayaDemoText(e).includes(e.query));
  }
  assert.equal(new Date("2026-10-18T12:00:00Z").getUTCDay(), 0);
  assert(
    mayaDemoMemories[0].text.includes("He did not mention her appearance"),
  );
  assert(mayaDemoMemories[0].text.includes("does not want reassurance"));
  assert(mayaDemoMemories[4].text.includes("wants to choose each time"));
  assert(
    !mayaDemoMemories.some((e) =>
      /diagnosed|calorie|weight.loss instruction/i.test(e.text),
    ),
  );
});
