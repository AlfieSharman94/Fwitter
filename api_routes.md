# API Routes — Fwitter (NestJS)

Base URLs:
- Local: http://localhost:3000
- LAN (phone): http://192.168.0.36:3000

Auth:
- All protected endpoints require header:
  Authorization: Bearer <COGNITO_ID_TOKEN>
- Dev token helper:
  export TOKEN="$(node scripts/get-id-token-srp.mjs)"

---

## Auth (Public)

### GET /auth/username-available?username=<string>
Checks if a username is available (case-insensitive).
Response:
- 200 { "available": true|false }

### GET /auth/email-available?email=<string>
Checks if an email is available (case-insensitive).
Response:
- 200 { "available": true|false }

---

## Users (Protected)

### GET /users/me
Returns the authenticated user's identity (from JWT / DB linkage).
Response:
- 200 { ok: true, user: { sub: string, email?: string } }

### POST /users/me/profile
Creates or returns an existing user profile row linked to Cognito user.
Body:
- { username: string, displayName: string, dateOfBirth: "YYYY-MM-DD" }
Response:
- 200 { user: { id, username, display_name, email, is_onboarded, ... } }

### PUT /users/me/teams
Sets primary + additional teams for the current user.
Rules:
- primaryTeamId MUST be included in teamIds.
Body:
- {
    primaryTeamId: string,
    teamIds: string[]
  }
Response:
- 200 { ok: true }

### PUT /users/me/topics
Sets topics for the current user.
Body:
- { topicIds: string[] }
Response:
- 200 { ok: true }

### POST /users/me/onboarding/complete
Marks onboarding as complete.
Response:
- 200 { ok: true }

### GET /users/:id
Returns public profile for a user (requires auth to determine isFollowing).
Response:
- 200 {
    id: string,
    username: string,
    displayName: string,
    avatarUrl: string | null,
    createdAt: string (ISO),
    followersCount: number,
    followingCount: number,
    postsCount: number,
    isFollowing: boolean,
    isSelf: boolean
  }
- 400 { message: "viewer_profile_not_found" }
- 404 { message: "user_not_found" }

### POST /users/:id/follow
Follow a user (idempotent).
Response:
- 200 {
    isFollowing: true,
    followersCount: number,
    followingCount: number
  }
- 400 { message: "cannot_follow_self" | "viewer_profile_not_found" }
- 404 { message: "user_not_found" }

### DELETE /users/:id/follow
Unfollow a user (idempotent).
Response:
- 200 {
    isFollowing: false,
    followersCount: number,
    followingCount: number
  }
- 400 { message: "viewer_profile_not_found" }

### GET /users/:id/followers?limit=<n>
Get list of users following the target user.
Query params:
- limit (optional, default 20, clamped 1-50)
Response:
- 200 {
    users: [{
      id: string,
      username: string,
      displayName: string,
      avatarUrl: string | null,
      isFollowing: boolean
    }]
  }
- 400 { message: "viewer_profile_not_found" }
- 404 { message: "user_not_found" }

### GET /users/:id/following?limit=<n>
Get list of users the target user is following.
Query params:
- limit (optional, default 20, clamped 1-50)
Response:
- 200 {
    users: [{
      id: string,
      username: string,
      displayName: string,
      avatarUrl: string | null,
      isFollowing: boolean
    }]
  }
- 400 { message: "viewer_profile_not_found" }
- 404 { message: "user_not_found" }

---

## Teams (Protected)

### GET /teams/search?q=<string>
Search teams by name (supports empty q for “all” depending on implementation).
Response:
- 200 { teams: [{ id, name, ... }], ... }

---

## Topics (Protected)

### GET /topics/search?q=<string>
Search topics by name (supports empty q for “all” depending on implementation).
Response:
- 200 { topics: [{ id, name, ... }], ... }

---

## Posts (Protected)

### POST /posts
Creates a post OR reply (thread) depending on parentPostId.
Body:
- {
    content: string (max 500),
    parentPostId?: string | null,
    teamIds?: string[],
    topicIds?: string[]
  }
Response:
- 201 { ok: true, post: { id, created_at } }

### GET /posts/:id
Fetch a single post.
Response:
- 200 { post: { id, content, created_at, parent_post_id, users{...}, post_teams[], post_topics[] } }

### GET /posts/:id/replies?cursor=<ISO>&limit=<n>
Fetch replies to a post (posts where parent_post_id = :id).
Response:
- 200 { replies: [...], nextCursor: string|null }

---

## Feeds (Protected)

### GET /feed/12th-man?cursor=<ISO>&limit=<n>
Personalized feed:
- Posts that match user’s selected teams/topics (via post_teams/post_topics)
- (Optional improvement) fallback to latest posts if none match
Response:
- 200 { posts: [...], nextCursor: string|null }

### GET /feed/squad?cursor=<ISO>&limit=<n>
Following feed:
- Posts authored by users the current user follows
Response:
- 200 { posts: [...], nextCursor: string|null }

---

## Search (Protected)

### GET /search/users?q=<string>&limit=<n>
Search users by username or display name (case-insensitive).
Query params:
- q (required, min 2 chars, trimmed)
- limit (optional, default 20, clamped 1-50)
Response:
- 200 {
    users: [{
      id: string,
      username: string,
      displayName: string,
      avatarUrl: string | null,
      isFollowing: boolean
    }]
  }
- 400 { message: "query_required_min_2_chars" | "viewer_profile_not_found" }

---

## Not yet implemented (Planned)
- Follow lists:
  - GET /users/:id/followers
  - GET /users/:id/following
- Notifications:
  - GET /notifications
  - POST /notifications/read