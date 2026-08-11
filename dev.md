# dev.md — Fwitter (Football Twitter) Build Guide

## 0) Purpose of this file
This file is the **single source of truth** for what we’re building. Cursor should reference this whenever generating code, schemas, endpoints, or architecture decisions.

If anything conflicts with other docs or older code, **dev.md wins**.

---

## 1) Product summary
**Fwitter** is a mobile-first social media app for football discussion (a play on “Football Twitter”).
The **UI/UX should feel familiar to X (formerly Twitter)**, while the backend is a **centralised MVP** designed in a modular way so it can evolve toward **Bluesky-like concepts** later (custom feeds, event-driven processing, pluggable moderation).

---

## 2) Core user experience
### Onboarding / Profile
Users register and create a profile:
- `username` (unique, handle)
- `displayName`
- `profilePicture` (upload)
- `bio` (optional)
- Select **1 primary team**
- Select **additional teams** (optional)
- Select **topics** to follow (e.g., Premier League, La Liga, Ballers League, etc.)

### Bottom navigation (MVP)
- Home
- Search
- Notifications

### Home (two feeds)
- **Squad**: posts from people the user follows (X “Following”)
- **12th Man**: posts from the user’s chosen teams/topics (X “For You” but user-controlled)

### Side menu (tap profile picture top-left)
Shows:
- profile picture, displayName, username
- Following count, Followers count
- Tap counts -> list users; from list you can follow/unfollow and view profile + posts

### Search
- Shows **top 5 trending topics**
- Tap a topic -> view **Top** and **Latest** posts for that topic
- Manage followed topics (add/remove)

### Notifications
- Replies to your posts
- (Later: follows, mentions, likes, reposts)

---

## 3) MVP scope (must-have vs later)
### Must-have (MVP)
- Auth + profile creation
- Team/topic selection
- Create posts + replies
- Follow/unfollow
- Home feeds: Squad + 12th Man
- Search: trending topics + topic pages (Top/Latest)
- Notifications: replies
- Basic user profile pages

### Later (non-MVP)
- Likes, reposts, bookmarks
- Mentions, hashtags
- DMs
- Media in posts
- Polls
- Matchday threads / live match hubs
- Verified accounts
- Advanced moderation tooling
- Custom user feeds / feed marketplace
- Federation / protocol work (NOT MVP)

---

## 4) Tech stack (locked)
### App
- **React Native (Expo)**

### Backend
- **Node.js + TypeScript**
- **NestJS** (primary framework)

### Data
- **PostgreSQL (AWS RDS)**
- **Redis (AWS ElastiCache)** for caching, rate limiting, feed/trending caches

### Storage/CDN
- **S3** for profile images (and later post media)
- **CloudFront** in front of S3 (later)

### Async / event processing
- **SQS** for background work (notifications fan-out, feed updates, moderation jobs)

### Compute
- **ECS Fargate** for API containers behind an **ALB**

### Auth
- Prefer **Cognito** for production auth flows (MVP can start with JWT auth module if needed, but plan for Cognito integration)

---

## 5) Architecture principles
### Centralised MVP, “Bluesky-ish” internals
Even though the app is centralised:
- Separate concerns into modules/services (Identity, Social Graph, Content, Feeds, Notifications, Moderation)
- Use **events** internally for key actions (e.g., `post.created`, `reply.created`, `follow.created`)
- Run fan-out / heavy work async (SQS workers)
- Keep feed generation logic encapsulated in a **Feed Service** (not scattered across controllers)

### Monolith first, modular boundaries
Start as a **single NestJS service** with clear modules. Later we can split modules into microservices without rewriting domain logic.

---

## 6) Feed definitions (important)
### Squad feed
**Input:** user follows graph  
**Output:** posts (and replies if we choose) from followed users  
**Sort:** newest first (MVP). Later add ranking.

### 12th Man feed
**Input:** user’s followed topics + teams (primary + additional)  
**Output:** posts tagged to those topics/teams  
**Sort:** MVP = newest first or simple score (likes/replies) with recency weighting.

### Tagging requirement
Every post should be associated with at least one of:
- a **team**
- a **topic**
(We can allow “general” topic if needed, but the 12th Man feed depends on tags.)

---

## 7) Data model rules (high-level)
- Use UUIDs for primary keys
- Timestamps: `createdAt`, `updatedAt`, plus `deletedAt` for soft delete where useful
- Enforce uniqueness for `username`
- Social graph relationships must be indexed (performance)
- Posts must support **replies** (parent/child relationship)
- Trending topics derived from recent activity (Redis + periodic jobs)

---

## 8) API conventions (high-level)
- REST for MVP
- JSON responses
- Cursor should generate:
  - DTOs + validation
  - consistent error shapes
  - pagination (cursor or offset; prefer cursor for feeds)
- Auth via bearer token
- Rate limit sensitive endpoints (post, follow, search)

---

## 9) Security & compliance (baseline)
- Store date of birth (or at least age bracket) during onboarding if needed for future compliance
- Don’t store raw ID docs in MVP
- Passwords never stored if using Cognito; if using local auth, hash with bcrypt/argon2
- Abuse controls:
  - rate limits
  - block/mute (can be MVP-lite)
  - report endpoint (optional MVP)

---

## 10) Coding standards (Cursor should follow)
- TypeScript strict mode
- NestJS modules organized by domain
- Services contain business logic; controllers thin
- Avoid “god files”; keep files focused
- Add indexes + constraints in schema
- Include tests for core services (at least unit tests for feed queries & graph logic)

---

## 11) File/Repo structure (suggested)
- `apps/api` (NestJS)
  - `src/modules/auth`
  - `src/modules/users`
  - `src/modules/teams`
  - `src/modules/topics`
  - `src/modules/posts`
  - `src/modules/follows`
  - `src/modules/feeds`
  - `src/modules/notifications`
  - `src/modules/search`
- `apps/mobile` (Expo RN)
- `packages/shared` (types/constants)

---

## 12) Current build plan (next steps)
1) **Design database schema** (Postgres)
2) **Define API endpoints** (REST)
Then:
3) Implement NestJS modules + migrations
4) Implement Expo screens + API client

---

## 13) Definitions / Glossary
- **Topic**: league/competition/theme (Premier League, La Liga, Ballers League, Transfer News, etc.)
- **Team**: football club/national team
- **Primary team**: user’s main supported team
- **Squad feed**: following feed
- **12th Man feed**: personalised topic/team feed

---

## 14) Non-goals for MVP
- Federation / AT Protocol compatibility
- Full-blown algorithmic ranking
- DMs
- Video processing
- Paid subscriptions

---

## 15) Questions we will decide during schema/endpoints
- Do posts require at least 1 tag (topic/team) or allow “general”?
- Do replies inherit tags from parent post or require tags explicitly?
- Trending: compute per topic only, or global + per topic?
- Search MVP: only topics + users, or full-text posts?

(If unsure, choose the simplest option that supports Squad + 12th Man feeds.)