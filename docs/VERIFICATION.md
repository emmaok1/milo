# Verification record

Date: October 24, 2026. All test content is fictional. No production services or real user records were used.

## Passed

- TypeScript static checking (`npm run typecheck`).
- ESLint (`npm run lint`), without errors or warnings on the final checked source.
- Next.js production compilation (`npm run build`, Webpack); TypeScript, route generation, page data collection, and build trace generation succeeded.
- Nine direct core tests: two-user record isolation; unauthorized parent references; optimistic concurrency; memory/account/permission revocation; unpublished knowledge exclusion; timezone/leap boundaries; rejected harmful plan categories; persistent profile modes; atomic duplicate activation; and complete revision rollback on conflict. Multiple checks are grouped into individual cases.
- Five Python adapter tests using **explicit fake dependencies**: wrong service token rejected; cross-owner delete rejected; retrieval scoped before return; deletion purges only the owned memory's history; account memory cleanup preserves the other user's memories.
- Full HTTP demo flow against a running Next server: onboarding persistence, streamed fictional replies, conversation restoration, automatic fictional preference memory, cross-user access rejection, memory corrections, temporary-chat history exclusion, duplicate message rejection, negative plan request leaves plans empty, draft generation/edit/version conflict, explicit idempotent activation, task/check-in persistence, forged task-parent rejection, reflection permissions off by default, preview/accept future revision with past records preserved, wrong-plan revision rejected, disabled extraction, manual writes denied in off mode, export, account access revocation, and incorrect-origin rejection.
- HTTP 200 for the login page, with no-store, nosniff, same-origin referrer, and frame-denial headers.
- Python adapter syntax compilation.
- Inspected the exact published Mem0 OSS 1.0.0 wheel from official PyPI: `store` configuration, owner metadata on get, scoped search/get_all, infer control, and history table/deletion behavior. The application explicitly purges scoped active history records after delete rather than assuming Mem0 delete removes history.

## Unverified / blocked by environment

- No Supabase project or Anthropic key/model authorization is configured. `npm run verify:services` reports Claude and Supabase unconfigured and the Mem0 HTTP service reachable after its container is started.
- Actual signup, verification email, reset-email delivery, real Claude token streaming, persistent Qdrant calls, Mem0 extraction/model calls, live remote cleanup, and database RLS execution have not been verified.
- A live RLS harness is supplied as `npm run test:rls`. It creates two disposable test users using the internal test-project admin key, then exercises direct authenticated REST access and deletes only those created users. Run it only against a disposable configured test project. It has not been run here.
- The supplied UI automation reported no available browser; attempts to open both in-app and Chrome previews returned “Browser is not available.” Actual desktop/mobile browser rendering, keyboard navigation, and browser-based full-flow tests therefore remain unverified. Responsive CSS, accessible labels, focus styles, and reduced-motion rules are implemented but not a substitute for visual QA.
- No hosting deployment was performed, following both prompt documents' instruction not to publish automatically.

## Notes

The initial Turbopack build failed because the environment denied an internal port operation. Switching to Next's supported Webpack build completed successfully. A sandboxed HTTP request could not reach the server; the approved local-network execution path was used for actual HTTP testing.

An early duplicate-chat test exposed an uncaught async error returning 500 instead of 409. Awaiting the chat handler inside the API error boundary fixed it, and the complete HTTP flow subsequently passed. Generated drafts now save immediately, direct draft edits autosave, and failed saves retain the in-memory draft. A hard navigation before a pending autosave remains a documented limit.

These results establish a working fictional local demonstration and tested application logic. They do not establish clinical effectiveness, a clinically validated safety system, live provider connectivity, or a production privacy/security certification.

## Claude migration checks (October 24, 2026)

- Replaced the web OpenAI SDK/Responses calls with native Anthropic Messages calls, including streaming and JSON-schema plan generation with local Zod validation.
- Added mocked Claude transport tests for native requests, schema validation, incomplete replies/plans, and missing-key handling. These are not live model calls.
- Added fake-provider Python checks for the Mem0 Claude adapter, modern thinking settings, omitted legacy parameters, and incomplete/invalid JSON handling.
- The chat/plan default is Sonnet 5.5; extraction defaults to Haiku 5.5. Sonnet uses `between_tools`, Haiku uses `disabled`, with no tools sent and bounded output tokens. These settings avoid up-front thinking for this latency-sensitive workload.
- Web production build, typecheck, lint, and full fictional HTTP flow passed after replacing the provider. Embeddings are configured locally using CPU MiniLM in a separate 384-dimensional collection.
- Live Claude calls, signup/email/database execution, and full Claude-backed memory extraction/persistence remain unverified until credentials are supplied. See `CLAUDE_SETUP.md`.

- Claude migration local checks passed: 14 TypeScript tests, 8 Python fake-dependency tests, typecheck, lint, and production build. Docker image build and real MiniLM/Qdrant add/search/delete with cross-owner deletion rejection passed using a fictional key and no Claude API calls. Fictional test memories were removed. These storage checks do not establish live extraction quality or full provider connectivity.

