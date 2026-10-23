// Shared shape of a post as returned by every post endpoint (feeds, profile
// posts, post detail, replies, create). Mirrors api/src/posts/post-shape.ts.
export type FeedPost = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  parent_post_id: string | null;
  reply_count: number;
  users: { username: string; display_name: string; profile_image_url: string | null };
  post_teams: { teams: { id: string; name: string } }[];
  post_topics: { topics: { id: string; name: string } }[];
};
