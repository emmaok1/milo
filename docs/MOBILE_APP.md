# Haven mobile listener app

The five user-provided screenshots guide the ivory/sage palette, white rounded cards, five-tab navigation, meal form groups, report empty states, Friends code controls and Settings rows. They are visual references, not access to the source app or evidence of its hidden behavior.

## Implemented screens

- Home: selected listener, its traits and greeting, date selection, saved meal entries and a new-entry action.
- Report: compact weekly/monthly feeling curves, after-eating reaction bars, recorded-time scatter plots and at most two contextual next steps. Counts come from the signed-in user's entries; they do not establish causes, diagnoses or treatment effects. No health score or effectiveness claim is displayed.
- Chat: existing real Claude streaming, context modes, image input, public web research, sources, memory controls, and conversation history, inside a keyboard-aware mobile layout.
- Friends: share/copy a listener settings code, import a code, inspect/remove presets, and adopt a preset. This exchanges character settings only. It does not connect human accounts, send invitations or share private records.
- Settings: listener customization, memory/privacy/export and existing plans, installation instructions, private feedback/review notes, product information, and links to the public social-platform homepages. No Haven social accounts, external support inbox, public review service or paid subscription has been configured. Feedback is saved privately and not sent or published.

## Listener customization

Two cats: a black cat with a fixed male voice and a white cat with pink details and a fixed female voice. Personalization chooses cat, display name, communication language and one to four allowlisted style tags. These settings persist in the owner-scoped profile. Labels are untrusted data, not privileged instructions. The companion remains a fictional AI character; see `VOICE_CALL.md` for playback and interruption details.

## Journal data and privacy

The `/api/mobile` endpoint stores `mobile` in the existing owner-scoped profile JSON; no new SQL migration or elevated service credential is required for normal requests. Its validated operations update listener settings, journal entries, imported presets and private feedback. Existing optimistic versions protect writes. Limits are 200 journal entries, 30 presets and the 20 most recent feedback notes.

The record page has five sections: Photo (existing add/replace/remove control), Time (automatic account-timezone default, editable), Feelings, After eating, and Anything you’d like to share? Feelings offer Calm, Happy, Satisfied, Worried, Guilty, Sad, Frustrated, Tired and Not sure, with at most three selected for a new v2 entry. All tags are optional. After-eating reactions are separate from recorded behaviors: Wanted company, Wanted some quiet, Kept thinking about the meal, Felt out of control, Urge to compensate, and Other. An independent 800-character editable reaction note sits below them. Existing behavior choices remain inside a collapsed More options disclosure; selecting an urge or loss-of-control reaction never sets a compensatory behavior or binge label.

A photo, a tag, a reaction note or a general note is enough to save. Date/time are still validated but prefilled. Blank records are rejected. Meal type/location/company/satiety are optional legacy fields, without invented defaults. Existing entries retain old labels, metadata and explicitly marked skipped status. On edit, food description and note are merged into one 1,500-character text field, preserving their content; the original separate food field is omitted only when that edit is saved. Legacy entries with more than three feelings remain editable without silently dropping labels. Existing photo validation and per-account storage bounds remain in force.

Weekly and monthly views distinguish reaction tags, recorded actions and missing tags. Coverage displays denominators; blank is unknown, not a negative finding. Explicit positive feelings are not inferred from absent behavior selections. Associations include only recorded locations and do not claim causes. No new AI diagnosis or automatic nutrition advice was added by this form change.

Entries can be edited or deleted. Private is on by default and excludes the entry from the explicit Talk about this entry point. With Private off, the user can place a summary into the chat composer and choose whether to send. Sparse summaries omit absent metadata and distinguish reactions from actions. Journal data is never automatically inserted into model context, memory extraction, public research or a sharing code. All records remain private to the account regardless of the flag. Existing export and account deletion include profile JSON.

