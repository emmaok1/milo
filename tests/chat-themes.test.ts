import test from "node:test";
import assert from "node:assert/strict";
import { chatThemeSchema, chatModeSchema } from "../src/lib/chat-themes";
import { mobileState } from "../src/lib/listener-model";

test("existing profiles get the cloud background and unknown saved themes fall back safely", () => {
  assert.equal(mobileState(undefined).chatTheme, "cloud");
  assert.equal(mobileState({ chatTheme: "missing-theme" }).chatTheme, "cloud");
});

test("all three background choices survive profile normalization without changing companion data", () => {
  const original = mobileState(undefined);
  for (const theme of ["cloud", "night", "garden"]) {
    const next = mobileState({ ...original, chatTheme: theme });
    assert.equal(next.chatTheme, theme);
    assert.deepEqual(next.listener, original.listener);
    assert.deepEqual(mobileState(next), next);
  }
  assert(!chatThemeSchema.safeParse("https://example.com/background.svg").success);
  assert(!chatThemeSchema.safeParse({ theme: "cloud" }).success);
});

test("day/night appearance persists independently of scene and rejects invalid modes", () => {
  assert.equal(mobileState(undefined).chatMode, "night");
  assert.equal(mobileState({ chatMode: "invalid" }).chatMode, "night");
  for (const theme of ["cloud", "night", "garden"])
    for (const mode of ["day", "night"]) {
      const saved = mobileState({ chatTheme: theme, chatMode: mode });
      assert.equal(mobileState(saved).chatTheme, theme);
      assert.equal(mobileState(saved).chatMode, mode);
    }
  assert(!chatModeSchema.safeParse("automatic").success);
});
