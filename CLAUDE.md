# Fwitter: project context

Read this first in any new session. It explains what the app is, how it is built, what it is wired to, how to work in the repo, and what is open. Last updated 30 October 2026, after PR #29.

## What Fwitter is

A football discussion app (Twitter-style) for under-16s and up. Users pick a primary club and topics at sign-up, post takes (500 characters, tagged with at least one club or topic), follow people, like, repost, quote, reply, vote in polls, add photos, DM mutual follows, and follow live match threads. Safety is a first-class feature: age tiers, parental consent, private-by-default junior profiles, reporting, blocking, a banned-words filter, image scanning and a moderation dashboard.

Age rules: sign-up is 13+ (a legal floor under UK GDPR and COPPA, not a technical one). 13 to 15 is the `JUNIOR` tier, 16+ is `STANDARD`, derived from the date of birth at sign-up.

## Repository layout

```
api/            NestJS 11 + Prisma 6 + PostgreSQL. Deployed to Railway.
api/admin/      Vite + React moderation dashboard, built by the API build, served at /moderation/
api/prisma/     schema.prisma + migrations (applied by `prisma migrate deploy` on every deploy)
api/scripts/    seed.mjs (idempotent, runs on every deploy) and seed-data/teams.mjs (club catalogue)
mobile/         Expo SDK 54, Expo Router v6, React Native, Amplify v6 for Cognito
docs/           REVIEW_AND_ROADMAP.md (review, security, roadmap), SETUP_CREDENTIALS.md (every external credential, step by step)
```

### API modules (`api/src/`)
auth (Cognito JWT guard, roles, `/auth/username-available`, `/auth/email-available`), users (profile, follows, blocks, guardian email, account deletion), posts (create, replies, likes, bookmarks, reposts, quotes, polls, mentions, hashtags), feed (Squad and 12th Man, ranking), hashtags, search, teams, topics, matches (football-data.org fixtures sync), media (S3 presigned uploads + Rekognition scan), notifications (in-app + Expo push), dm, moderation (visibility filter, reports, auto-hide, banned words), admin (dashboard API), consent (guardian consent page and tokens), email (SES).

### Mobile (`mobile/app/`, file-based routes)
- `(auth)/`: welcome, sign-in, sign-up, confirm-signup, forgot-password, reset-password
- `(onboarding)/`: username, personal-details (name, email, password, date of birth, guardian email for 13 to 15), team-selection, topics. The Cognito account is created at the end of `topics.tsx`.
- `(tabs)/`: Home (`index.tsx`, Squad and 12th Man), Activity, Messages, Explore
- Standalone: compose, posts/[id], users/[id] (+ followers, following), dm/[id], hashtags/[tag], matches, bookmarks, account, settings, consent-pending, welcome-success
- Shared code in `mobile/src/`: `api/client.ts` (`apiFetch`, adds the token, handles 401/403), `auth/` (AuthProvider, Amplify helpers, session events), `components/PostCard.tsx`, `feed/` (engagement, optimistic feed events), `theme/theme.ts` (all colours and fonts)
- The gate in `app/_layout.tsx` routes: signed out to Welcome, signed in without a profile to onboarding, pending guardian consent to consent-pending, otherwise to the tabs.

## How key features work

- **Feeds.** Squad shows posts from people you follow (and your own). 12th Man shows posts tagged with your clubs and topics from anyone, excluding your own, with "For you" (heuristic ranking: engagement times affinity, decayed by age; no machine learning) and "Latest". Code: `api/src/feed/`.
- **Counts.** Like, repost and poll counts are only visible to the post's author.
- **Juniors.** A JUNIOR account is blocked (403 `consent_pending`) until a guardian confirms through the emailed link (`/consent/:token`, 7 days, single use; decline deletes the account including the Cognito login). JUNIOR profiles are private by default: not discoverable by STANDARD accounts. DMs only between mutual follows in the same age tier.
- **Moderation.** Every post query goes through `ModerationService.visibility`. Three distinct reporters auto-hide a post. Banned words block at submit. Suspended and banned users are refused by the JWT guard. Moderators use the web dashboard, see reported DMs only, and every action is audited.
- **Identity.** Login lives in Cognito; the profile lives in Postgres, linked by `cognito_sub`, with the email copied in. `/auth/email-available` checks both. If the database is rebuilt, existing Cognito logins resume onboarding to recreate their profile.

## External services and where they are configured

| Service | Purpose | Where |
|---|---|---|
| Railway | API + Postgres, `https://fwitter-production.up.railway.app`, auto-deploys `main` | Railway variables (see `api/.env.example` and `docs/SETUP_CREDENTIALS.md`) |
| AWS Cognito (eu-north-1) | Login. Pool `eu-north-1_f8sV2Qsf0`, client `444hv012l8fg5m5j0f1epntkp7` | API, mobile and dashboard env vars |
| AWS S3 (eu-west-2) | Photos, bucket `fwitter-media-prod`, public read on `uploads/*` | `S3_BUCKET`, `MEDIA_AWS_REGION`, IAM keys on Railway |
| AWS Rekognition (eu-west-2) | Image moderation on upload | Same IAM user |
| AWS SES | Guardian consent emails. Not live yet: without `EMAIL_FROM` the link is written to the Railway log | `EMAIL_FROM` on Railway |
| football-data.org | Fixtures and scores | `FOOTBALL_DATA_TOKEN` |
| Expo / EAS | Builds, TestFlight submission, push. Account `ajs94x`, project `mobile` | `mobile/eas.json`, EAS env vars |
| Firebase `fwitter-mobile` | Android push (FCM V1) | `google-services.json` (gitignored, on EAS as a file variable) |
| Apple | Team `Z83B58T6S8`, bundle `com.ajs94x.mobile`, App Store Connect app `6800372379`. TestFlight builds 7 and 8 shipped | |

