// Shared shape of a post as returned by every post endpoint (feeds, profile
// posts, post detail, replies, create, bookmarks). Mirrors api/src/posts/post-shape.ts.
export type FeedPostBase = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  parent_post_id: string | null;
  // Set when this post quotes another. Both this and quoted_post become null if that post is deleted.
  quoted_post_id: string | null;
  reply_count: number;
  // Counts are null unless the viewer is the author: they are hidden from everyone else.
  like_count: number | null;
  liked_by_me: boolean;
  bookmarked_by_me: boolean;
  repost_count: number | null;
  reposted_by_me: boolean;
  users: { username: string; display_name: string; profile_image_url: string | null };
  post_teams: { teams: { id: string; name: string } }[];
  post_topics: { topics: { id: string; name: string } }[];
};

export type FeedPostQuoting = FeedPostBase & { quoted_post: FeedPostBase | null };

// A plain repost is a wrapper row (empty content) whose repost_of is the post to show,
// credited to the wrapper's author.
export type FeedPost = FeedPostQuoting & { repost_of: FeedPostQuoting | null };
