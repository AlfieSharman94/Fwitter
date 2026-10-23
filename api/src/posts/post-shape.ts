import { Prisma } from '@prisma/client';

// The one post shape every post-returning endpoint uses (feeds, profile posts,
// post detail, replies, create, bookmarks). Add new per-post fields here so they
// show up everywhere at once.
//
// It depends on who is looking: `liked_by_me` / `bookmarked_by_me` come from
// relations filtered to the viewer, and `like_count` is only revealed to the
// post's author (product decision for the under-16 audience; everyone else
// gets null).
export function feedPostSelect(viewerId: string) {
  return {
    id: true,
    content: true,
    created_at: true,
    author_id: true,
    parent_post_id: true,
    users: { select: { username: true, display_name: true, profile_image_url: true } },
    post_teams: { select: { teams: { select: { id: true, name: true } } } },
    post_topics: { select: { topics: { select: { id: true, name: true } } } },
    post_likes: { where: { user_id: viewerId }, select: { user_id: true } },
    bookmarks: { where: { user_id: viewerId }, select: { user_id: true } },
    // other_posts is the self-relation back-reference: this post's replies.
    _count: { select: { other_posts: true, post_likes: true } },
  } satisfies Prisma.postsSelect;
}

type RawFeedPost = Prisma.postsGetPayload<{ select: ReturnType<typeof feedPostSelect> }>;

export function toFeedPost(row: RawFeedPost, viewerId: string) {
  const { _count, post_likes, bookmarks, ...rest } = row;
  return {
    ...rest,
    reply_count: _count.other_posts,
    like_count: row.author_id === viewerId ? _count.post_likes : null,
    liked_by_me: post_likes.length > 0,
    bookmarked_by_me: bookmarks.length > 0,
  };
}

export type FeedPost = ReturnType<typeof toFeedPost>;
