import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const origin = process.env.TEST_ORIGIN || "http://localhost:3000";
async function user() {
  const res = await fetch(origin + "/api/demo", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(res.status, 200, await res.text());
  const cookie = res.headers.get("set-cookie").split(";")[0];
  return async (path, method = "GET", body, expected = 200) => {
    const res = await fetch(origin + "/api/" + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const txt = await res.text();
    assert.equal(res.status, expected, path + ": " + txt);
    if (res.headers.get("content-type")?.includes("ndjson"))
      return txt
        .split("\n")
        .filter(Boolean)
        .map((x) => JSON.parse(x));
    return txt ? JSON.parse(txt) : null;
  };
}
const a = await user(),
  b = await user();
await a("profile", "PATCH", {
  nickname: "Fictional Alex",
  onboarded: true,
  timezone: "America/Los_Angeles",
});
let session = await a("session");
assert.equal(session.profile.onboarded, true);
let events = await a("chat", "POST", {
  message: "I prefer short replies.",
  requestId: randomUUID(),
});
assert(events.some((e) => e.type === "delta"));
const cid = events.find((e) => e.type === "meta").conversationId;
assert.equal((await a("conversations/" + cid)).length, 2);
await b("conversations/" + cid, "GET", undefined, 404);
let memories = await a("memories");
assert.equal(memories.items.length, 1);
const mid = memories.items[0].id;
await b("memories/" + mid, "DELETE", undefined, 404);
await a("memories/" + mid, "PATCH", {
  text: "I prefer a little room to reflect.",
});
memories = await a("memories");
assert.equal(memories.items.length, 1);
assert.equal(memories.items[0].text, "I prefer a little room to reflect.");
const count = (await a("conversations")).length;
await a("chat", "POST", {
  message: "Fictional temporary test",
  temporary: true,
  requestId: randomUUID(),
});
assert.equal((await a("conversations")).length, count);
const key = randomUUID();
await a("chat", "POST", {
  message: "I do not want a plan.",
  requestId: key,
  conversationId: cid,
});
await a(
  "chat",
  "POST",
  { message: "I do not want a plan.", requestId: key, conversationId: cid },
  409,
);
assert.equal((await a("plans")).length, 0);
let draft = await a("plans/generate", "POST", {
  discussion: "I want a short quiet moment each day.",
  start: "2026-10-24",
  days: 7,
});
draft.task = "Notice one thing I need";
const plan = await a("plans", "POST", draft);
assert.equal(plan.data.state, "draft");
await b("plans/" + plan.id, "GET", undefined, 404);
const edited = await a("plans/" + plan.id, "PATCH", {
  ...draft,
  title: "My fictional quiet plan",
  version: plan.version,
});
await a("plans/" + plan.id, "PATCH", { ...draft, version: plan.version }, 409);
await a("plans/" + plan.id + "/accept", "POST", { version: edited.version });
let detail = await a("plans/" + plan.id);
assert.equal(detail.tasks.length, 7);
await a("plans/" + plan.id + "/accept", "POST", { version: edited.version });
assert.equal((await a("plans/" + plan.id)).tasks.length, 7);
const task = detail.tasks[0];
const entry = await a("checkins", "POST", {
  planId: plan.id,
  taskId: task.id,
  status: "Tried",
  tags: ["Helpful", "My fictional tag"],
  before: "Fictional before",
  after: "Fictional after",
  message: "At my pace.",
  helpful: "Yes",
});
assert.equal(entry.data.allowMemory, false);
const foreign = await b("plans", "POST", draft);
await b(
  "checkins",
  "POST",
  {
    planId: foreign.id,
    taskId: task.id,
    status: "Completed",
    tags: [],
    before: "",
    after: "",
    message: "",
    helpful: "",
  },
  404,
);
const revision = await a("plans/" + plan.id + "/revision", "POST", {
  task: "Notice one comfortable detail",
});
await a("plans/" + plan.id + "/apply", "POST", { revisionId: revision.id });
detail = await a("plans/" + plan.id);
assert.equal(detail.checkins[0].data.status, "Tried");
assert.equal(
  detail.tasks.find((t) => t.id === task.id).data.title,
  task.data.title,
);
const freshPlan = await a("plans", "POST", draft);
const wrongRev = await a("plans/" + freshPlan.id + "/revision", "POST", {
  task: "Quiet moment",
});
await a(
  "plans/" + plan.id + "/apply",
  "POST",
  { revisionId: wrongRev.id },
  404,
);
await a("profile", "PATCH", { memoryMode: "off" });
await a("chat", "POST", {
  message: "I prefer brief words.",
  requestId: randomUUID(),
  conversationId: cid,
});
const kept = (await a("memories")).items;
assert.equal(kept.length, 1);
await a("memories", "POST", { text: "Must not save" }, 403);
const exported = await a("export");
assert.equal(exported.demo, true);
assert(exported.records.some((r) => r.id === plan.id));
await a("account", "DELETE");
await a("session", "GET", undefined, 401);
const csrf = await fetch(origin + "/api/demo", {
  method: "POST",
  headers: {
    Origin: "https://invalid.example",
    "Content-Type": "application/json",
  },
  body: "{}",
});
assert.equal(csrf.status, 403);
console.log(
  "PASS: HTTP demo flow, streaming, persistent reload, explicit activation, idempotency, two-user isolation, parent-child rejection, reflection permissions, revision history, memory correction/revocation, export, deletion and CSRF.",
);
