/** Fictional-input live smoke test. Creates and deletes only its own disposable accounts.
 * Requires a running app and worker; --live permits small billed Claude/Mem0 calls. */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
loadEnvConfig(process.cwd());
const base = process.env.VOICE_TEST_URL || "http://127.0.0.1:3000";
const origin = process.env.APP_ORIGIN || base;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const ids: string[] = [];
async function main() {
  assert(process.argv.includes("--live"), "Pass --live to allow fictional-input provider calls.");
  async function account(character = "black_cat") {
    const email = `haven-voice-test-${randomUUID()}@example.com`, password = randomBytes(24).toString("base64url");
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { havenCharacter: character } });
    assert.ifError(made.error); ids.push(made.data.user!.id);
    const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; "); assert(cookie);
    async function call(path: string, method = "GET", body?: unknown) {
      const r = await fetch(base + "/api/" + path, { method, headers: { Origin: origin, Cookie: cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: r.status, data: await r.json() };
    }
    const restored = await call("session");
    assert.equal(restored.data.profile.companion, character);
    const profile = await call("profile", "PATCH", { nickname: "Fictional voice tester", onboarded: true });
    assert.equal(profile.status, 200);
    return { cookie, call };
  }
  const a = await account("black_cat"), b = await account("white_cat");
  const send = (body: object, signal?: AbortSignal) => fetch(base + "/api/chat", { method: "POST", signal, headers: { Origin: origin, Cookie: a.cookie, "Content-Type": "application/json" }, body: JSON.stringify({ requestId: randomUUID(), voice: true, language: "en-US", replyStyle: "Short", ...body }) });
  assert.equal((await a.call("mobile", "POST", { action: "feedback", value: { topic: "Demo", note: "Fictional retained setting", rating: 4 } })).status, 200);
  for (const [character, name] of [["black_cat", "Mochi"], ["white_cat", "Mochi"]]) {
    assert.equal((await a.call("profile", "PATCH", { companion: character })).status, 200);
    const state = await a.call("mobile");
    assert.equal(state.data.listener.name, name); assert.equal(state.data.feedback.length, 1);
    const response = await send({ temporary: true, message: "What is your listener name? Answer only with your name." });
    const events = (await response.text()).trim().split("\n").map(s => JSON.parse(s));
    assert(events.some(e => e.type === "done" && e.state === "completed"));
    assert(events.filter(e => e.type === "delta").map(e => e.text).join("").includes(name));
  }
  assert.equal((await a.call("voice/config")).data.cartesia, Boolean(process.env.CARTESIA_API_KEY));
  if (!process.env.CARTESIA_API_KEY) {
  const unavailable = await a.call("voice/speech", "POST", { text: "Fictional hello.", language: "en-US", character: "black_cat" });
  assert.equal(unavailable.status, 503);
  }
  console.log("PASS registration-role restoration, two live cat persona replies, persistent switching and explicit unconfigured TTS");
  const res = await send({ message: "This is a fictional demo. I prefer short replies." });
  assert.equal(res.status, 200);
  const events = (await res.text()).trim().split("\n").map(s => JSON.parse(s));
  assert(events.some(e => e.type === "done" && e.state === "completed"));
  const cid = events.find(e => e.type === "meta").conversationId;
  assert(cid);
  console.log("PASS live voice chat, session cookies and conversation ID");
  assert.equal((await b.call(`voice/memories?conversation=${cid}`)).status, 404);
  console.log("PASS cross-account call Memory isolation");
  let result = await a.call(`voice/memories?conversation=${cid}`);
  const deadline = Date.now() + 90000;
  while (result.data.pending && Date.now() < deadline) { await delay(3000); result = await a.call(`voice/memories?conversation=${cid}`); }
  assert.equal(result.status, 200); assert.equal(result.data.pending, 0); assert.equal(result.data.failed, 0); assert(result.data.items.length > 0, "Expected the explicit fictional preference to become a memory");
  console.log("PASS worker-backed extraction and call-scoped Memory");
  const mid = result.data.items[0].id;
  assert.equal((await b.call("memories/" + mid, "DELETE")).status, 404);
  assert.equal((await a.call("memories/" + mid, "PATCH", { text: "For fictional demos, I prefer brief replies." })).status, 200);
  const corrected = await a.call(`voice/memories?conversation=${cid}`);
  assert(corrected.data.items.some((m: { text: string }) => m.text.includes("fictional demos")));
  for (const m of corrected.data.items) assert.equal((await a.call("memories/" + m.id, "DELETE")).status, 200);
  assert.equal((await a.call(`voice/memories?conversation=${cid}`)).data.items.length, 0);
  console.log("PASS memory correction retains call provenance and deletion removes it");
  const abortedId = randomUUID(), ac = new AbortController();
  const interrupted = await send({ requestId: abortedId, conversationId: cid, message: "This is a fictional test. Please call me Demo Friend." }, ac.signal);
  const reader = interrupted.body!.getReader();
  const first = await reader.read(); assert(first.value?.length);
  ac.abort(); await reader.cancel().catch(() => {});
  const sources = await admin.from("records").select("id").eq("user_id", ids[0]).eq("kind", "message").eq("data->>requestId", abortedId).eq("data->>role", "user");
  assert.equal(sources.data?.length, 1);
  let jobs = await admin.from("records").select("id").eq("user_id", ids[0]).eq("kind", "job").eq("data->>sourceId", sources.data![0].id);
  for (let n = 0; !jobs.data?.length && n < 20; n++) {
    await delay(250);
    jobs = await admin.from("records").select("id").eq("user_id", ids[0]).eq("kind", "job").eq("data->>sourceId", sources.data![0].id);
  }
  assert.equal(jobs.data?.length, 1);
  console.log("PASS interrupted voice reply still queues its confirmed user message exactly once");
  const before = await admin.from("records").select("id", { count: "exact" }).eq("user_id", ids[0]).in("kind", ["message", "conversation", "job"]);
  const temporary = await send({ temporary: true, language: "zh-CN", voiceHistory: [{ role: "user", text: "My fictional favorite color is lavender." }, { role: "assistant", text: "I heard you." }], message: "What fictional color did I mention? 请用中文回答。" });
  const tmp = (await temporary.text()).trim().split("\n").map(s => JSON.parse(s));
  assert(tmp.some(e => e.type === "done" && e.state === "completed"));
  assert.equal(tmp.find(e => e.type === "meta").conversationId, null);
  const reply = tmp.filter(e => e.type === "delta").map(e => e.text).join("");
  assert.match(reply, /[\u4e00-\u9fff]/); assert.match(reply, /lavender|薰衣草/i);
  const after = await admin.from("records").select("id", { count: "exact" }).eq("user_id", ids[0]).in("kind", ["message", "conversation", "job"]);
  assert.equal(before.count, after.count);
  console.log("PASS Chinese voice selection and temporary multi-turn context without saved messages/jobs");
}
async function run() {
try { await main(); }
finally {
  // Stop extraction before removing remote memories and test accounts.
  for (const id of ids) {
    const profiles = await admin.from("records").select("id,data,version").eq("user_id", id).eq("kind", "profile");
    for (const p of profiles.data || []) await admin.from("records").update({ data: { ...p.data, memoryMode: "off", permissionVersion: Number(p.data.permissionVersion || 1) + 1 }, version: p.version + 1 }).eq("id", p.id);
    // The single worker rechecks permission after remote extraction; allow any active call to settle.
  }
  await delay(5000);
  for (const id of ids) {
    const cleanup = await fetch(process.env.MEMORY_SERVICE_URL + "/operation", { method: "POST", headers: { Authorization: "Bearer " + process.env.MEMORY_SERVICE_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ operation: "delete_all", user_id: id }) });
    assert(cleanup.ok, "Test memory cleanup failed; retained disposable identity for retry");
    const removed = await admin.auth.admin.deleteUser(id); assert.ifError(removed.error);
  }
  console.log("Disposable test accounts and remote memories cleaned up.");
}

}
run().catch(e => { console.error("Voice verification failed:", e.message); process.exitCode = 1; });
