import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { friendsDemoSnapshot } from "../src/lib/friends-demo";
import {
  extractInvite,
  privateInvite,
  momentImage,
  friendGroup,
  inviteUsable,
} from "../src/lib/friends-model";
import { friendId, invitationHash } from "../src/lib/friends-store";
import { dailyRoomPayload, dailyTokenPayload } from "../src/lib/daily-video";
test("invite links use fragment tokens, reject invalid codes, and revoke or expire deterministically", () => {
  const code = "Abcd_efgh-ijklMNOPqrstUV";
  assert.equal(code.length, 24);
  assert.equal(
    extractInvite("https://example.com/friends#invite=" + code),
    code,
  );
  assert.throws(() => extractInvite("short"));
  const sample = friendsDemoSnapshot("Test");
  const g = friendGroup.parse({
    type: "friends_group",
    name: "Our little space",
    ownerId: sample.userId,
    members: sample.group!.members,
    meal: null,
    closed: false,
    inviteHash: invitationHash(code),
    inviteExpiresAt: "2026-10-26T00:00:00Z",
    notificationKey: "example",
  });
  assert(
    inviteUsable(g, invitationHash(code), Date.parse("2026-10-25T00:00:00Z")),
  );
  assert(!inviteUsable({ ...g, inviteHash: null }, invitationHash(code), 0));
  assert(
    !inviteUsable(g, invitationHash(code), Date.parse("2026-10-27T00:00:00Z")),
  );
  assert(!inviteUsable({ ...g, closed: true }, invitationHash(code), 0));
});
test("group membership and message idempotency IDs are owner scoped and do not collide with AI turns", () => {
  const a = randomUUID(),
    b = randomUUID();
  assert.notEqual(friendId("membership", a), friendId("membership", b));
  assert.notEqual(
    friendId("message", a + ":one"),
    friendId("message", a + ":two"),
  );
  assert.match(friendId("membership", a), /^[a-f0-9-]{36}$/);
});
test("demo conversations are fictional independent snapshots and contain no video credentials", () => {
  const a = friendsDemoSnapshot("Test"),
    b = friendsDemoSnapshot("Test");
  assert.equal(a.messages.length, 3);
  a.messages.push({ ...a.messages[0], id: "extra" });
  assert.equal(b.messages.length, 3);
  assert.equal(b.group!.meal, null);
  assert.equal(b.group!.notificationKey, "demo-preview");
  assert(!JSON.stringify(b).includes("token"));
});
test("video rooms are private and tokens are user/room scoped with camera off and recording disabled", () => {
  const room = dailyRoomPayload("haven-test", 2000000000);
  assert.equal(room.privacy, "private");
  assert.equal(room.properties.start_video_off, true);
  assert.equal(room.properties.max_participants, 6);
  const token = dailyTokenPayload("haven-test", "user", "Test").properties;
  assert.equal(token.room_name, "haven-test");
  assert.equal(token.user_id, "user");
  assert.equal(token.is_owner, false);
  assert.equal(token.start_audio_off, true);
  assert.equal(token.start_cloud_recording, false);
  assert.equal(token.auto_start_transcription, false);
  assert.equal(token.permissions.canAdmin, false);
});

test("private entry rejects raw keys, other origins and other routes; image messages reject executable data", () => {
 const code="Abcd_efgh-ijklMNOPqrstUV";
 assert.equal(privateInvite(`https://milo.test/friends#invite=${code}`,"https://milo.test"),code);
 for(const link of [code,`https://other.test/friends#invite=${code}`,`https://milo.test/home#invite=${code}`]) assert.throws(()=>privateInvite(link,"https://milo.test"));
 assert(!momentImage.safeParse("data:image/svg+xml;base64,PHN2Zz4=").success);
 assert(!momentImage.safeParse("https://tracking.test/photo.jpg").success);
 assert(momentImage.safeParse("data:image/jpeg;base64,YWJj").success);
});
