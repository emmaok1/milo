# Voice calls

**Current behavior:** prerecorded conversational responses are retired. The 100-line pool is in `archive/voice-responses/library.ts`; generated reply WAVs/manifests are in the ignored `archive/voice-responses/audio/` folder. The server hard-disables quick replies even for stale clients or old environment flags. All ordinary and sensitive turns use contextual Claude → Cartesia, with existing safety instructions. The older static-library sections below describe the previous implementation only. Welcome-home audio remains separate and unchanged.

## Current interface

Chat is a text chat. The composer places **Voice call** beside **Add an image** and **Public web**. There is no voice banner, photo-avatar panel, or automatic speech playback in Chat.

The call page uses the cat and communication language saved in personalization (English by default, with ten available languages). Language selection lives in personalization. There is no character picker, voice picker, voice-engine selector, automatic-listening toggle, temporary-call toggle, debug timing panel or decorative placeholder sentence on this page. Memory behavior follows the account's existing settings.

The call shows the saved original SVG character, concise listening/thinking/speaking status, captions when text is available, and Mute/Speak, Interrupt and End call controls. Transcript and Memory management appear after hanging up. The character prompts live in `src/lib/characters.ts` and apply to every text/voice response.

## Microphone and transcription

The call no longer uses browser `SpeechRecognition` / dictation. English can use realtime Ink-2 as described below. When realtime recognition is disabled or unavailable, `SilentMicrophone` obtains one `getUserMedia` stream for the entire call and keeps it until hangup/navigation. A muted Web Audio analyser detects speech and a roughly 750 ms pause. MediaRecorder packages each turn, bounded to about 30 seconds. Quiet buffers are renewed without reacquiring the microphone or uploading silence. Recording is paused during generation/playback, so the assistant does not transcribe its own speaker output.

The app generates no microphone-start/stop tones. Avoiding the dictation API removes the previous per-turn dictation invocation, but browser/OS permission indicators and any OS-level initial microphone cue remain outside the page's control. Actual iPhone audio acceptance is still required. This is turn-based conversation with explicit button interruption, not full-duplex acoustic barge-in.

`POST /api/voice/transcribe?language=en-US` checks account status and origin, bounds binary upload size, checks media signatures and enforces a per-account rate limit. It proxies audio to an authenticated loopback-only service. The service uses faster-whisper base, CPU int8, with built-in speech filtering. Audio is decoded in memory and is not persisted or logged. Transcription alone does not save a conversation or queue Memory; only confirmed text subsequently submitted to `/api/chat` does so.

English live recognition now shows interim captions; only confirmed final turn events enter conversation. Final user text and the assistant's current spoken phrase are captioned. Browser microphone support, endpoint detection in a noisy room, local CPU load, recognition accuracy and speaker playback still need device testing. No sub-second latency guarantee is made.

## Fixed character voices

The saved character fixes the voice. When configured, Cartesia uses these official audition candidates:

| Character | Voice |
| --- | --- |
| Black cat | Ronald (American male voice) |
| White cat with pink details | Celine (gentle female voice) |

Without a Cartesia key the app deterministically selects an available device voice for the character and language, then holds that voice for the call. No user voice selection is exposed. Device catalogs differ, so identical sound across phones is not promised. The Cartesia adapter uses `/tts/bytes`; optional progressive PCM playback and one-phrase lookahead reduce waiting without changing the provider. Its replies are sent to Cartesia when enabled, and provider retention is separate from app storage.

Cartoon mouth movement indicates speech, not exact phoneme timing. Reduced-motion preferences are respected.

## Run locally

Use Node.js 22+ and Python 3.9+:

```bash
python3 -m pip install -r services/speech/requirements.txt
npm run dev
# Separate terminal: local speech process, keep running throughout the demo
npm run speech
# Separate terminal: existing Memory services
docker compose up -d
npm run worker
```

