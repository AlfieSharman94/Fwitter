# Fwitter: setup actions, review and roadmap

Written 23 October 2026 after Phases 1 to 4 were merged. Everything below reflects the code on `main` plus the `fix/next-tier` and `feat/teams-expansion` branches.

## 1. Actions only you can do (since Phase 1)

Work through these in order. Each one unblocks a feature that is already built.

### Railway (API)

| Variable | Why | Status |
|---|---|---|
| `ADMIN_EMAILS` | The seed promotes these emails to admin on every deploy. Without it nobody can open the moderation dashboard. | Needed |
| `VITE_AWS_REGION`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_USER_POOL_CLIENT_ID` | The dashboard is built during the API build and needs the Cognito settings at build time. Same values as the mobile app. | Needed |
| `FOOTBALL_DATA_TOKEN` | Fixtures and scores. Free key from football-data.org (10 calls a minute, delayed scores). The €12 a month tier gives live scores. | Needed for Matchday |
| `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Photo uploads and avatars. See the bucket steps below. | Needed for photos |
| `MEDIA_PUBLIC_BASE_URL` | Optional CloudFront domain in front of the bucket. | Optional |
| `REKOGNITION_BLOCK` | Optional override of the image categories that are rejected. The default blocks alcohol and gambling imagery too, which may catch sponsor logos. | Optional |

Also confirm on Railway: automatic deploys from `main`, daily Postgres backups turned on, and that the start command still runs `prisma migrate deploy` then the seed (it does in `railway.json`; the seed is idempotent and now loads 571 clubs).

### AWS

1. Create an S3 bucket in `eu-north-1`. Object ownership "Bucket owner enforced", public access blocked except a bucket policy that allows `s3:GetObject` on `uploads/*`. No CORS needed for the app.
2. Create an IAM user with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on that bucket and `rekognition:DetectModerationLabels`. Put its keys on Railway.
3. Rekognition costs about $1 per 1,000 images. Budget alert recommended.

### Expo / EAS (mobile)

1. Push credentials: an APNs key for iOS via `eas credentials`; for Android a Firebase project, `google-services.json` referenced as `android.googleServicesFile` in `app.json`, and the FCM V1 service account uploaded to EAS. Push works only on physical devices.
2. New native modules since Phase 1: `expo-notifications`, `expo-image-picker`, `expo-image-manipulator`. Make a new development build (`eas build --profile development` or `npx expo run:ios`) before testing; Expo Go will not work.
3. `eas.json` now carries the public config (API URL, region, Cognito ids) for the `development` and `preview` profiles so those builds work out of the box. Keep the `production` profile's values in the EAS dashboard as before.
4. The app's display name is now "Fwitter" (`app.json` `name`). The slug stays `mobile` because EAS links the project by slug.
5. CocoaPods needs a UTF-8 locale: `export LANG=en_US.UTF-8` in your shell profile, or `pod install` fails with an encoding error.

### Local development

- `api/.env` was missing when I started. Create it from `.env.example` with your local `DATABASE_URL` and the Cognito values. The API will not start without it.
- `api/admin/.env` holds the three `VITE_*` values for local dashboard builds (gitignored). Dev server: `cd api/admin && npm run dev` on port 5174.
- After pulling route changes, run `npx expo start` once before trusting `tsc` in `mobile/`: Expo regenerates its typed routes on start.

### Moderation

- Sign in to `/moderation` on your API domain as an admin. Extend the banned-words list; the seed only ships a short starter of profanity and no slurs by design.
- Decide who the moderators are and set their role from the dashboard.

### App Store / Play Store