Validation: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`; `npm run verify:journal` uses disposable accounts to check minimal saves, defaults, validation, legacy editing, isolation, deletion and absence of automatic chat/Memory writes. Set `JOURNAL_TEST_PHOTO` to a synthetic JPEG path to also check photo-only saving. Browser checks exercise actual photo processing, three-feeling selection, independent reaction notes, legacy edit, Home rendering, both report periods and 320/390/768-pixel layouts, with mocked session/storage.

## Installable web app

- `/manifest.webmanifest`: standalone display, `/home` start URL, icons and theme color.
- Public PNG icons at 192, 512 and Apple touch 180 pixels; separate maskable icon.
- Safe-area and visual-viewport handling for iPhone display/keyboard.
- `/sw.js`: caches only an unpersonalized offline screen and public icons. It never caches private app HTML, authentication callbacks or API traffic. Chat and journal writes need a network connection.

To use on an iPhone, deploy to an HTTPS address reachable from the phone. Set `APP_ORIGIN` to that exact address and update Supabase Site URL and both allowed callback URLs before using authentication there. The local `localhost:3000` URL refers to the computer for desktop use and to the iPhone itself on the phone. No hosting deployment or iPhone installation was performed in this task.

Open the HTTPS site in Safari → Share → Add to Home Screen → keep Open as Web App on → Add. See [Apple's guide](https://support.apple.com/en-lamr/guide/iphone/iphea86e5236/ios). The [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) covers manifest and service-worker integration.

## Verification

24 TypeScript tests, typecheck, lint and a production build passed. Real disposable-account HTTP tests passed listener persistence, cat/dog voices, journal CRUD/validation, report counts, listener-code imports and two-user isolation. PWA assets, route responses, JavaScript content type and app icons were checked. Test accounts and their data were removed. Browser automation surfaces are unavailable, so full visual layout, iPhone keyboard behavior, native Share sheet and home-screen installation still require real-browser/device testing.


## Public Pomellow reference refinement
Reference: https://apps.apple.com/us/app/pomellow-ed-recovery/id6499055734 and https://pomellow.site/ (official public screenshots). Home now includes a Monday-first month calendar with saved-entry dots, day selection, month navigation and a Today shortcut. Meal cards expose recorded behaviors, setting, company, satiety, feelings and note preview. Report includes Monday–Sunday weekly and calendar-month navigation with counts scoped to the selected interval. No clinical efficacy numbers are copied. Existing original listener artwork and customization remain. Friend support messaging and meal-photo logging shown in the reference are not implemented; preset exchange remains clearly labeled.


## Screenshot-aligned English meal flow
Home uses a quiet listener room, a collapsed Monday-first week calendar (month heading expands it), selected-day entries and a black floating Add control. Report remains a bottom navigation destination with Weekly/Monthly tabs. Add opens the meal form with description, optional compressed JPEG photo, Skipped checkbox, privacy/time/context/satiety/feelings/behaviors/note fields and fixed Save action. Photos are private owner-profile data, capped at 50,000 characters each and 1,000,000 characters total; they are not sent to the listener or friend presets. Legacy entries remain readable. UI and default roleplay are English; a legacy default preferred address is normalized to friend. Original custom listener artwork is retained.

## Compact Report

Report contains four sections only: Feelings (Joy / Regret / Pain counts), Food photos (Meal / Snack / Fast food / Dessert pie), General analysis (up to two factual sentences), and One piece of advice. Weekly/monthly and date navigation remain. Counts are deterministic owner-profile aggregates; legacy Sad/Guilty tags are not silently relabeled as Pain/Regret. The three explicit chart tags are available alongside existing recording tags, with the same three-tag limit.

Photos receive one editable primary label. Saving a new uncategorized photo triggers the authenticated `/api/journal/analyze-photo` request asynchronously. Existing photos can be analyzed using Analyze photos in Report. Claude sees only that photo and a bounded classification instruction, not journal text; uncertain/non-food results are null and excluded from the pie. Categories describe visible food, not nutrition or food quality. The image label can be changed in the record editor, including Unknown. Replacing a photo resets its category. Analysis re-reads owner state before writing and checks image/category equality plus optimistic profile version; edited/deleted/replaced records are never resurrected. Classified assets are not cached across users. No calorie estimate, diagnosis, restriction advice or automatic Memory/chat extraction is added. Private entries stay out of chat; selected photos are sent to Claude for report labels as disclosed beside the photo.

`/report?preview=1` uses clearly marked Sample data. Empty accounts default to this in-memory fictional report; real entries default to their real report. `preview=0` shows a genuine empty state when appropriate. Preview never writes records, requests photo analysis, or mixes with real data. There is no chart drilldown or extra analysis panel in the simplified layout.

## Simplified Chat layout

Chat now uses a quiet message canvas and a bottom text composer with compact image, public-web and voice-call tools. The focus selector, starter tags, reply-style selector, inline temporary row, introductory copy and top-left history clock were removed. Memory mode still follows account Settings and the existing authenticated conversation endpoints remain unchanged. New conversation stays available.

The center Chat item in the five-item bottom navigation is a larger green button, consistently across sections; it still opens text Chat. There is no extra large button inside the page. A small invitation next to the selected cat asks `Wanna have a voice call?` once on entering Chat. Yes opens `/call`; No collapses it into a cat with a phone badge that also links to `/call`. It never starts microphone capture or audio automatically.

Browser checks covered text sending with streamed fixture events, Yes/No navigation, the phone badge, removed controls, 320/390/768px widths, a short keyboard-height viewport and JavaScript errors. Provider/authentication behavior is not changed by this layout edit.

The empty Chat composer is centered beneath `What’s on your mind?`. Sending the first message removes that heading and moves the composer to the bottom with a short layout animation (disabled for reduced motion). New conversation restores the centered state. The composer Voice call link has been removed; the top-right cat remains the voice entry. Browser verification covers the empty-to-active transition and reset as well as short viewport visibility.
