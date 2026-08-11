# Database Schema — Fwitter (PostgreSQL)

Note: Prisma is used (introspected from existing DB). Tables are in schema public.

---

## users
Stores app profile + links to Cognito.

Key columns:
- id (uuid, PK)
- username (varchar(30), unique case-insensitive via expression index)
- display_name (varchar(100))
- email (varchar(255), unique case-insensitive via expression index)
- bio (text, nullable)
- profile_image_url (text, nullable)
- date_of_birth (date)
- is_onboarded (boolean, default false)
- cognito_sub (varchar(64), unique, nullable)
- created_at, updated_at, deleted_at (timestamptz)

Indexes:
- unique lower(username)
- unique lower(email)
- unique cognito_sub

Relations:
- users -> posts (1:M)
- users -> follows (as follower and following)
- users -> user_teams, user_topics

---

## follows
User follows relationship.

Key columns:
- follower_id (uuid, FK -> users.id)
- following_id (uuid, FK -> users.id)
- created_at (timestamptz, default now())

Constraints:
- Composite primary key: (follower_id, following_id) - ensures unique follow relationships
- Foreign keys with CASCADE delete
- Self-follow prevention enforced in application logic (not DB constraint)

Indexes:
- @@index([follower_id]) - optimized for "who does this user follow" queries
- @@index([following_id]) - optimized for "who follows this user" queries

---

## teams
Football teams master table.

Key columns:
- id (uuid, PK)
- name (text/varchar)
- created_at/updated_at (if present)

Index:
- expression index on lower(name) (Prisma warns expression index)

---

## topics
Topics master table (e.g. Premier League, La Liga, Bundesliga).

Key columns:
- id (uuid, PK)
- name (text/varchar)

Index:
- expression index on lower(name) (Prisma warns expression index)

---

## user_teams
Join table for users selecting teams (primary + additional).

Key columns (typical):
- user_id (uuid, FK -> users.id)
- team_id (uuid, FK -> teams.id)
- is_primary (boolean) OR separate primary_team_id stored elsewhere (depends on your implementation)
- created_at (if present)

Notes:
- Your API enforces: primaryTeamId must be included in teamIds.

---

## user_topics
Join table for users selecting topics.

Key columns (typical):
- user_id (uuid, FK -> users.id)
- topic_id (uuid, FK -> topics.id)

---

## posts
Posts and replies (threading).

Key columns:
- id (uuid, PK)
- author_id (uuid, FK -> users.id)
- content (text, not null)
- parent_post_id (uuid, nullable FK -> posts.id)  <-- replies use this
- created_at, updated_at, deleted_at (timestamptz)

Indexes:
- (author_id, created_at DESC)
- (parent_post_id)

Relations:
- posts -> post_teams (1:M)
- posts -> post_topics (1:M)
- posts -> posts via parent_post_id (threading)

---

## post_teams
Join table linking posts to teams (for personalization + filtering).

Key columns (typical):
- post_id (uuid, FK -> posts.id)
- team_id (uuid, FK -> teams.id)

---

## post_topics
Join table linking posts to topics.

Key columns (typical):
- post_id (uuid, FK -> posts.id)
- topic_id (uuid, FK -> topics.id)

---

## Seeded data counts (example)
(From your DB check)
- teams: 15
- topics: 10

---

## Known Prisma limitations
- Expression indexes (lower(name), lower(email), lower(username)) are not fully supported for migrations in Prisma Client.
- Check constraints (no_self_follow) are not fully represented in Prisma Client.


Quick note

In DB_schema.md I used “typical” join-table columns for a few tables where we haven’t pasted \d output yet (follows/user_teams/user_topics/post_teams/post_topics). That’s fine for documentation, but if you want it perfect, run:

docker exec -it fwitter-db psql -U fwitter -d fwitter_dev -c "\d follows"
docker exec -it fwitter-db psql -U fwitter -d fwitter_dev -c "\d user_teams"
docker exec -it fwitter-db psql -U fwitter -d fwitter_dev -c "\d user_topics"
docker exec -it fwitter-db psql -U fwitter -d fwitter_dev -c "\d post_teams"
docker exec -it fwitter-db psql -U fwitter -d fwitter_dev -c "\d post_topics"

Then you can replace the “typical” sections with exact columns.