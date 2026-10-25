import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { createClient } from "@supabase/supabase-js";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !adminKey)
    throw new Error(
      "Configure a disposable Supabase test project first. This harness creates and removes only its own test accounts.",
    );
  const admin = createClient(url, adminKey, {
    auth: { persistSession: false },
  });
  const ids: string[] = [];
  try {
    const clients = [];
    for (let i = 0; i < 2; i++) {
      const email = `haven-test-${randomUUID()}@example.com`;
      const password = randomBytes(24).toString("base64url");
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      assert.ifError(error);
      ids.push(data.user!.id);
      const db = createClient(url, anon, { auth: { persistSession: false } });
      const login = await db.auth.signInWithPassword({ email, password });
      assert.ifError(login.error);
      clients.push(db);
    }
    const [a, b] = clients;
    for (const kind of ["conversation", "plan", "memory_link"]) {
      const { data: record, error } = await a
        .from("records")
        .insert({
          user_id: ids[0],
          kind,
          data: { title: "Disposable fictional test" },
        })
        .select()
        .single();
      assert.ifError(error);
      const read = await b.from("records").select("*").eq("id", record.id);
      assert.equal(read.data?.length, 0);
      const changed = await b
        .from("records")
        .update({ data: { title: "Forbidden" }, version: 2 })
        .eq("id", record.id)
        .select();
      assert.equal(changed.data?.length, 0);
      const removed = await b
        .from("records")
        .delete()
        .eq("id", record.id)
        .select();
      assert.equal(removed.data?.length, 0);
      const foreign = await b
        .from("records")
        .insert({
          user_id: ids[1],
          kind: "task",
          parent_id: record.id,
          data: { title: "Forbidden" },
        });
      assert(foreign.error);
    }
    const impersonation = await b
      .from("records")
      .insert({ user_id: ids[0], kind: "conversation", data: {} });
    assert(impersonation.error);
    const knowledge = await a
      .from("knowledge_items")
      .insert({
        id: randomUUID(),
        title: "Forbidden",
        category: "test",
        content: "Private must never publish",
        source_url: "https://example.com",
      });
    assert(knowledge.error);
    const profile = await a
      .from("records")
      .insert({
        user_id: ids[0],
        kind: "profile",
        data: { status: "active", permissionVersion: 1 },
      })
      .select()
      .single();
    assert.ifError(profile.error);
    const revoke = await a
      .from("records")
      .update({ data: { status: "deleted", permissionVersion: 2 }, version: 2 })
      .eq("id", profile.data.id);
    assert.ifError(revoke.error);
    const after = await a.from("records").select("*");
    assert.equal(after.data?.length, 0);
    console.log(
      "PASS: live authenticated RLS ownership, parent references, knowledge write rejection and account revocation.",
    );
  } finally {
    for (const id of ids) await admin.auth.admin.deleteUser(id);
  }
}
main().catch(() => {
  console.error(
    "Live RLS test failed or unconfigured. No secrets or raw provider errors are printed.",
  );
  process.exitCode = 1;
});
