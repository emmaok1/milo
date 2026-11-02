# Architecture and boundaries

Next.js serves independent application URLs through the App Router: `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/onboarding`, `/home`, `/talk`, `/talk/:conversationId`, `/plan`, `/plan/new`, `/plan/checkins`, `/plan/:planId`, `/resources`, `/resources/skills`, `/resources/skills/:id`, `/resources/help`, and `/space/preferences|memories|privacy|account`. An optional catch-all server route renders the shared React shell; each URL supports direct access and refresh, and navigation uses Next Link/router.

`src/lib/store.ts` verifies sessions and account state, scopes database operations before retrieval, checks parent ownership, and implements versioned writes. Its context captures the server endpoint purpose and operation; client/model identities are ignored. `src/lib/memory.ts` is the application reference monitor for memory mode, permission version, provenance, and scope. This is logical isolation, not hardware memory protection.

Live persistent storage is PostgreSQL (Supabase). The application uses the verified JWT and RLS for ordinary records. The durable worker has separate elevated credentials because it must process work after the user disconnects; it validates owner, account status, source, and captured permission version again. This internal service access is not claimed to be RLS isolation. Application logs do not duplicate memory or conversation text.

Mem0 OSS uses Qdrant and persistent history storage. It is reachable only through the internal adapter, which checks service authentication and owner scope. The app stores Mem0 ID mappings and provenance, not a second full copy of live memory text. Withdrawals mark mappings inactive before contacting the remote service. Disabled and temporary modes exclude memory from model context. Withdrawing a source prevents extraction from that source and cancels its pending jobs. Account deletion blocks new ordinary access and queues cross-service cleanup.

The current fixed resource catalog contains only draft/unreviewed clinical examples and external official links. `retrieveKnowledge` returns published matches only; presently none qualify. A separate SQL table defines the approved publication schema and read-only access, but no published clinical content has been seeded. Future approved content must be explicitly connected to retrieval, with version/withdrawal invalidation tested, before claiming a populated professional knowledge service. The publication catalog does not automatically expand or learn from private conversations. A separate opt-in Talk web-research mode uses native Claude public search/fetch; it is not a professional-review or publication pipeline.

Plan generation returns schema-validated data. Manual changes stay a versioned draft; activation is explicit. PostgreSQL activation and future-revision acceptance use transactional RPCs. Past check-ins are separate records and are not overwritten by future task changes. Local activity dates and UTC recording timestamps are distinct.

## Remaining target-environment work

- Configure and verify real email delivery, callbacks, Claude model access, Qdrant persistence, pinned Mem0 compatibility, and remote cleanup behavior.
- Run RLS tests against an actual Supabase project, including direct authenticated SQL/REST requests, service-role worker races, and account status revocation.
- Run real browser interactions at desktop and narrow widths. No browser surface was available in this environment.
- Live automatic extraction and corrections must be tested across new conversations before accepting health data. The demo extraction is intentionally a small deterministic demonstration, clearly labeled in the UI and memory source.
- Add a deployment-level distributed rate limiter for multiple application instances. Current per-account metadata counting also covers temporary chats; authentication rate limits are provided by Supabase.
- Autosave covers generated drafts and debounced direct edits; a hard navigation/process crash during an unsaved edit can lose the most recent unsaved keystrokes. Failed saves keep the current in-memory draft and show failure.
- Local demo activation and revision acceptance use a serialized atomic file transaction; production RPCs provide the PostgreSQL transaction boundary.
- No public deployment, messaging, third-party booking, or sharing is performed.

## Claude integration

Chat streams native Anthropic Messages text deltas through the existing NDJSON endpoint; non-completed streams are saved as failed/stopped. Plans use native JSON-schema output plus local Zod validation. Sonnet is the default for both. Haiku performs Mem0 extraction through a small native adapter registered with the pinned Mem0 factory; it excludes legacy sampling parameters and checks completion and JSON. Embeddings run locally on CPU using MiniLM (384 dimensions) in a new Qdrant collection, leaving old collections untouched. The public privacy page identifies Anthropic rather than OpenAI.

The memory adapter does not call Mem0 1.0 `delete_all`: that upstream implementation resets the shared vector collection. Account cleanup enumerates, verifies and deletes only owned IDs before purging owned history.

## Context, vision and public research

`chat-context.ts` defines allowlisted conversation spaces and the server prompt for each; clients send only a context ID, never a privileged prompt. Adaptive reply style removes fixed sentence limits. `chat-images.ts` validates media payload signatures and limits and constructs native image blocks; web-mode message construction excludes history. Public research also excludes private memory and preference context, and its message is excluded from extraction.

Image attachments and public source links are held in the existing owner-scoped message JSON. No new public storage bucket or database grant is introduced. Images are included in account exports/cascading record deletion. Only recent image context is replayed. Native web tools emit progress and source events alongside the existing text deltas; rendered Markdown excludes raw HTML. Public research does not expose tools for login, messaging or modifying external sites.
