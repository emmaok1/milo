import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
loadEnvConfig(process.cwd());
async function main() {
  const base = process.env.VOICE_TEST_URL || "http://127.0.0.1:3000", origin = process.env.APP_ORIGIN || base;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const ids: string[] = [];
  async function account(character: string) {
    const email = `haven-personalization-${randomUUID()}@example.com`, password = randomBytes(24).toString("base64url");
    const made = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { havenCharacter: character } });
    assert.ifError(made.error); ids.push(made.data.user!.id);
    const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
    const headers = { Origin: origin, Cookie: cookie, "Content-Type": "application/json" };
    async function call(path: string, method = "GET", body?: unknown) {
      const r = await fetch(base + "/api/" + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: r.status, data: await r.json() };
    }
    return { call, headers };
  }
  try {
    const a = await account("female"), b = await account("male");
    const before = (await a.call("mobile")).data.listener;
    assert.equal(before.kind, "pet"); assert.equal(before.color, "white"); assert.equal(before.language, "en-US");
    assert.equal((await a.call("mobile", "POST", { action: "feedback", value: { topic: "Demo", note: "Fictional retained note", rating: 4 } })).status, 200);
    for (const character of ["white_cat", "black_cat"]) {
      const value = { character, language: "fr-FR", name: "  Willow  ", traits: ["Patient", "Direct"] };
      const saved = await a.call("mobile", "POST", { action: "personalize-listener", value });
      assert.equal(saved.status, 200); assert.equal(saved.data.listener.name, "Willow");
      assert.equal(saved.data.listener.color, character === "white_cat" ? "white" : "black");
      assert.equal(saved.data.listener.address, before.address); assert.equal(saved.data.feedback.length, 1);
      const profile = await a.call("profile"); assert.equal(profile.data.companion, character); assert.equal(profile.data.mobile.listener.language, "fr-FR");
      if (process.argv.includes("--smoke") && process.env.CARTESIA_API_KEY) {
        const response = await fetch(base + "/api/voice/speech", { method: "POST", headers: a.headers, body: JSON.stringify({ character, language: "fr-FR", text: "Bonjour." }) });
        assert.equal(response.status, 200);
        const audio = Buffer.from(await response.arrayBuffer()); assert.equal(audio.toString("ascii", 0, 4), "RIFF");
        console.log("PASS fixed Cartesia cat voice", character);
      }
    }
    const value = { character: "black_cat", language: "fr-FR", name: "Willow", traits: ["Patient", "Direct"] };
    assert.equal((await b.call("mobile")).data.listener.name, "Mochi");
    for (const patch of [{ kind: "male" }, { character: "male" }, { language: "unknown" }, { traits: ["Direct", "Direct"] }]) {
      assert.equal((await a.call("mobile", "POST", { action: "personalize-listener", value: { ...value, ...patch } })).status, 400);
    }
    const checkinId = randomUUID();
    const answers = ["Tired", "Haven’t eaten yet", "Contact someone I trust"];
    const checkin = await a.call("mobile", "POST", { action: "welcome-checkin", value: { id: checkinId, answers } });
    assert.equal(checkin.status, 200); assert.deepEqual(checkin.data.welcomeCheckin.answers, answers);
    assert.equal(checkin.data.listener.name, "Willow"); assert.equal(checkin.data.feedback.length, 1);
    assert.equal((await a.call("mobile")).data.welcomeCheckin.id, checkinId);
    assert.equal((await b.call("mobile")).data.welcomeCheckin, undefined);
    assert.equal((await a.call("mobile", "POST", { action: "welcome-checkin", value: { id: checkinId, answers: ["Mostly okay", null, null] } })).status, 400);
    const skipped = await a.call("mobile", "POST", { action: "welcome-checkin", value: { id: checkinId, answers: [null, null, null] } });
    assert.equal(skipped.status, 200); assert.deepEqual(skipped.data.welcomeCheckin.answers, [null, null, null]);
    console.log("PASS check-in persistence, skip, validation and account isolation");
    console.log("PASS cat/name/language/style persistence, legacy mapping, account isolation and retained settings");
    if (process.argv.includes("--smoke")) {
      const response = await fetch(base + "/api/chat", { method: "POST", headers: a.headers, body: JSON.stringify({ requestId: randomUUID(), message: "Say hello and include your companion display name. One sentence only.", temporary: true, voice: true }) });
      assert.equal(response.status, 200);
      const events = (await response.text()).trim().split("\n").map(s => JSON.parse(s));
      assert(events.some(e => e.type === "done" && e.state === "completed"));
      const reply = events.filter(e => e.type === "delta").map(e => e.text).join("");
      assert.match(reply, /Willow/); assert.match(reply, /bonjour|salut|coucou/i);
      console.log("PASS real voice reply uses the saved name and French without a per-call language selection");
    }
  } finally {
    for (const id of ids) { const r = await admin.auth.admin.deleteUser(id); assert.ifError(r.error); }
    console.log("Disposable personalization accounts cleaned up.");
  }
}
main().catch(e => { console.error("Personalization verification failed:", e.message); process.exitCode = 1; });