- Account deletion is in the app (required by both stores).
- You still need: a privacy policy URL (children's data), terms of use, an age rating questionnaire (user-generated content, messaging), and App Store "Kids" or teen positioning. Both stores require a way to report and block users (built).

## 2. Device test pass

See section 8 at the end for what was tested on the simulator and what came out of it.

## 3. Improving what is already built

**Push notifications.** Built end to end (token registration, sender, tap-to-open, badge refresh) but delivering nothing until the EAS credentials above are configured. Once they are, consider: a "New message" push body instead of the message preview (privacy on lock screens), notification settings per type, and quiet hours for 13 to 15s.

**Ranking.** The weights (reply ×2, repost ×3, follow ×1.5, primary club ×1.3) are guesses. After launch, look at what people actually open and tune. Add impression logging if you want a learned model later.

**Feeds.** Posts are not searchable yet; Explore only finds people. Full-text search over posts and hashtags is a small Postgres change (`tsvector`). "Latest" could also offer a "Clubs only" filter.

**Matchday.** With the free football-data tier, scores arrive late. The hub could show lineups and goal events (the API provides them) and a pre-match predictions poll.

**Media.** EXIF is stripped on the client; a modified client could upload metadata. Re-encoding on the server (sharp on upload complete) would make that airtight and let you make thumbnails.

**Dashboard.** Notes use browser prompts; a proper form, keyboard shortcuts for the queue, and moderator metrics (actions per day, median time to resolve) would help once volume grows.

**Hygiene left from the original review.** `POST /matches/sync` is open to any signed-in user (throttled); make it moderator-only. Rate limiting is per IP and in memory: a school's shared IP could hit the 120 a minute limit, and limits reset on each deploy. Per-user limits backed by Redis is the next step.

## 4. A web app

Yes, and the cheapest route is the app you already have. The API is platform-neutral, and Expo can build the same code for the web (`app.json` already has `web.output: "static"`). What would need work:

- Screens use React Native primitives that run on the web, but layouts assume a phone width. A max-width shell and a sidebar nav for desktop would be needed.
- Native modules need web fallbacks: SecureStore (use localStorage or memory), push notifications (web push or none), the image picker (works on web), haptics (no-op).
- Cognito works in the browser (the dashboard already does it with the same pool).
- Hosting: `npx expo export --platform web` produces static files; serve them from the API like the dashboard, or from Railway/Vercel.

Estimate: a week to get feeds, posting, profiles, notifications and DMs working on the web with a desktop layout, mostly layout work. The alternative, a separate Next.js app, gives a better desktop experience but duplicates every screen.

## 5. Security review

What is solid: JWTs verified against Cognito's JWKS with issuer and audience pinned; every post query goes through one visibility filter; ownership checks on delete, like, bookmark and DM access; role checks on the admin API; validation pipe with whitelist; Prisma (no raw SQL); rejected images deleted; moderators can read only reported conversations.

Risks, roughly in priority order:

1. **Sign-up abuse.** Nothing stops a script creating accounts: Cognito sign-up is open and the availability checks are only rate-limited per IP. Enable Cognito's advanced security (adaptive auth), add a CAPTCHA to sign-up, and require email verification (already the flow). Consider blocking disposable email domains.
2. **Age is self-declared.** The age gate is a date-of-birth field. See section 7; this is the biggest trust gap for an under-16 product.
3. **Rate limiting is weak.** Per IP, in memory, bypassed by changing IP, and collateral for shared school networks. Move to per-user limits in Redis before growth.
4. **Secrets and config.** The repo is public; it contains no secrets (checked), only the Cognito pool and client ids, which are public by design. Keep `.env` files ignored (they are) and rotate the IAM keys if they ever land in a log.
5. **Content pipelines.** Rekognition catches explicit imagery but not everything (text in images, self-harm imagery is partial). Banned words are a blunt tool; add a toxicity classifier later. Link previews are not fetched, which avoids SSRF for now; if you add them, fetch server-side with an allowlist and no private IPs.
6. **Dashboard.** Served from the API origin, so an XSS in the dashboard would have the moderator's token. React escapes by default and there is no `dangerouslySetInnerHTML`; add a Content Security Policy header when convenient.
7. **DM privacy.** Messages are plaintext in Postgres (needed for moderation). Push bodies include a preview. Railway Postgres encrypts at rest; restrict database access to the API.
8. **Dependencies.** `npm audit` reports advisories in the API and mobile trees. Review quarterly; nothing exploitable at runtime is obvious, but keep up.
9. **Logging.** Make sure Railway logs are not retaining request bodies with emails or messages. Nest's default logger does not log bodies.
10. **Account recovery.** Password reset goes through Cognito email. Fine, but a child's email is often a parent's; see section 7.

## 6. What to build next

Ordered by value for this audience.

1. **Parental consent and age assurance** (section 7). Nothing else matters as much if the app is really for under-16s.
2. **Post search and hashtag search.** The single most-asked-for thing in a social app after it has content.
3. **Club Lounges.** A community space per club (the menu slot used to say "Club Lounge"): pinned posts, club news, matchday thread links. The team catalogue now has 571 clubs to anchor it.
4. **Predictions game.** Score predictions on Matchday with a weekly leaderboard. Cheap, sticky, and football-native.
5. **Mute words and accounts.** Lighter than block; a must for teens.
6. **Who to follow.** Suggestions from shared clubs and mutual follows; also seed the Squad feed for new users.
7. **Link previews** with an allowlist, and **GIFs** via Tenor or GIPHY with their content rating set to the strictest level.
8. **Pinned post and profile banner.**
9. **WebSockets for DMs** and live match threads once there is real traffic.
10. **Impression logging** then a learned ranker, as discussed.
11. **Accessibility pass:** dynamic type, VoiceOver labels on icons, contrast check of the dim greys.
12. **Localisation** if you go beyond the UK.

**End-to-end encryption for DMs.** I would not add it to this product. E2EE means nobody but the two phones can read a conversation, including your moderators when a child reports grooming. The platforms that do E2EE for minors pair it with client-side reporting that uploads the reported messages, which is most of the complexity for little gain here. The current design (plaintext, readable only after a report, audited) is the right trade-off for an under-16 app. Revisit if you ever open the app to adults.

## 7. Making sure under-16s can use the app safely

What exists: age gate at sign-up, age tiers, hidden like and repost counts, blocking, reporting with auto-hide, a word filter, image scanning, DMs only between mutual follows in the same tier, moderator tooling and audit, account deletion.

What to add, in order:

1. **Parental consent.** For under-13s this is a legal requirement (COPPA, UK GDPR); for 13 to 15s it is strongly expected under the UK Age Appropriate Design Code. Minimum viable: a guardian email at sign-up for JUNIOR accounts, a consent link, and the guardian can request data deletion. Store the consent record.
2. **Age assurance.** Self-declared dates of birth are trivially faked. Options from light to heavy: block changing DOB after sign-up (done), guardian confirmation (above), a facial age estimation vendor (Yoti) only for accounts that try to move up a tier.
3. **Private by default for 13 to 15s.** Done: a JUNIOR account is invisible to STANDARD accounts (search, profile, follows, posts and embeds, notifications) until it turns on "Public profile" in Account. Within the 13 to 15 group nothing is hidden, and DMs keep their same-tier rule.
4. **Contact-detail guard in DMs.** Detect phone numbers, Snapchat/Instagram/Discord handles and "add me on" patterns and warn or block them. Off-platform contact is the classic grooming move.
5. **Self-harm and crisis signals.** When a post or message matches a self-harm keyword list, show Samaritans/Childline resources to the author and flag to moderators with priority.
6. **Quiet hours and time limits.** No pushes between 22:00 and 07:00 for JUNIOR accounts; a gentle "you've been scrolling a while" nudge.
7. **New-account probation.** The first few posts of a new account go to the moderation queue before appearing in For you, which blunts spam and raids.
8. **CSAM detection.** Rekognition does not do this. Use a hash-matching service (Thorn's Safer, or Cloudflare's free CSAM scanning tool) on every upload, with mandatory reporting procedures written down before launch.
9. **Moderation SLAs and escalation.** Define who is on call, target time to first action on a report, and an escalation path to the authorities. The dashboard shows the queue; it does not yet show age of oldest open report, which is the metric to watch.
10. **Safety centre in the app.** A short, plain-language page: how to report, how to block, who the moderators are, and links to Childline and the NSPCC.
11. **Online Safety Act (UK).** Document a risk assessment, your terms, and your reporting flows. Keep the audit log; it is your evidence.
12. **No ads, no tracking SDKs, no location.** Keep it that way; both app stores treat children's apps strictly.

## 8. Device test pass (simulator)

Run on 23 October 2026: iPhone 15 Pro simulator (iOS 17.2), development client built from source (`expo run:ios`), Metro on port 8081, API running locally on port 3000 against the local Postgres with the expanded team catalogue. No account was created, because the Cognito pool is the production one; everything up to the final "Finish & create account" button was exercised.

What worked:

- The native build: CocoaPods and Xcode succeed once the shell has a UTF-8 locale. The app starts, loads the bundle, and renders the Welcome screen with the dark theme and fonts.
- Welcome → Create account → Step 1 (handle): availability check against the API, green tick and "that one's free".
- Step 2 (details): email availability check, password rules, confirm-password mismatch warning, the 13+ age gate accepts a 15-year-old (Junior tier).
- Step 3 (club): search returns the new catalogue (for example "Inter" lists Inter, Inter Miami, Internacional, Winterthur), selection enables Continue.
- Step 4 (topics): search finds the new seeded topics ("Fantasy Football"), chips select and deselect, counter updates.
- Deep links: `mobile://sign-in` opens the Log in screen through the app's URL scheme.
- Log in and Forgot password screens render. No red boxes, no runtime errors in Metro during the whole pass.

Findings and suggestions (none blocking):

1. **Step 3 and 4 start empty.** Nothing is listed until you type. Show the top clubs (or the user's country's top division) and the full topic list by default; many 13-year-olds will not know what to search for.
2. **Search results show only the club name.** With 571 clubs there are collisions ("Inter" vs "Inter Miami", "Rangers" vs "QPR"). Show league or country under the name; the data is now there.
3. **Step 2 is long for a phone.** With the keyboard open the date of birth row sits below the fold and the form must be scrolled; tapping outside does not dismiss the keyboard. Consider moving date of birth above the password fields, or splitting the step.
4. **Secure fields clear on re-entry.** Standard iOS behaviour, but it means a user who taps back into the password field and types loses what was there; the confirm field then mismatches. A "show password" eye icon would make this less confusing.
5. **Step 4 allows zero topics.** The feed copes (clubs drive it), but a minimum of one topic, or defaults, would give the 12th Man feed more to work with on day one.
6. **The native app name is still "mobile"** in the simulator's "Open in" prompt and the dev launcher, because the native project was generated before `app.json` was changed. A fresh prebuild or EAS build picks up "Fwitter".
7. **Forgot password and Reset password still use the old placeholder styling** (navy background, blue pill button, system font, football emoji) rather than the dark theme the rest of the app uses. They were deferred in the design pass and now stand out; the welcome-success screen is in the same state.
8. **Signed-in pass (later the same evening, with the test account signed in on the simulator against the local API):** Home feeds (Squad shows own posts; 12th Man excludes them by design, so posting while on 12th Man gives no visible confirmation), composer with a club tag and an @mention, post detail, reply (counter updates), like and bookmark (author sees the count), quote post with the embedded original, Explore user search, another user's profile, Report user (row lands in the moderation queue), Activity list, Messages inbox, the Message button appearing only once the follow is mutual, sending a DM, Saved, Matchday empty state, Account screen, and Change photo failing cleanly with "Image uploads aren't switched on yet" when no bucket is configured. No crashes and no runtime errors.
9. **Composer tag picker lists all 571 clubs alphabetically** (Aberdeen, Académico de Viseu, Accrington Stanley...). It should show the user's own clubs first, then popular ones, with search for the rest.
10. **Explore is empty when nothing is trending.** Add suggested people and clubs so the tab is never blank.
11. **Not tested:** polls on device (covered by API tests), image uploads end to end (needs the bucket), push delivery (needs EAS credentials and a physical device), the moderation dashboard against this data.