The first speech startup downloads public base model weights to `~/.cache/haven-speech`; later launches reuse them. The service binds only `127.0.0.1:8002`. Its bearer token is derived from the existing internal memory token unless a separate `VOICE_STT_TOKEN` is set. `VOICE_PYTHON`, `VOICE_STT_MODEL` and `VOICE_STT_URL` are optional deployment overrides. The page requires either enabled English realtime recognition or a ready local service before allowing a call. There is no silent fallback to browser dictation.

Keep Next, speech, Memory worker and the Cloudflare tunnel running for phone use. HTTPS or localhost is required for microphone access. A hosted deployment must host the speech process as well; it cannot depend on this laptop after migration.

## Memory and privacy

Normal calls use existing private conversation/message storage. Temporary Memory mode sends bounded local conversation history without saving app transcript/messages or extraction jobs. Off mode saves history but does not extract Memory. Existing account/origin checks, per-source exclusions and execution-time consent checks remain in force. Confirmed user turns queue extraction alongside reply generation; cancellation does not discard an eligible confirmed message.

The post-call Memory endpoint checks conversation ownership and filters memory mappings by user-message provenance. It returns pending/failed processing counts and supports correction/deletion with provenance retained. A genuinely empty extraction is shown explicitly. Aborting before save acknowledgement is not presented as proof that the server saved nothing.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run build
# Public/synthetic WebM fixture only; no provider calls
SPEECH_TEST_AUDIO=/path/to/public-test.webm npm run verify:speech
# Small billed fictional-input Claude/Memory checks
npm run verify:voice -- --live
```

Tests cover voice activity segmentation, rejecting non-audio, one microphone acquisition across multiple turns, track release on hangup, role prompts/switching, and existing chat/Memory permissions. HTTP tests cannot verify physical iPhone audio or audible OS cues. Cartesia generation/PCM and browser Web Audio scheduling have been tested separately; physical iPhone playback still requires device acceptance.

References: [faster-whisper](https://github.com/SYSTRAN/faster-whisper), [MediaStream recording](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API/Using_the_MediaStream_Recording_API), [Cartesia voices](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest).

## English quick responses and progressive playback

Two independent server-side flags preserve the original path:

```dotenv
VOICE_QUICK_RESPONSES=true
VOICE_STREAM_AUDIO=true
# Optional durable server volume; default is .voice-cache in the project root
# VOICE_RESPONSE_CACHE_DIR=/your/persistent/voice-cache
```

Set either flag to `false` and restart Next to disable that feature. The current local demo has both enabled. No new provider keys are required beyond the existing Cartesia and Claude keys. Keys stay on the server. Other languages retain the existing contextual conversation path.

`src/lib/quick-responses/library.ts` preserves all 100 supplied English lines and IDs. Exactly five entries have automatic rules: **016, 047, 049, 050, 090** (quiet company, no advice, skip a preceding question, pause/finish, no more questions). The other 95 are retained but disabled for automatic selection. Emotional turns, including guilt and feeling better, now stay with Claude so the answer can reflect the actual conversation. Enabled rules still need compatible context and ready audio; they do not guarantee a quick response.

For this development run, only **016, 047 and 090** have been generated for each cat (six files total). Thus only those three can currently play prerecorded audio. The rest fall through until explicitly prepared. Files live in the ignored `.voice-cache` directory, not in public or private user-message storage. `manifest.json` records actual voice IDs, response IDs, content/text/settings hashes, format, file checksums and size. `library-index.json` indexes real available assets by voice ID and content version; absent assets have no fictional file reference. Changing configured voices, text, model/settings, API version or audio format invalidates the corresponding key.

```bash
# Inspect required assets without provider calls
npm run prepare:voice -- --dry-run --ids=016,047,090 --voices=black_cat,white_cat
# Generate only selected IDs/voices, with bounded concurrency
npm run prepare:voice -- --ids=016,047,090 --voices=black_cat --concurrency=2
# Resume is the default: validated files are reused. --resume is also accepted.
npm run prepare:voice -- --resume --ids=016,047,090 --voices=white_cat
# Explicitly request the full content pool only when intended (billed)
# npm run prepare:voice -- --ids=all --voices=black_cat
```

Preparation validates the library, retries at most three times, checkpoints progress atomically and uses a process lock. It never replaces a valid working file. After a crash, remove `.prepare.lock` only after checking that no preparation process remains. Use a persistent writable cache volume for deployment; live calls never generate missing library assets.

### Routing and history

Each captured final turn receives one UUID. There are no interim-transcript triggers. `/api/chat` authenticates and checks account/conversation ownership, reserves that UUID with a user-scoped deterministic record ID, then applies a conservative sensitive-context bypass before static matching. The existing safety instructions live in Claude's prompt; the bypass gate is **not** a complete independent safety classifier. Acute symptoms, self-harm, purging/compensation, medical guidance and ambiguous contexts go through the existing contextual path. No emergency numbers or medical guidance were added.

`router.ts` requires full-utterance patterns plus phrase combinations. Quotes, third-party statements, past/hypothetical experiences, mixed requests, conflicting matches, recent replies, repeated questions and communication boundaries suppress matching. Context includes conversation history, explicit no-advice/no-question/quiet/topic preferences and recent response IDs. Temporary calls retain only control metadata/preferences and selected library IDs on the server, not transcript text. Preferences are carried forward to Claude as well as the router. Entry 090 waits for the user without asking again; entry 100 requires explicit current improvement. No action hangs up automatically and silence never triggers another question.

Only assets both validated on the server and already decoded in the browser can be selected. A small priority set loads in the background after Start call; missing or undecodable audio causes immediate contextual fallback. Other available assets can warm lazily after a miss. A pre-start playback failure may resume the same saved turn once with `resumeQuick`; after playback starts, that transition is rejected. A started reply is never automatically spoken again through Claude.

Quick replies are saved as normal assistant messages before selection is sent to the client. Playback acknowledgements use the same authenticated owner scope. Pending/started/interrupted replies are explicitly identified when constructing Claude's next context; generation completion is not claimed as proof the user heard everything. Interrupted text retains `intendedText` and playback state separately. Confirmed user messages use the existing asynchronous Memory queue, respecting temporary/off/manual modes and exclusions. Static audio contains only approved fixed text and can be reused across users; personal recordings and Claude replies never enter this shared cache.

### Streaming and cancellation

With `VOICE_STREAM_AUDIO`, the existing Cartesia `/tts/bytes` call requests raw signed 16-bit little-endian PCM at 24 kHz. The server proxies the response body without collecting it. `VoiceAudioPlayer` frames arbitrary byte splits, buffers a small amount and schedules audio with Web Audio while later bytes are still arriving. It also prefetches at most one upcoming live phrase while the current phrase plays, reducing sentence gaps without mixing outputs. This stays within the existing HTTP integration; it does not require a second agent framework or a WebSocket server. See the official [Cartesia Bytes streaming endpoint](https://docs.cartesia.ai/api-reference/tts/bytes).

The same player schedules decoded static audio. Epoch checks, UUID deduplication and abort controllers fence stale turns. Interrupt, hangup and navigation cancel current and prefetched synthesis, scheduled sources, transcription and asset downloads. Teardown closes the audio context and releases cached buffers. The original WAV/HTML audio and device-voice paths remain available with streaming disabled or when Cartesia is unavailable.

### Measurements and checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run benchmark:voice-router
# Disposable accounts; real auth/storage, no Claude/TTS generation
npm run verify:quick-voice
# Adds small billed Claude fallback and live Cartesia PCM checks
npm run verify:quick-voice -- --smoke
# Synthetic public input and live providers; do not use personal recordings
npm run measure:voice
npm run measure:voice -- --after
```

