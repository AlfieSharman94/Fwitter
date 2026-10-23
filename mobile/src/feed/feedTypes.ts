// Shared shape of a post as returned by every post endpoint (feeds, profile
// posts, post detail, replies, create, bookmarks). Mirrors api/src/posts/post-shape.ts.
export type FeedPost = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  parent_post_id: string | null;
  reply_count: number;
  // null unless the viewer is the author: like counts are hidden from everyone else.
  like_count: number | null;
  liked_by_me: boolean;
  bookmarked_by_me: boolean;
  users: { username: string; display_name: string; profile_image_url: string | null };
  post_teams: { teams: { id: string; name: string } }[];
  post_topics: { topics: { id: string; name: string } }[];
};
