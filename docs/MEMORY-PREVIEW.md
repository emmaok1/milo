# Settings memory demo

Settings now offers two entries: blue lock / Private Memory and yellow people / Public Memory. Both open a centered native dialog. The UI shows the authenticated account ID and explicitly labeled fictional demo samples.

`/api/memory-preview` requires a verified account session, rejects guest demo sessions and query parameters, and accepts only strict access/sharing actions. The owner always comes from the authenticated server context, never a request-provided ID. Responses are private/no-store. Demo control state is saved to that owner's profile under `memoryPreview`, using the existing owner-scoped storage gateway and RLS. No service-role client or public memory reader is used.

These are presentation controls: they do not grant AI access to real personal memories, publish to a group, or change existing memory-mode permissions. The demo badge must remain visible. The Public Memory sample and sharing label are fictional, not evidence of an actual share.

Validation: focused lint, typecheck, account-isolation/schema tests, anonymous HTTP 401, and mocked-API Firefox checks for toggle/revocation persistence and centered 320/390/768px layouts.

## Revised entry and personal key
Settings has its original Memory and Privacy rows. `/space/memories` now renders the two-entry hub rather than the old verbose memory page. Public Memory has three illustrated categories: Shared Experiences, Professional Advice, Helpful Resources. Advice/resources are explicitly unconnected demo layouts.

Private entry first locks any existing preview unlock, then asks for a personal key (first use sets and confirms an 8–128 character key). Key verification uses per-account salted scrypt hashes in an owner-scoped access-event record; the plaintext key is never saved. Unlock credentials are random, hashed server-side, expire in ten minutes, and use an HttpOnly, SameSite Strict cookie restricted to `/api/memory-preview`. Private sample text is omitted from locked API responses, and changing private demo access also requires unlock. Five failed key attempts trigger a one-minute cooldown. Close revokes the unlock; leaving the page sends a best-effort lock request, with server expiry as fallback. The key cannot currently be recovered/reset through this demo UI.

This key protects the preview feature, not the app's separate real-memory API or an encrypted operating-system vault. Permission/sharing buttons remain isolated demonstration state. Tested key account isolation, wrong-key denial, hash persistence, relock, and rate limiting, plus mocked-API browser entry/setup/unlock flow.