Baseline measurements are in `artifacts/voice-latency-before.json`; the optimized run is in `artifacts/voice-latency-after.json`. These are small local HTTP samples, not microphone-to-ear or iPhone guarantees. Recognition time varies with CPU load and was not changed. The 750 ms end-of-turn pause was deliberately preserved to avoid cutting off users; two synthetic samples do not justify more aggressive endpointing.

The local 50,000-route benchmark covers representative utterances for all 100 entries and records p50/p95 in `artifacts/voice-router-benchmark.json`; it excludes recognition, authentication, I/O and playback. Browser diagnostics in `window.__havenVoiceMetrics` separately capture speech end/detection, final transcript, router duration, asset readiness, playback request and audio-clock start, selected path/intent/ID, hit/miss reason and interruption. This bounded local buffer contains no transcript or user identity; production does not log raw sensitive utterances.

`artifacts/voice-browser-checks.json` describes a real React call-flow check with a synthetic microphone and mocked transcription/chat/network. It verifies actual Web Audio scheduling, interruption, stale-response suppression, streaming before network completion and hangup, but its timings must not be presented as live provider latency. `artifacts/voice-provider-validation.txt` records the separate real Claude and Cartesia PCM smoke checks. Physical iPhone speaker output, noisy-room recognition and acoustic barge-in remain unverified.


