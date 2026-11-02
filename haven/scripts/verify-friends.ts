import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";

loadEnvConfig(process.cwd());
async function main() {
  const base = process.env.VOICE_TEST_URL || "http://127.0.0.1:3000",
    origin = process.env.APP_ORIGIN || base;
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const ids: string[] = [];
  async function account(character: string) {
    const email = `haven-quick-${randomUUID()}@example.com`,
      password = randomBytes(24).toString("base64url");
    const made = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { havenCharacter: character },
    });
    assert.ifError(made.error);
    ids.push(made.data.user!.id);
    const r = await fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(r.status, 200);
    const headers = {
      Origin: origin,
      "Content-Type": "application/json",
      Cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    };
    const call = (
      path: string,
      body?: unknown,
      method = body ? "POST" : "GET",
    ) =>
      fetch(base + "/api/" + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    const p = await call(
      "profile",
      { memoryMode: "manual", onboarded: true },
      "PATCH",
    );
    assert.equal(p.status, 200);
    return { call, headers };
  }

  try {
    const a = await account("black_cat"),
      b = await account("white_cat"),
      outsider = await account("black_cat");
    await a.call("profile", { nickname: "Demo host" }, "PATCH");
    await b.call("profile", { nickname: "Nina" }, "PATCH");
    assert.equal((await (await a.call("friends")).json()).group, null);
    let r = await a.call("friends", { action: "invite" });
    assert.equal(r.status, 200, await (!r.ok ? r.text() : Promise.resolve("")));
    const invited = await r.json();
    assert.equal(invited.code.length, 24);
    assert(!JSON.stringify(invited).includes("inviteHash"));
    const preview = await b.call("friends", {
      action: "preview",
      code: invited.code,
    });
    assert.equal(preview.status, 200);
    assert.equal((await preview.json()).inviter, "Demo host");
    assert.equal(
      (
        await outsider.call("friends", {
          action: "message",
          text: "Unauthorized",
          requestId: randomUUID(),
        })
      ).status,
      404,
    );
    r = await b.call("friends", { action: "join", code: invited.code });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).group.members.length, 2);
    const requestId = randomUUID();
    r = await a.call("friends", {
      action: "message",
      text: "Fictional test: would you like some dinner company?",
      requestId,
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).messages.length, 1);
    assert.equal(
      (
        await a.call("friends", {
          action: "message",
          text: "Fictional test: would you like some dinner company?",
          requestId,
        })
      ).status,
      200,
    );
    assert.equal((await (await b.call("friends")).json()).messages.length, 1);
    const forged = await admin
      .from("records")
      .insert({
        id: randomUUID(),
        user_id: ids[2],
        kind: "access_event",
        data: {
          type: "friends_message",
          groupId: invited.group.id,
          name: "Spoofed member",
          text: "Unauthorized injected message",
        },
      });
    assert.ifError(forged.error);
    assert.equal(
      (await (await a.call("friends")).json()).messages.length,
      1,
      "Raw outsider-owned records must not enter group chat",
    );
    const rows = await admin
      .from("records")
      .select("id")
      .in("user_id", ids)
      .eq("kind", "message");
    assert.ifError(rows.error);
    assert.equal(
      rows.data!.length,
      0,
      "Friends messages must not become AI chat/Memory sources",
    );
    assert.equal((await a.call("friends", { action: "revoke" })).status, 200);
    assert.equal(
      (await outsider.call("friends", { action: "join", code: invited.code }))
        .status,
      404,
    );
    r = await a.call("friends", { action: "start-meal" });
    assert.equal(r.status, 200);
    const mealState = await r.json();
    assert(mealState.group.meal);
    const mealId = mealState.group.meal.id;
    assert.equal(
      (await a.call("friends", { action: "check-in", mealId })).status,
      200,
    );
    assert.equal(
      (await b.call("friends", { action: "check-in", mealId })).status,
      200,
    );
    const shared = await (await a.call("friends")).json();
    assert.equal(shared.group.meal.checkedIn.length, 2);
    if (!shared.videoReady)
      assert.equal(
        (await b.call("friends", { action: "video", mealId })).status,
        503,
      );
    assert.equal(
      (await b.call("friends", { action: "leave-group" })).status,
      200,
    );
    assert.equal((await (await b.call("friends")).json()).group, null);
    assert.equal(
      (
        await b.call("friends", {
          action: "message",
          text: "After leaving",
          requestId: randomUUID(),
        })
      ).status,
      404,
    );
    assert.equal((await a.call("friends", { action: "end-meal" })).status, 200);
    assert.equal(
      (await a.call("friends", { action: "leave-group" })).status,
      200,
    );
    await mkdir("artifacts", { recursive: true });
    await writeFile(
      "artifacts/friends-live-checks.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          invite: true,
          previewBeforeJoin: true,
          sharedChat: true,
          duplicateMessageSuppression: true,
          nonMemberRejected: true,
          outsiderOwnedMessageInjectionRejected: true,
          revocation: true,
          sharedMeal: true,
          checkIn: true,
          noAiOrMemorySource: true,
          leaveRevokesAccess: true,
          videoProviderConfigured: shared.videoReady,
          note: "Real Supabase auth/storage with three disposable accounts; no messages or friendships added to existing users.",
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS live invites, two-user chat, deduplication, member checks, revocation, shared meal/check-in, no AI/Memory source and leaving.",
    );
  } finally {
    for (const id of ids) {
      await admin.auth.admin.deleteUser(id);
    }
    console.log("Disposable Friends accounts removed.");
  }
}
main().catch((e) => {
  console.error("Friends verification failed:", e.message);
  process.exitCode = 1;
});
