import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { journalText } from "../src/lib/listener-model";
loadEnvConfig(process.cwd());
async function main() {
  const base = process.env.JOURNAL_TEST_URL || "http://127.0.0.1:3000",
    origin = process.env.APP_ORIGIN || base;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const ids: string[] = [];
  async function account() {
    const email = `haven-journal-${randomUUID()}@example.com`,
      password = randomBytes(24).toString("base64url");
    const made = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(made.error);
    ids.push(made.data.user!.id);
    const login = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(login.status, 200);
    const headers = {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: login.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    };
    return async (path: string, body?: unknown) => {
      const r = await fetch(base + "/api/" + path, {
        method: body ? "POST" : "GET",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, data: await r.json() };
    };
  }
  try {
    const a = await account(),
      b = await account();
    const before = (await a("mobile")).data.listener;
    const common = { date: "2026-10-24", time: "13:00", recordVersion: 2 };
    const text = {
      ...common,
      id: randomUUID(),
      note: "A fictional meal moment.",
    };
    let saved = await a("mobile", { action: "entry", value: text });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.journal[0].private, true);
    assert.deepEqual(saved.data.journal[0].feelings, []);
    assert.equal(saved.data.journal[0].mealType, undefined);
    assert.deepEqual(saved.data.listener, before);
    const reaction = {
      ...common,
      id: randomUUID(),
      feelings: ["Guilty"],
      reactions: ["Urge to compensate"],
      behaviorNote: "A fictional reaction.",
    };
    saved = await a("mobile", { action: "entry", value: reaction });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.data.journal.at(-1).behaviors, []);
    // Supply a public/synthetic JPEG fixture to exercise the real photo validator.
    const photoPath = process.env.JOURNAL_TEST_PHOTO;
    if (photoPath) {
      const photo =
        "data:image/jpeg;base64," +
        (await readFile(photoPath)).toString("base64");
      const photoId = randomUUID();
      assert.equal(
        (
          await a("mobile", {
            action: "entry",
            value: { ...common, id: photoId, photo },
          })
        ).status,
        200,
      );
      assert.equal(
        (await b("journal/analyze-photo", { id: photoId })).status,
        404,
      );
      if (process.argv.includes("--photo-analysis")) {
        const analyzed = await a("journal/analyze-photo", { id: photoId });
        assert.equal(analyzed.status, 200);
        assert.equal(
          analyzed.data.category,
          null,
          "Synthetic non-food image must be unknown",
        );
        const again = await a("journal/analyze-photo", { id: photoId });
        assert.equal(again.status, 200);
        const state = await a("mobile");
        assert.equal(
          state.data.journal.find((e: { id: string }) => e.id === photoId)
            .foodCategory,
          null,
        );
      }
    }
    for (const patch of [
      { feelings: ["Calm", "Happy", "Satisfied", "Tired"] },
      { date: "2026-02-31" },
      { time: "24:99" },
      { note: " ", feelings: [], reactions: [] },
      { behaviorNote: "x".repeat(801) },
      { diagnosis: "unsupported" },
    ])
      assert.equal(
        (await a("mobile", { action: "entry", value: { ...text, ...patch } }))
          .status,
        400,
      );
    const legacy = {
      id: randomUUID(),
      date: "2026-10-24",
      time: "12:15",
      private: true,
      mealType: "Lunch",
      location: "Home",
      company: "Alone",
      satiety: "Moderate",
      feelings: ["Anxious", "Lonely", "Shamed", "Afraid"],
      behaviors: ["Binge"],
      food: "Noodles",
      note: "Fictional legacy note",
    };
    assert.equal(
      (await a("mobile", { action: "entry", value: legacy })).status,
      200,
    );
    const edit = {
      ...legacy,
      food: undefined,
      note: journalText(legacy) + "\nUpdated.",
    };
    assert.equal(
      (await a("mobile", { action: "entry", value: edit })).status,
      200,
    );
    const edited = (await a("mobile")).data.journal.find(
      (e: { id: string }) => e.id === legacy.id,
    );
    assert.equal(edited.location, "Home");
    assert.equal(edited.behaviors[0], "Binge");
    assert(edited.note.includes("Noodles"));
    assert.equal(edited.food, undefined);
    assert.equal((await b("mobile")).data.journal.length, 0);
    await b("mobile", { action: "delete-entry", id: legacy.id });
    assert(
      (await a("mobile")).data.journal.some(
        (e: { id: string }) => e.id === legacy.id,
      ),
    );
    assert.equal((await a("conversations")).data.length, 0);
    const jobs = await admin
      .from("records")
      .select("id")
      .eq("user_id", ids[0])
      .eq("kind", "job");
    assert.ifError(jobs.error);
    assert.equal(jobs.data?.length, 0);
    assert.equal(
      (await a("mobile", { action: "delete-entry", id: legacy.id })).status,
      200,
    );
    assert(
      !(await a("mobile")).data.journal.some(
        (e: { id: string }) => e.id === legacy.id,
      ),
    );
    console.log(
      "PASS minimal save, defaults, reactions separate from actions, validation, legacy edit, owner isolation, deletion, no automatic chat/Memory" +
        (photoPath ? ", photo-only save" : ""),
    );
  } finally {
    for (const id of ids) {
      const r = await admin.auth.admin.deleteUser(id);
      assert.ifError(r.error);
    }
    console.log("Disposable journal accounts removed.");
  }
}
main().catch((e) => {
  console.error("Journal verification failed:", e.message);
  process.exitCode = 1;
});