## Realtime English input and calmer delivery

`VOICE_REALTIME_STT=true` enables Cartesia Ink-2 for English calls. `RealtimeMicrophone` in `src/lib/realtime-stt.ts` sends 100 ms PCM frames from `public/audio/pcm-capture.js`. The authenticated, origin-checked, rate-limited `/api/voice/realtime-session` endpoint issues a 15-minute STT-only grant; the main API key stays on the server. Browser-visible scoped grants are never persisted or logged. Audio is transmitted to Cartesia; provider retention is separate from app storage. No browser dictation API is used.

The gate ignores eager endings, accepts only `turn.end` after `turn.start`, assigns a new turn ID, and suppresses duplicates. Recording pauses during assistant generation/playback. Cancellation fences old sockets and closes resources on hangup. Connection/setup failures switch to local Whisper and ask the user to repeat; other languages use the existing local path. This remains explicit-button interruption, not acoustic full duplex. Disable the flag and restart to restore local recognition for English.

Joseph and Celine are fixed per cat with speed 0.94 and volume 0.92. Canonical voice environment variables override legacy MAN/WOMAN variables. The prompt favors short, calm, specific replies without a follow-up question every turn. Static assets are regenerated with actual new voice/settings hashes. Initial page text stays `Welcome home.`; speech is `Welcome home. Meow.` in English. Prepare both fixed welcome clips with:

```bash
node --import tsx scripts/prepare-welcome.ts --dry-run
node --import tsx scripts/prepare-welcome.ts
```

Only the exact public welcome line is eligible for that cache; private Claude responses are never shared globally. Missing welcome audio falls back to live synthesis.

Official references used: https://docs.cartesia.ai/api-reference/stt/turns/websocket and https://docs.cartesia.ai/api-reference/access-token/create-access-token . The real scoped-grant and Ink-2 websocket requests were verified, along with actual authenticated Claude fallback and Cartesia PCM synthesis.

Latency artifacts: `voice-refresh-before.json` (local batch baseline), `voice-refresh-after.json` (authenticated realtime recognition plus separate quick/contextual HTTP samples), `voice-realtime-probe.json` (provider probe), `voice-realtime-browser-checks.json` (real React/AudioWorklet/audio scheduling with mocked websocket and chat), and `voice-router-benchmark.json`. Browser mock timings are not live provider performance. Run `npm run measure:voice -- --after --realtime` for the new synthetic provider benchmark. Only the first response uses its recognized synthetic phrase; the second contextual sample reuses the recognition timing and has a scripted input. No physical phone speech-to-ear latency is claimed.


## Recognition and conversational follow-up

`src/lib/voice-context.ts` now owns the existing safety bypass and persistent communication preferences without importing the archived matching registry. Runtime chat does not call the old intent matcher. Archived history/interruption metadata remains readable. `VOICE_QUICK_RESPONSES` is deprecated and cannot reactivate live routing.

English continues using stable Ink-2. Per the official turn detection API, the current semantic thresholds are start 0.75, eager 0.55, final 0.30, with a 3200ms maximum for uncertain pauses. The maximum is not a fixed delay: linguistically complete turns may finalize sooner. This replaces the previous forced 1600ms maximum to give hesitant speech more room, while still accepting only confirmed final events. Microphone input requests mono echo cancellation/noise suppression/gain control. Reconnection buffers up to eight seconds rather than silently dropping everything after two; overflow or severe socket backpressure produces a repeat/fallback request, never a guessed partial utterance. Pause and restart reset partial capture frames to keep old samples out of the next turn.

