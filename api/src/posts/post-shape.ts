import { Prisma } from '@prisma/client';

// The one post shape every post-returning endpoint uses (feeds, profile posts,
// post detail, replies, create). Add new per-post fields here so they show up
// everywhere at once.
export const feedPostSelect = {
  id: true,
  content: true,
  created_at: true,
  author_id: true,
  parent_post_id: true,
  users: { select: { username: true, display_name: true, profile_image_url: true } },
  post_teams: { select: { teams: { select: { id: true, name: true } } } },
  post_topics: { select: { topics: { select: { id: true, name: true } } } },
  // other_posts is the self-relation back-reference: this post's replies.
  _count: { select: { other_posts: true } },
} satisfies Prisma.postsSelect;

type RawFeedPost = Prisma.postsGetPayload<{ select: typeof feedPostSelect }>;

export function toFeedPost(row: RawFeedPost) {
  const { _count, ...rest } = row;
  return { ...rest, reply_count: _count.other_posts };
}

export type FeedPost = ReturnType<typeof toFeedPost>;
