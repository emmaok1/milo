# Friends

## Present the demo

Open `/friends?preview=1` while signed in, or select **Preview demo** on Friends. The clearly marked in-memory preview contains a fictional conversation with Nina. It never creates real friendships, messages, invitations, meal records, Memory entries, or provider calls.

1. **Invite** opens an invitation panel. Copy copies the `DEMO-PREVIEW` placeholder key; Share opens the preview link. The preview key is not a real invitation.
2. **Private Chat → Open chat** displays the sample messages and accepts local demo messages.
3. **Eat Together → Start a meal → Join the table** shows Nina's fictional check-in, checks in the current demo participant, and opens the video layout.
4. Microphone controls demonstrate the UI only. **Preview your camera** explicitly requests local camera access; audio is not captured, nothing is transmitted or recorded, and tracks stop on exit. The other participant is a labeled demo placeholder. The preview always says **No live connection**.
5. **Exit preview** returns to real account data without saving the example.

## Real invitations, messages and check-in

Real mode uses the existing Supabase project and authentication. No new SQL migration is required for this demo version. A single private group per account supports up to six members. Invitations are random 24-character keys, hashed server-side, expire after 24 hours and can be revoked; generating a new invite replaces the old invite. Links put keys in URL fragments and preserve them through sign-in. Recipients preview the inviter and explicitly choose **Join**. Creating invitations never sends messages on Instagram or Facebook automatically; **Share** invokes the device share sheet.

`src/lib/friends-store.ts` is a narrow server-only shared-data gateway. Shared groups, memberships and human messages use explicitly typed `access_event` records, separate from AI conversations and extraction jobs. Membership is checked on every shared operation. Existing owner-only RLS for journals, reports, conversations and Memory stays unchanged. Messages are owned by the sender and account deletion cascades them. Query results whitelist the fields needed by the group and exclude outsider-owned messages. Group owners can close the group; members can leave. This is a bounded demo implementation, not a production community/moderation platform.

Supabase Realtime Broadcast carries only generic update notifications on a random topic; it contains no message content or personal metadata and grants no access. Clients refetch through the authenticated Friends API. A five-second visible-tab polling fallback keeps the group updated if broadcast is unavailable. AI never joins the group and no friend message is queued for Memory extraction.

## Enable real video later

The actual video flow uses a custom Daily call object via `@daily-co/daily-js`. Participant tiles, audio rendering and device controls are owned by `MealCallLayout`; the preview uses the same layout without a remote connection. Set the **server-only** `DAILY_API_KEY` in `.env.local` and restart the app. Create a new meal after enabling it. No key is configured in the current workspace, so live remote video has not been tested and real mode reports video unavailable. Invitation/chat/check-in and the marked preview work without that key.

When configured, Start a meal creates a private two-hour room. Checked-in group members receive short-lived room/user-scoped meeting tokens, not the provider key. Camera/microphone start off, recording and transcription are not enabled, and participant admin privileges are disabled. Leaving destroys the call object/media session. Retry requests a fresh scoped meeting token. Pending SDK imports/joins are guarded so they cannot reopen media after navigating away. Ending a meal or leaving the group uses Daily's user-ID ejection and ban endpoint for previously issued tokens. Provider limits/billing and cross-device camera behavior require a live-provider test once credentials are supplied.

Official APIs: https://docs.daily.co/reference/rest-api/rooms/create-room , https://docs.daily.co/reference/rest-api/meeting-tokens/create-meeting-token , https://docs.daily.co/reference/rest-api/rooms/session/eject , https://supabase.com/docs/guides/realtime/broadcast .

## Checks

`node --import tsx scripts/verify-friends.ts` creates and deletes three disposable accounts. It checks invite preview/join/revoke, private messages, idempotent sends, non-member denial, outsider record injection rejection, shared meal/check-in, leaving, and separation from AI/Memory sources. Results are in `artifacts/friends-live-checks.json`. `tests/friends.test.ts` covers invite parsing/expiry/revocation, scoped IDs, isolated preview fixtures and video-token configuration. Browser checks cover the marked preview's key copy, chat, check-in, controls, exit, non-persistence and 320/390/768px layouts. `tests/meal-call-session.test.ts` covers device-off joins, explicit media toggles, deduplicated leave events, late import/join cleanup, connection errors and permission failures. Current-user friendships are not created by the test harness.


### Private group UI update
The chat now uses a single header, square rounded avatars, left/right bubbles, time separators, and a three-item sharing tray (photos, moments, meals). Status and pats are persisted in member/message records and checked against authoritative group membership. Moments support up to three client-compressed JPEG images carried inside private message records; there are no public image URLs. This is a bounded small-group implementation, not a general media storage service. The API now requires a same-origin `/friends#invite=...` link for preview/join instead of a raw code. Existing token expiry/revocation checks still apply. Revoke is host-only.
Validated with typecheck, focused lint, unit tests, and a Firefox preview covering status, pat, photo+text publication, and 320/390/768px layout. Real cross-account synchronization remains unverified in this pass.