The live prompt handles minor recognition mistakes through context, asks a short clarification for ambiguous meaning, avoids repeating an already answered question, and lets an acknowledgment stand without automatic advice or another question. These are behavior instructions, not guarantees of recognition accuracy or clinical validation.

Run `npm run verify:voice-natural` for disposable-account live checks (requires existing synthetic `/tmp/haven-latency-input.wav`, server credentials and running app). `artifacts/voice-natural-checks.json` records actual provider checks without raw sensitive content. The small synthetic samples finalized about 854–897ms after the last audio packet; this is not measured phone speech-to-ear latency. `voice-natural-browser-checks.json` covers real capture/playback with mocked websocket and chat for lifecycle assertions. The historical quick-response verification script is retained only as an archive-era harness; use the new natural-voice verifier for the current flow.

`artifacts/voice-natural-latency.json` records two real contextual HTTP/TTS samples: recognition finalized 854ms after the last speech packet, with first response audio bytes 2095–2413ms after final transcript submission. The second sample reuses the recognition timing for a scripted contextual input. These exclude physical phone playback and are not recognition accuracy guarantees.

## Ronald voice update

The black cat now uses the official Cartesia Ronald voice (`5ee9feff-1265-424a-9d7f-8e4d431a12c7`), verified through the authenticated voice catalog. The white cat retains Celine. Both live calls and welcome speech use the saved character mapping. The black-cat welcome asset was regenerated under its new voice/settings hash; previously cached speech cannot override this mapping. The existing 24kHz PCM call format, interruption, STT and memory behavior remain unchanged.

## Maya fictional-memory demonstration

Five user-supplied fictional experiences dated October 9–22, 2026 are stored only in the explicitly selected account, labeled `Fictional demo · Maya`. They are not asserted as verified history about the account owner. Nickname, authentication, journal, existing memories and memory permissions are preserved. The October 18 Sunday date was checked; all five dates precede the local October 24 demonstration date.

The source fixture is `scripts/fixtures/maya-memories.ts`. `scripts/seed-maya-memories.ts --user-id=<explicit-owner-uuid> --dry-run` previews an idempotent import; omit dry-run to write through the existing Mem0 and owner-profile linkage flow. `--remove` withdraws only active links carrying this batch marker and deletes their remote memories using existing deletion handling. Existing unrelated records are never selected for deletion. No suggested callback is stored as a script.

`src/lib/memory-context.ts` adds a general rule to the existing chat/call system context: use one relevant detail or support preference, clarify uncertain references, avoid unrelated sensitive recall, and treat fictional memories as role-play data. It does not insert the Maya story into a global prompt. The normal owner-scoped retrieval and Claude flow remain in use.

The import and callback checks are recorded in `artifacts/maya-memory-import.json` and `artifacts/maya-memory-callbacks.json`. The verifier uses actual memory retrieval and Claude generation on fictional inputs without persisting fake conversations, and checks that a disposable second account cannot retrieve the memories or access their owner links. Generated wording varies.

## Interim preparation and companion prompt

`VOICE_SPECULATIVE_GENERATION=true` enables contextual Claude preparation from live interim text (enabled in the local demo). `VoicePrepareClient` debounces partial transcripts, submits at most three preparations per turn, and cancels an earlier revision when text changes or `turn.resume` arrives. It never speaks or writes a conversation. The confirmed final transcript still reserves/persists exactly one user/assistant turn through the original `/api/chat` path. Safety-sensitive partials do not prepare; the final safety path always takes priority.

