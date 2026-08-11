// Shared shape of a feed post, matching what GET /feed/* returns.
// Used by the home feed screen and by the composer's optimistic insert.
export type FeedPost = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  users: { username: string; display_name: string; profile_image_url: string | null };
  post_teams: { teams: { id: string; name: string } }[];
  post_topics: { topics: { id: string; name: string } }[];
};