- Live local storage testing exposed a Mem0 OSS 1.0 behavior missed by the original fake: `delete_all(user_id=...)` resets the shared Qdrant collection after filtering. The application now enumerates owned IDs, verifies ownership again and deletes each ID individually. The fake now rejects any call to the unsafe upstream method. Qdrant client is pinned to 1.15.1 to match server 1.15.5.

- Final rebuilt container passed an actual two-user MiniLM/Qdrant round-trip: scoped search excluded the other user, cross-owner deletion was rejected, and deleting all memories for the first user preserved the second user. Test memories were cleaned up. The adapter HTTP health endpoint is reachable; Claude and Supabase remain unconfigured.

## Live credential verification follow-up

- Anthropic Sonnet 5.5 and Haiku 5.5 model access and small real text-generation calls passed. The application-level streamed chat and JSON-schema plan generation also passed with fictional input.
- The first real Mem0 extraction returned object-valued facts, which the local embedder cannot accept. The native Claude memory adapter now constrains extraction to a `facts` array of strings and action planning to the expected `memory` schema using `output_config.format`; local checks reject invalid shapes before embedding. Ten Python tests pass, including both new schema regression cases.
- The rebuilt/restarted memory service passed a real Claude extraction → local embedding → Qdrant save → retrieval flow. Fictional test records were deleted afterward. No full account/worker lifecycle claim is made by this isolated service test.
- Supabase Auth health and the server secret key were verified. At this check, `records` and `knowledge_items` returned PGRST205 (tables absent from the exposed schema). The initialization SQL still needs execution in the project SQL Editor before testing login/storage/RLS. No real user records were created or modified. Demo mode remains enabled pending database initialization.

## Database initialization and full live flow

- After the supplied SQL was executed, both application tables became accessible. `npm run test:rls` passed with two disposable accounts: direct authenticated cross-user access/mutation denial, parent ownership, shared-knowledge write rejection, and account revocation. Its test identities were removed.
- Demo mode was disabled in the ignored local environment file. The Next development server was restarted on localhost:3000 and the internal memory worker started.
- An additional disposable account passed the real application HTTP endpoints: password login, persistent onboarding, Claude streaming, saved conversation reload, structured plan generation and database save, worker extraction, memory provenance and application retrieval.
- The disposable account's memory permission was disabled and its remote memories and Auth account were deleted; application rows cascaded. No user credentials or raw provider errors were printed.
- Current local state: Supabase and Claude are connected; Qdrant, the Mem0 service, Next development server and worker are running. Public deployment, browser visual testing, and actual signup/reset email delivery have not been verified. The disposable account was created already confirmed, without sending email.

## Email callback redirect fix

The user received and confirmed a signup email; the sole registered account was confirmed. Next development callback redirects used the bind-address request origin (`0.0.0.0:3000`). Both callback branches now use configured APP_ORIGIN, preserving the fixed allowed destinations. Typecheck/lint and a live HTTP callback redirect check passed. The login page remains reachable on localhost:3000.

### Registration recovery follow-up (2026-10-25)

Updated registration to support email verification codes. `/api/auth/verify` accepts only a validated email and numeric code and verifies specifically the signup OTP with Supabase. It requires a returned session and confirmed email before succeeding. The verification screen supports code autofill/paste, resend with a 60-second UI cooldown, and a full navigation after success so the app reads the new session cookies. Password recovery retains its existing link flow. The ready-to-paste hosted Confirm sign up template is `supabase/templates/confirmation.html`; it displays `{{ .Token }}` and contains no authentication link.

OTP validation: five auth regression tests, TypeScript and targeted ESLint pass. A disposable signup generated through the admin generate-link API (without sending an email) passed real HTTP checks for malformed/wrong codes, wrong email binding, successful code verification and session access, and replay rejection. The account and its associated data were removed. The public verification page returns 200 and renders the code input and verification button. The hosted email template still needs to be saved in the Supabase dashboard; no dashboard session or management access token is available. Actual receipt of an OTP email has not been verified.

Registration now returns whether email verification is required, based on the returned session. The UI sends authenticated users to Welcome and other users to verification, remembers the pending email in tab-scoped session storage for resend, and removes it after successful sign-in. The login page includes a resend entry point. Callback failures are shown with recovery instructions; unexpected callback exceptions redirect to a temporary-service-error message. Provider error text and authentication codes are not copied into the failure URL. Pasted email whitespace is trimmed server-side, authentication actions require POST, and mail restrictions/rate limits/unconfirmed email/provider outages have actionable error messages.

Validation: four auth regression tests, TypeScript checks, and targeted ESLint checks pass. Live local HTTP checks cover missing/invalid authorization codes, provider rejection, untrusted redirect destinations, failure-message rendering, login/signup page availability and GET rejection for signup. These checks do not send email or create accounts.