`/api/voice/prepare` authenticates the owner and conversation, checks origin and rate limits, then uses Next `after` for bounded preparation. The same `voiceSystem` builds speculative and final prompts. Prepared text stays in a bounded owner/call/turn/revision cache in server RAM for at most 30 seconds; it is not a shared static answer library or personal-audio cache. Final generation rechecks full system/history/memory context fingerprints and the complete transcript before claiming it once. Changed words, memory edits/deletions, preferences, language or character context invalidate reuse. Cancellation, teardown and request abort stop obsolete generation. Failed/missing/expired preparations use the ordinary contextual path; once speech starts, responses are not replayed as a fallback. The browser's bounded diagnostic metrics include `prepared`; raw partials are not logged in production.

Claude requests cannot accept appended user text mid-request, so meaningful extensions cancel and restart bounded speculative work. This can increase provider usage. Short/incomplete turns, rate limits and replica-local cache misses fall back normally. The current implementation still performs final permission, memory and persistence checks; it does not promise instantaneous audio.

The canonical English voice companion prompt is `src/lib/voice-companion-prompt.ts`, composed with the saved language/character and existing safety/communication preferences. It usually asks one short relevant question in under 25 words, avoids stock validation and repeated summaries, uses at most one relevant memory detail, and respects no-advice, no-question, silence and topic boundaries. A no-advice request alone does not prohibit a gentle question. Direct answers and urgent safety needs override normal style and brevity. This prompt is used for both speculative and final voice generation.

`tests/voice-preparation.test.ts`, `scripts/verify-voice-preparation.ts` and `artifacts/voice-preparation-live.json` cover revision races, owner scoping, changed-context rejection, final abort, no interim history, actual Claude reuse, quiet-company behavior and safety bypass. `artifacts/voice-preparation-browser-checks.json` covers real capture/player integration with mocked provider events. The live test provided two seconds of synthetic thinking time before final submission and measured 1400ms from final request to first text, excluding microphone and physical playback; it is not a before/after phone benchmark.

## Personalized arrival screen

The first welcome page now displays `Welcome home, <account nickname>!` and requests English speech `Welcome home, <account nickname>. Meow.` with the selected cat's current fixed Cartesia voice (Ronald for black, Celine for white). The account nickname is separate from the companion name. Whitespace/control characters are normalized; an empty legacy nickname uses a generic greeting. Personalized audio is requested immediately on arrival and remains in a revocable page-local Blob URL, never the shared static welcome cache.

`welcome-arrival.css` scopes the new interaction to the first screen only. The existing SVG paw rotates about its shoulder in one 2.1-second greeting when HTML Audio `playing` or device-speech `onstart` fires. It then returns to idle blinking/breathing and a restrained tail motion. Tapping the cat triggers a visual greeting without repeating speech or stacking actions. Reduced-motion preferences disable movement. Continue cancels requests, stops audio and clears the gesture timer immediately; stale playback events cannot restart it. Existing question pages, English labels, saved language questions, skip and private check-in persistence are preserved. Browser autoplay rejection exposes a user-initiated play control.

Verification: 96 unit tests; actual personalized Ronald WAV synthesis; browser scenarios covering the account name, no gesture before playback, one-shot motion, tap without duplicate TTS, Continue cancellation, stale responses, autoplay recovery, all three unchanged check-ins and 320/390/768px layouts. Mock audio in browser lifecycle tests is not live sound-quality validation. Animation approach follows the event/state ideas studied in https://github.com/rive-app/rive-react and https://github.com/motiondivision/motion ; no new runtime or third-party character asset was introduced.

### Progressive live-call captions

Assistant captions now begin at actual playback start, rather than displaying a queued phrase in full. PCM uses played buffer time (excluding network gaps); WAV uses media time/duration; device speech uses word boundaries where available and an estimated clock otherwise. Word positioning for PCM/WAV is approximate, not forced alignment or provider word timestamps. Final intended text remains in conversation history. Interrupt, failure, and teardown cancel caption updates and device timers.

`voiceCompanionPrompt` forbids recap/paraphrase openings and includes fictional short conversational examples. Both speculative and final requests use this shared prompt. Run `node --import tsx scripts/evaluate-voice-style.ts` to generate a small live-provider evaluation at `artifacts/voice-style-evaluation.json`. It uses fictional inputs, costs API usage, does not modify model weights, and does not create user memories. These examples and evaluations are not clinical validation.
