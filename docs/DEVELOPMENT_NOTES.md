> Historical development notes retained from the previous README. Some interface descriptions and experimental features below have since changed; see the root README and current source for the submission overview.

# Haven — Cal Hacks 13.0

Haven is a replaceable working product name for a support prototype for adults (18+) experiencing binge-eating or self-induced vomiting difficulties. All application text, demo records, and developer documentation are English. The AI companion is not a clinician and the application does not diagnose, provide treatment, or promise recovery.

## Run locally

Requires Node.js 22+ and npm. Dependencies are pinned in `package.json` and `package-lock.json`.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000 and choose **Try the fictional demo**. The delivered checkout includes a local `.env.local` containing only `DEMO_ENABLED=true`, `APP_ORIGIN=http://localhost:3000`, and disabled Next telemetry; it has no credentials and is ignored by Git. Do not enter personal or health information in this demo. If accessing from a different origin, change APP_ORIGIN to that exact origin before using forms.

```bash
npm run typecheck
npm run lint
npm test
npm run build
# With a running local demo server:
npm run test:http
```

The Webpack build is intentional: this execution environment rejects Turbopack's internal port binding. The application otherwise uses the Next.js App Router, TypeScript, Tailwind CSS v4, React, and Lucide icons.

## Configure live mode

Put credentials in `.env.local` or your deployment's secret manager, never in chat, source control, browser code, or URLs. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public project values; all other service credentials are server-only.