The IAM user's policy covers S3 on the bucket, `rekognition:DetectModerationLabels`, and `cognito-idp:ListUsers` + `AdminDeleteUser` on the pool. `ses:SendEmail` still needs adding when SES goes live. Railway Postgres backups are not on yet (needs a plan upgrade).

## Working in this repo

- **Git:** never commit to `main` or merge PRs. Branch from `origin/main` (local `main` can lag), push, and give the user the compare link `https://github.com/AlfieSharman94/Fwitter/pull/new/<branch>`; the user opens and merges PRs. `gh` is not installed. Pushes use the SSH alias `github-personal`; if one fails with `publickey`, ask the user to run `ssh-add --apple-use-keychain ~/.ssh/id_ed25519_personal`.
- **Style:** no em dashes anywhere (code comments, docs, commits, tickets). Minimum code, touch only what the task needs.
- **Commits** end with the Co-Authored-By line for the current model; PR bodies end with the Claude Code line.
- **API checks:** `cd api && npx nest build && npx jest` (147 tests at PR #25, more since). In a fresh worktree run `npm ci && npx prisma generate` first. Specs that import NotificationsService, UsersService or DmService must mock `../notifications/push.service`.
- **Mobile checks:** `cd mobile && npx tsc --noEmit` must show exactly the 5 known errors (amplify.ts region, auth.ts refreshToken, two jsbn, text-encoding). After adding a route, run `CI=1 npx expo start` briefly to regenerate typed routes.
- **Migrations:** add a folder under `api/prisma/migrations/`, generated with `npx prisma migrate diff --from-url <local db> --to-schema-datamodel prisma/schema.prisma --script`; check it does not drop the hand-written expression indexes.
- **Local database:** docker container `fwitter-db`, `postgresql://fwitter:<password>@localhost:5432/fwitter_dev` (password: `docker exec fwitter-db printenv POSTGRES_PASSWORD`). There is no `api/.env`; pass `DATABASE_URL` on the command line.
- **Device testing:** a development build is installed on the user's iPhone; run `cd mobile && npx expo start --dev-client` (it reads `mobile/.env`, which points at Railway). Icons and splash only change with a new native build.
- **Shipping to TestFlight:** `eas build --profile production --platform ios`, then `eas submit --platform ios --latest`. A stray keychain entry for the Apple ID "y" makes EAS default to it; type the real Apple ID over it.
- **Club catalogue:** `api/scripts/seed-data/teams.mjs`, 2026-27 memberships, 1,635 clubs in 127 groups including the English pyramid to step 6. The seed never deletes or renames, so a rename creates a duplicate.

## Open backlog (user feedback, 30 October 2026, not started)

Login and register
1. ~~Land on the Squad tab by default after login.~~ Done: Home now opens on Squad (`fix/feedback-round-2`).
2. ~~Side menu: username and avatar take a second to appear.~~ Done: the menu loads the profile when Home mounts (`fix/feedback-round-2`).
3. ~~Side menu avatar is slightly clipped by the iOS status bar.~~ Done: the header uses the safe-area inset (`fix/feedback-round-2`).
4. ~~Password dots are hard to see (dark dots on dark grey) in dark mode.~~ Done: the dim "••••••••" placeholders on sign-in and reset password are now words, so an empty field no longer looks filled (`fix/feedback-round-2`). Typed characters were already white.
5. ~~Confirm-signup screen: the keyboard covers the Confirm button after entering the code.~~ Done: the form moves above the number pad (`fix/feedback-round-2`).

Child accounts
6. Restyle the Cognito verification-code email so it is clearly from Fwitter (Cognito message templates, or SES custom sender).
7. Let a parent approve a child from inside the app, not only through the web page.
8. ~~On the consent web page, put the delete-account tick box under the "No, delete the account" button.~~ Done (`fix/feedback-round-2`).
9. A pending JUNIOR account sees only the waiting screen (by design today). Decide with the user whether they get limited read-only access instead.
10. Proposal: a child must link to an existing adult Fwitter account (the guardian email must belong to one); the adult's Activity tab shows the child's new follows, posts and replies. Needs product decisions before building.

Profiles
11. ~~After following someone, the Message button only appears after leaving and reopening the profile.~~ Done: the profile re-checks DM eligibility after each follow or unfollow (`fix/feedback-round-2`).

Moderation
12. ~~Add "Not football related" as a report reason.~~ Done: `NOT_FOOTBALL` on `ReportReason`, shown as "not football" in the dashboard; it counts towards auto-hide like any other reason (`fix/feedback-round-2`).
13. ~~The banned-word error on compose is below the fold.~~ Done: errors from posting now show as a dismissable alert (`fix/feedback-round-2`).

Questions from the user to answer
14. Adults cannot find or see child accounts (search, followers, replies). This is the private-by-default JUNIOR rule; explain it and confirm whether adults should see children who follow them or reply to them.
15. Explain how 12th Man works (see "Feeds" above).
16. First launch should ask for the right permissions (notifications, photos) at a sensible moment.

Also pending outside the code: SES for consent emails, Railway backups, privacy policy URL and external TestFlight review.
