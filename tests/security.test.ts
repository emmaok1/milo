import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  insert,
  get,
  list,
  update,
  remove,
  setProfile,
  type Context,
} from "../src/lib/store";
import { authorizeMemory } from "../src/lib/memory";
import { datePlus, localDate } from "../src/lib/types";
import { safePlan } from "../src/lib/ai";
import { retrieveKnowledge } from "../src/lib/knowledge";
const user = (): Context => ({ userId: randomUUID(), demo: true });
test("users cannot access or mutate another user records or attach foreign parent", async () => {
  const a = user(),
    b = user();
  for (const kind of ["conversation", "plan", "memory_link"] as const) {
    const record = await insert(a, kind, { title: "Fictional" });
    await assert.rejects(() => get(b, record.id));
    await assert.rejects(() => update(b, record.id, { title: "Changed" }, 1));
    await assert.rejects(() => remove(b, record.id));
    await assert.rejects(() =>
      insert(b, "task", { title: "Foreign parent" }, record.id),
    );
  }
  assert.equal((await list(b)).length, 0);
});
test("optimistic concurrency prevents stale updates", async () => {
  const c = user();
  const row = await insert(c, "plan", { title: "A" });
  await update(c, row.id, { title: "B" }, 1);
  await assert.rejects(() => update(c, row.id, { title: "C" }, 1));
  assert.equal((await get(c, row.id)).data.title, "B");
});
test("memory mode, permission revocation and account deletion stop processing", () => {
  for (const state of [
    { status: "active", memoryMode: "off", permissionVersion: 1 },
    { status: "active", memoryMode: "temporary", permissionVersion: 1 },
    { status: "deleted", memoryMode: "automatic", permissionVersion: 1 },
    { status: "active", memoryMode: "automatic", permissionVersion: 2 },
  ])
    assert.throws(() => authorizeMemory(state, "extract", 1));
  assert.throws(() =>
    authorizeMemory(
      { status: "active", memoryMode: "manual", permissionVersion: 1 },
      "extract",
      1,
    ),
  );
  assert.doesNotThrow(() =>
    authorizeMemory(
      { status: "active", memoryMode: "automatic", permissionVersion: 1 },
      "extract",
      1,
    ),
  );
});
test("no unreviewed clinical knowledge retrieved", () =>
  assert.deepEqual(retrieveKnowledge("support pause plan"), []));
test("timezone activity dates and leap boundaries", () => {
  assert.equal(
    localDate("America/Los_Angeles", new Date("2026-01-01T00:30:00Z")),
    "2025-12-31",
  );
  assert.equal(datePlus("2028-02-28", 1), "2028-02-29");
});
test("restriction and purging goals blocked", () => {
  assert.equal(safePlan("calorie restriction"), false);
  assert.equal(safePlan("fasting"), false);
  assert.equal(safePlan("Take a quiet moment"), true);
});
test("profile memory mode changes are persisted", async () => {
  const c = user();
  await setProfile(c, {
    nickname: "Fictional",
    memoryMode: "off",
    permissionVersion: 2,
  });
  assert.equal((await list(c, "profile"))[0].data.memoryMode, "off");
});
test("activation is atomic and duplicate accepts do not duplicate tasks", async () => {
  const { acceptDemo } = await import("../src/lib/plans");
  const c = user();
  const plan = await insert(c, "plan", {
    state: "draft",
    title: "Fictional",
    task: "Quiet moment",
    steps: ["Notice one thing"],
    days: 7,
    start: "2026-10-24",
  });
  await Promise.all([acceptDemo(c, plan.id, 1), acceptDemo(c, plan.id, 1)]);
  assert.equal((await list(c, "task", plan.id)).length, 7);
  assert.equal((await get(c, plan.id)).data.state, "active");
});
test("revision conflict rolls back every proposed change", async () => {
  const { applyDemo } = await import("../src/lib/plans");
  const c = user();
  const p = await insert(c, "plan", { state: "active" });
  const a = await insert(
    c,
    "task",
    { title: "First", date: "2026-10-25" },
    p.id,
  );
  const b = await insert(
    c,
    "task",
    { title: "Second", date: "2026-10-26" },
    p.id,
  );
  const r = await insert(
    c,
    "revision",
    {
      state: "preview",
      planVersion: p.version,
      changes: [
        { id: a.id, version: 1, after: "Changed first", date: "2026-10-25" },
        { id: b.id, version: 1, after: "Changed second", date: "2026-10-26" },
      ],
    },
    p.id,
  );
  await update(c, b.id, { title: "Concurrent edit" }, 1);
  await assert.rejects(() => applyDemo(c, p.id, r.id, "2026-10-24"));
  assert.equal((await get(c, a.id)).data.title, "First");
  assert.equal((await get(c, r.id)).data.state, "preview");
});
