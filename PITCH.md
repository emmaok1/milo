# Haven: two-minute demo

Based on calhacks-kit skills/hack-pitch/SKILL.md. Format: recorded two-minute demonstration. Short sentences for a non-native English speaker. Times include clicking and the AI reply. Use fictional data and verified live integrations.

## One sentence
Haven is an AI companion for adults who struggle with binge eating or purging.

## Full script and actions

### 0:00–0:15 — Problem; start on the home screen
“After a difficult meal, some people feel alone. Haven is an AI companion for adults who struggle with binge eating or purging. Let me show you.”

### 0:15–0:30 — Show the saved cat and personalization
“This is my companion. I can choose its name, language, and how it talks to me.”
Show saved settings briefly; move directly to Voice call.

### 0:30–1:00 — One voice turn
“I can talk when typing feels hard.”
Say to the app: “I feel bad after dinner. Please keep your answers short. Just listen.”
Stop narrating. Let the actual AI response play. End the call.

### 1:00–1:30 — Memory and new chat
“With memory turned on, Haven can remember my preferences. I can also edit or delete them.”
Show the real extracted preference. Open a new conversation. Send: “How do I like you to respond?”
Let judges read the actual answer. Do not promise exact model wording. Extraction is asynchronous; use an honestly disclosed cut if necessary, subject to competition rules.

### 1:30–1:50 — Technical explanation
“Claude creates the replies. Cartesia gives the cat a voice. Mem0 manages memory, and Qdrant helps find it. We built the app that connects these parts.”
Optional overlay: Claude → Cartesia; Mem0 → Qdrant; Supabase → accounts and records.

### 1:50–2:00 — Impact and limits
“This demo uses fictional data. Haven offers support, not medical care. Our goal is simple: help people feel heard, one conversation at a time.”
End on the cat or home screen.

## Thirty-second version
“After a difficult meal, some people feel alone. Haven is an AI companion for adults who struggle with binge eating or purging. You can talk to your cat, and it can remember how you want to be supported. Here, it remembers that I prefer short replies and listening. I can edit or delete that memory. Haven offers support, not medical care.”
Show memory and a new-chat reply while speaking.

## Judge questions: short answers

1. Who is it for? Adults who struggle with binge eating or purging. We still need user research to test whether this experience meets their needs; do not claim interviews unless completed.
2. What did you build? The app interface, character settings, conversation flow, memory controls, and integrations. Claude, Cartesia, Supabase, Mem0, and Qdrant provide underlying services.
3. What is mocked? The demonstration data is fictional. With live integrations enabled, replies and memory use real services. Scripted demo mode and video previews are simulations; disclose them if shown.
4. Hardest problem? One technical challenge was making memory work across conversations while respecting user settings. Background jobs recheck permissions, and retrieval checks memory ownership and provenance. Confirm this was your personal hardest challenge before saying it was.
5. Different from a general chatbot? It combines a personal companion, voice, user-controlled memory, and meal and feeling records in one focused experience. Do not claim exclusive capabilities.
6. What breaks at scale? We would first test background-job throughput, local speech capacity, and provider limits. The current supported memory setup uses one worker; production needs more scaling work and distributed rate limiting.
7. Another week? User testing, more reliable mobile voice testing, and broader end-to-end verification.
8. Sponsor track? Not confirmed. Check the actual track rules before claiming eligibility. Claude powers replies and memory extraction; Cartesia powers voice.

## Rehearsal

- Log in and grant microphone access before recording.
- Confirm Claude, Cartesia, memory services, and worker are running.
- Rehearse the actual memory extraction and cross-chat retrieval.
- Keep settings to one brief screen; skip login, reports, and friends in this cut.
- Leave space for the actual voice response. Cut narration if over two minutes.
- If you shorten a wait, label it and follow competition recording rules.
- Record three timed rehearsals; keep a backup recording.

## Roles
Solo presenter assumed: narrator and driver are the same person. Name not provided. For a team, one person speaks and another follows the fixed click sequence.
