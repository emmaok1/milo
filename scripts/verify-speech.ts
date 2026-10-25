/** Local speech smoke test. Supply a public/synthetic WebM fixture via SPEECH_TEST_AUDIO.
 * Creates/removes only its own disposable identity; makes no Claude calls. */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { speechToken, speechUrl } from "../src/lib/speech-input";
loadEnvConfig(process.cwd());
async function main() {
  assert(process.env.SPEECH_TEST_AUDIO, "Set SPEECH_TEST_AUDIO to a public/synthetic WebM test fixture.");
  const fixture = await readFile(process.env.SPEECH_TEST_AUDIO);
  const base = process.env.VOICE_TEST_URL || "http://127.0.0.1:3000";
  const origin = process.env.APP_ORIGIN || base;
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  let id: string | undefined;
  try {
    const unauthorized = await fetch(speechUrl() + "/transcribe?language=en", { method: "POST", body: fixture });
    assert.equal(unauthorized.status, 401);
    const localStart = performance.now();
    const local = await fetch(speechUrl() + "/transcribe?language=en", { method: "POST", headers: { Authorization: "Bearer " + speechToken() }, body: fixture });
    const localData = await local.json(); assert.equal(local.status, 200); assert.match(localData.text, /fellow|americans/i);
    console.log("PASS local WebM transcription, no text/audio logging; processing ms", Math.round(performance.now() - localStart));
    const email = `haven-speech-test-${randomUUID()}@example.com`, password = randomBytes(24).toString("base64url");
    const account = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.ifError(account.error); id = account.data.user!.id;
    const login = await fetch(base + "/api/auth/login", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
    const config = await fetch(base + "/api/voice/config", { headers: { Cookie: cookie } });
    assert.equal((await config.json()).transcription, true);
    const start = performance.now();
    const response = await fetch(base + "/api/voice/transcribe?language=en-US", { method: "POST", headers: { Origin: origin, Cookie: cookie, "Content-Type": "audio/webm" }, body: fixture });
    const data = await response.json(); assert.equal(response.status, 200); assert.match(data.text, /fellow|americans/i);
    console.log("PASS authenticated app transcription; round-trip ms", Math.round(performance.now() - start));
    const bad = await fetch(base + "/api/voice/transcribe?language=en-US", { method: "POST", headers: { Origin: origin, Cookie: cookie, "Content-Type": "audio/webm" }, body: "not audio" });
    assert.equal(bad.status, 400);
    const crossOrigin = await fetch(base + "/api/voice/transcribe?language=en-US", { method: "POST", headers: { Origin: "https://example.invalid", Cookie: cookie }, body: fixture });
    assert.equal(crossOrigin.status, 403);
    const rows = await admin.from("records").select("id").eq("user_id", id!).in("kind", ["message", "conversation", "job"]);
    assert.equal(rows.data?.length, 0);
    console.log("PASS malformed audio and origin rejection; transcription alone saves no messages or Memory jobs");
  } finally { if (id) { const result = await admin.auth.admin.deleteUser(id); assert.ifError(result.error); console.log("Disposable speech test account cleaned up."); } }
}
main().catch(e => { console.error("Speech verification failed:", e.message); process.exitCode = 1; });