The existing variable names also accept modern Supabase keys: put the `sb_publishable_` value in `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the server-only `sb_secret_` value in `SUPABASE_SERVICE_ROLE_KEY`. These are application variable names, not instructions to use deprecated key types.

1. Create a Supabase project with email/password Auth. Keep email confirmation enabled. The default Supabase mail service delivers only to project-team addresses and has strict limits; configure custom SMTP before inviting other testers. Apply `supabase/migrations/001_haven.sql` with your SQL administration workflow. Its owner policies apply to all private record kinds, with composite ownership foreign keys, parent-kind validation, unique deduplication indexes, and version checks.
2. Registration uses an emailed verification code: in Supabase Authentication > Email Templates > Confirm sign up, set the subject to `Your Milo verification code` and paste `supabase/templates/confirmation.html` as the body. The `{{ .Token }}` placeholder is required; changing application code alone does not update hosted email templates. Users enter the code on `/verify-email`; the server verifies it with Supabase and creates the authenticated session. Set Supabase Site URL to APP_ORIGIN. Keep `APP_ORIGIN/auth/callback` and `APP_ORIGIN/auth/callback?next=/reset-password` in the allowed redirect URLs for older confirmation emails and password recovery. The callback accepts only the hard-coded reset destination; other successful callbacks resolve to Welcome.
3. Set server-side `ANTHROPIC_API_KEY`, `ANTHROPIC_CHAT_MODEL`, `ANTHROPIC_PLAN_MODEL`, and `ANTHROPIC_MEMORY_MODEL`. Chat and plans default to `claude-sonnet-5-5`; background extraction defaults to `claude-haiku-5-5`. Run `npm run verify:services` for model access and service health. Run `npm run verify:services -- --smoke` for small billed text-generation checks; compilation and model lookup do not verify generation. See `docs/CLAUDE_SETUP.md` for local setup.
4. Configure the internal Mem0 service below, `MEMORY_SERVICE_URL`, and a long random `MEMORY_SERVICE_TOKEN` shared only between the Next server, worker, and internal Python service.
5. Set `DEMO_ENABLED=false` for a deployment intended to accept real users. Use HTTPS, secure secret storage, appropriate Supabase backup/encryption configuration, and trusted reverse proxy settings. No end-to-end encryption claim is made.
6. Run the internal worker as a separate supervised process. Its Supabase service-role key must never be supplied to web clients or ordinary application requests.

A missing or failing live integration returns an error. It does not silently switch to fictional responses or simulated saves. Live mode has not been verified without project credentials.

## Mem0 OSS service and persistence

`services/memory/app.py` wraps the **OSS Python library**, not the hosted Mem0 Platform. `compose.yaml` starts private Qdrant persistence and a loopback-only internal adapter. Only the adapter's service-token endpoint is exposed on `127.0.0.1:8001`; Qdrant has no host port. For remote deployments use an isolated network and encrypted service transport.

```bash
docker compose up --build -d
npm run worker
```

Qdrant data lives in `qdrant_data`; Mem0 history lives in `memory_history`. Neither volume should be committed or reused as public seed data. Back up and encrypt volumes according to your hosting provider's process. The adapter checks the service credential and UUID scope on every operation and fetches ownership before ID-targeted update/delete. Application memory links further restrict which remote results are eligible for model input. Application RLS is **not** claimed to apply to Qdrant or Mem0's SQLite history.

The durable PostgreSQL job records have deduplication, a claim version, a lease timestamp, bounded retries, and execution-time checks for account state, memory mode, permission version, source ownership, and source exclusions. Failed jobs remain visible to an operator through the database. The worker rechecks consent after extraction and removes results if permission changed mid-call. The single internal worker is the supported deployment configuration. A worker crash during a remote write can leave an unmapped remote memory; unmapped results are excluded from retrieval and account cleanup removes them. Exactly-once remote writes are not promised.

The pinned Mem0 adapter and Docker services still require live compatibility and persistence verification in the target environment. Do not run the application with real health information before completing those checks. Chat, plans, and memory extraction use the native Anthropic Messages API and follow Anthropic retention policies; no zero-retention guarantee is made. Memory embeddings use the local CPU model `sentence-transformers/all-MiniLM-L6-v2`, downloaded when building the image, with no embedding API key. The Claude adapter avoids legacy sampling parameters and rejects incomplete or invalid memory output. Local embeddings use the separate 384-dimensional `haven_private_minilm_v1` collection; existing OpenAI vectors are not reused or deleted. Migrating an existing memory store requires a separate re-embedding plan. Automatic extraction considers only user messages, never assistant replies. Temporary state is not extracted by default; only explicit continuing preferences and important experiences are candidates.

## Data and authorization

The `records` table is a typed private record collection; `kind` discriminates profiles/preferences, conversations/messages, plans, tasks, revisions, check-ins, favorites, memory provenance, access metadata, processing jobs, and deletion jobs. It avoids duplicating the full Mem0 text in live application storage. `knowledge_items` is a separate read-only publication table with source, allowed use, review status, and version metadata. No user or chat write policy exists for it.

Ordinary requests use the Supabase anonymous project key plus the verified user's session. `auth.getUser()` verifies identity; the server does not trust client `userId`, purpose, or owner claims. A stable Supabase UUID survives email changes. Account status is checked before application access; deleted accounts cannot use private-record RLS. Every parent reference is checked both in the API and database. A job worker uses an internal administrative credential solely to execute checked job and deletion operations.

Account deletion creates a cleanup job and marks the profile deleted, blocking new access. The worker removes remote memories, then the Supabase Auth account; application rows cascade. Provider outages leave a tracked pending/manual-review state. Backup copies, already-transmitted requests, and provider-side retention are not erased by the UI. Demo accounts are independently blocked and need local cleanup; `npm run cleanup:demo` removes expired fictional files only.

Demo records live in server-side `data/<random-session-id>.json` files with restrictive file permissions and atomic rename, not localStorage. A random HttpOnly cookie identifies a demo space. Demo files are local test storage, not a substitute for Supabase identity or RLS. Local file mutations are serialized within the single Next process. Multi-process demo deployments are unsupported.

## Knowledge and resources

The fixed resource catalog links to NIMH and Beat and includes original non-clinical examples. Professional review has not been obtained. All clinical/skill examples stay unpublished and are excluded from the AI's professional knowledge retrieval. This intentionally returns no professional passages rather than inventing guidance or review approval. The UI clearly displays source, applicability, limitations, review status, and date. Source access was checked on October 24, 2026; organization availability was not verified. No individual therapist records are fabricated. The local resource search is keyword matching, not semantic search.

Publishing clinical content requires a separate reviewed SQL administration change to `knowledge_items`; ordinary users have no write permission. Talk includes opt-in public web research using Claude web search and web fetch, with clickable source cards. Web research sends only the current message, excludes private history and memories, and does not schedule memory extraction. It does not publish or learn shared content from private conversations. See `docs/ARCHITECTURE.md` for the publication boundary and remaining integration limits.

## Three-minute fictional demonstration

1. **0:00–0:30:** Choose Try the fictional demo. Use nickname Alex, pick Listen first, and select an AI companion. Land on Home, which has no feature sidebar.
2. **0:30–1:00:** Open Talk. Send “I prefer short replies.” The banner identifies scripted sample replies. Open a new conversation; Memory shows the explicit fictional preference without a per-item approval dialog. No plan is created by saying “I don’t want a plan.”
3. **1:00–1:45:** Select Make a plan. Describe a small quiet moment, choose dates and seven days, generate the fictional draft, edit it, save, and choose Start this plan.
4. **1:45–2:15:** Open a day. Mark Tried, choose Helpful independently, add a custom tag, record optional feelings, and replace/edit/hide the daily note. Save and reload to verify persistence.
5. **2:15–2:40:** Select Make it smaller. Inspect the future-only diff; accept it. Past check-ins remain. No time jump is implied; if choosing another date for presentation, label it a simulated activity date.
6. **2:40–3:00:** Correct or delete a fictional memory, switch memory mode, inspect privacy controls, and download your own export. No external messages or appointments are sent.

## Implemented / demo / unconfigured

- Implemented: independent routes, responsive layouts, onboarding and preferences, real Supabase auth endpoints, server-streamed chat adapter, structured plan schema, explicit activation, task edits/copies/rescheduling/deletion, optional reflections, multiple tags, supportive-note control, versioned saves, future-only revision previews, resource favorites, memory controls, export, queued deletion, migration, worker, and tests.
- Demo only: scripted conversational responses, example plan generation, and clearly labeled rule-based extraction of explicitly stated fictional preferences. Demo behavior never masquerades as a real Claude or Mem0 response.
- Latest local integration status: Supabase schema, authenticated RLS isolation, application password login, Claude streaming with saved chat history, structured plan generation/save, and worker-backed memory extraction/retrieval passed fictional-input tests with disposable accounts. Local demo mode is disabled and the app/worker/memory services are running. Signup/reset email delivery, browser visual testing, full deletion/revision lifecycle against live providers, and production deployment remain unverified. No public deployment was requested by the prompt documents, so none was performed.
- Limits: no browser was available to the supplied UI automation tool, so desktop/narrow-screen visual QA and browser-driven end-to-end interactions remain unverified. HTTP tests do not replace those checks. Reflection permissions are stored separately, but reflection AI review/extraction is intentionally not scheduled. Clinical shared knowledge is not published without professional review. See `docs/VERIFICATION.md` for exact checks and limits.

## Attribution

All plant, book, note, conversation, adult avatar, and dog illustrations are original SVGs authored for this project; they are not copied from Limbic. Limbic was consulted only for high-level organization. No Vercel Chatbot code was reused. Lucide icons use the ISC license. Next.js, React, Tailwind, Supabase SDKs, Anthropic SDK, Zod, and Mem0 retain their upstream licenses. No proprietary coping-skills library or licensed clinician likeness is included.

## Conversation studio update

Talk now has larger typography, original animated Theo/Mira/Mochi companions, selectable conversation spaces (after eating, self-kindness, listening, open), adaptive-length replies and Markdown formatting. Context changes apply server-owned prompts without fine-tuning and persist with conversation/message records. The appearance is an AI persona, not a clinician.

Signed-in live accounts can attach, paste or drop up to two JPEG/PNG/WebP images. The browser resizes them to a maximum side of 1280 pixels and encodes JPEG; the API checks size and magic bytes (1.5 MB per image). Images are stored in private message JSON with the conversation, included in export and removed with those records; temporary chats do not save them. Image contents are not automatically extracted to memory. Only the last four history records can carry image blocks into a follow-up; older images need reattachment for detailed reinspection.

Public web mode enables Claude's native search/fetch tools, with at most two calls of each kind per request and source/activity events streamed to the UI. Public research and image discussion are separate request modes. Web search has additional Anthropic charges. These tools read public pages and do not log into third-party accounts, publish, send messages or operate arbitrary websites. Claude consumer-app features are not automatically inherited by the API.

## Mobile listener app

The primary signed-in experience is now a reference-led mobile app: Home, Report, Chat, Friends and Settings. `/listener` customizes a black or white cat using a name, communication language and personality tags; the model uses these settings on subsequent private chat turns. `/record` saves structured private meal moments and `/report` shows descriptive counts from the owner's actual entries. Friends exchanges listener presets, not account access or private records. Settings feedback is stored privately and is not sent or published.

The PWA manifest, Apple home-screen icons, safe-area/keyboard styles and privacy-preserving offline fallback are implemented. HTTPS hosting and corresponding APP_ORIGIN/Supabase callback configuration are still needed for actual iPhone use; no deployment has been performed. See `docs/MOBILE_APP.md` for features, limits and verification.

The mobile interface self-hosts the Nunito variable font from the Google Fonts project. Its SIL Open Font License and copyright notice are retained in `public/fonts/OFL.txt`.

## Voice calls

Chat stays a text chat; **Voice call** sits beside the image and public-web controls. `/call` uses the saved cat, communication language and fixed character voice; personalization owns these settings. Browser dictation is replaced with persistent microphone capture and a local faster-whisper process (`npm run speech`) to avoid repeated dictation start/stop cues. Calls retain captions, mute, interruption, hangup and post-call Memory. Device audio acceptance is still required. See `docs/VOICE_CALL.md`.

## Companion personalization

`/listener/personalize` presents cat selection, companion name, communication language and communication-style tags (one to four), in that order. Black cats use a male voice; white cats with pink details use a female voice. Onboarding continues there after character selection; Settings links directly to it. The `personalize-listener` action preserves address and existing private data. Selected styles have server-owned descriptions added to every chat/call prompt. `npm run verify:personalization` checks persistence/isolation with disposable accounts; `-- --smoke` adds a small billed Claude check that the saved display name reaches the next reply.

## Login welcome

Successful password login and email authentication lead to `/welcome` after onboarding/personalization. Four uncluttered screens show the saved cat greeting, then the three fixed English questions with single-choice labels, Continue and Skip. The three question screens show a larger animated cat inside each original SVG scene without a separate top avatar. Report, Chat and Friends use the saved cat as their top-right privacy-help button. Cartesia reads each screen in the saved communication language, with a device-speech fallback and a replay button when playback is blocked. Navigation aborts outstanding synthesis and stops playback. The latest private check-in is validated and saved with a server timestamp; skipped answers remain unknown, context expires after 24 hours, and this action never queues long-term Memory or contacts anyone. Ordinary navigation to Home does not restart the flow.

English voice calls now support feature-flagged static replies and progressive Cartesia PCM playback. Only unambiguous, context-compatible turns with decoded audio take the static path. Start with `npm run prepare:voice -- --dry-run --ids=021,047,090 --voices=black_cat,white_cat`; see [Voice calls](VOICE_CALL.md#english-quick-responses-and-progressive-playback) for flags, enabled IDs, cache preparation, measurements and limitations.

Report now uses compact weekly/monthly SVG feeling trends, after-eating reaction bars and saved-time scatter plots. Short suggestions follow explicit recorded tags; missing data stays unknown, urges stay separate from actions, and private notes/photos are not sent to a model. See [mobile reports](MOBILE_APP.md#compact-report-charts).