Remaining external configuration: no authenticated Supabase dashboard session or management connector is available. The public Auth settings confirm signup is enabled and email confirmation is required, but do not reveal SMTP or redirect allowlists. In Authentication > URL Configuration, set Site URL to the current APP_ORIGIN and allow APP_ORIGIN/auth/callback plus APP_ORIGIN/auth/callback?next=/reset-password. Configure custom SMTP for non-team recipients if it is not already configured. These dashboard changes and a real inbox signup/confirmation flow have not been verified; earlier temporary-tunnel notes do not establish the current dashboard configuration.

## Intermittent multi-turn chat failure follow-up

The screenshot showed an empty failed assistant reply. The original handler discarded the underlying exception, so the historical cause cannot be determined. The same second-turn text passed a direct Claude streaming check, and a disposable account passed three consecutive real app chat turns with all six records persisted; test records were removed. This application test used memory off to isolate conversation streaming.

The handler now records only a safe error category, numeric status and provider request ID, never raw provider exceptions, conversation text or credentials. Users receive category-specific messages for rate limits, connectivity, provider availability or incomplete replies. The streaming adapter retries once only for transient SSE errors before any text is emitted; HTTP retries remain with the SDK. Partial replies and cancellation are never automatically replayed. Seventeen TypeScript tests, typecheck and lint passed, including pre-text recovery, no partial-text replay and safe error classification. This improves recovery/diagnosis but does not establish the cause of the earlier incident or guarantee provider uptime.

## Conversation studio, vision and web research

- Increased typography throughout the app, with 18px desktop chat text and 17px mobile chat text. Added original detailed adult Theo/Mira and dog Mochi SVG companions, blinking/float motion with reduced-motion support, and a live companion status.
- Added server-validated context modes and persisted focus metadata. Real disposable-account tests passed context-guided chat, switching to listening, and conversation persistence.
- Added live image inputs, local resizing, media signature/size validation and private record persistence. A synthetic HELLO HAVEN image was correctly read by Claude and its image record restored via the authenticated API.
- Added native Claude public web search/fetch, progress and clickable source events. Live research returned an official NIMH source and persisted source cards; a separate explicit-URL test fetched example.com and returned its source. Public research excludes private history/memory and is not queued for extraction; tests cover history exclusion.
- Twenty TypeScript tests, typecheck, lint and a production build of the final source in an isolated temporary copy passed. Avatar artwork was rendered and inspected as a PNG. Browser automation is unavailable, so whole-page desktop/mobile visual and clipboard/drag-drop interactions still require browser inspection. Live temporary test identities and their records were removed.

## Reference-led mobile listener app

Five supplied screenshots were inspected before implementation. The primary app now uses a phone-width shell and bottom navigation; journal cards, labels and choices follow the references. Added listener customization, original cat artwork, pet roleplay prompts, descriptive reports, preset-code sharing/imports, private feedback sheets, conversation history and PWA assets. Normal writes reuse the authenticated owner's profile JSON and no database grants were broadened.

Twenty-four TypeScript tests, typecheck/lint and an isolated production build passed. Live tests with two disposable accounts passed listener save/reload, required journal fields and invalid dates, report counts, cross-user isolation, preset import and both cat/dog voice requests (including the expected Chinese animal sound and preferred address). Manifest, offline shell, icons and app routes returned successfully. The service worker is JavaScript and does not cache API/auth/private HTML. Test identities, journals and conversations were deleted. iPhone installation and full browser visual testing remain unverified because no browser automation surface is available. No public deployment was performed.

## Temporary public HTTPS demonstration

A Cloudflare Quick Tunnel now forwards to a separate production Next server on loopback port 3001, using the verified isolated build. The development server on port 3000 remains separate. The production process loads credentials from the existing ignored environment file and overrides APP_ORIGIN only in its process environment with the temporary HTTPS hostname. No credentials were copied into source/build files.

Public HTTPS checks passed login page, manifest, Apple icon, service worker and config; unauthenticated /api/mobile returned 401. A disposable account passed public password login, Secure-cookie checks, profile persistence and real Claude chat with 13 received response chunks over the tunnel. Its account and records were removed. This is a temporary demonstration endpoint, not permanent hosting; the computer, production process and tunnel must remain running. Supabase email redirect settings have not been updated for the temporary hostname; use an existing confirmed account until those URLs are configured. Tunnel state/log is in /tmp/haven-tunnel.log. Quick Tunnels have no uptime guarantee.

### Weekly and monthly tracking refinement
Added explicit Home links to `/report?period=week` and `/report?period=month`. Period selection survives refresh through the URL. Each report shows daily saved-entry counts linking back to the selected day, all-entry feeling frequencies, and behavior frequencies. Empty periods show empty states rather than sample results. TypeScript and ESLint pass; production build checked before replacing the public tunnel origin server. No real iPhone visual verification performed.

### Screenshot-aligned English home and meal form
TypeScript, ESLint, 25 unit tests and production build passed. Public HTTPS verified using a disposable confirmed account: food description and compressed photo survived save/read; skipped entry accepted; blank non-skipped description rejected; default listener address English. Test records/account removed. Public origin updated to the new production build. Native iPhone layout and file-picker behavior still require device verification.
