// Like / bookmark toggles shared by every screen that renders a PostCard.
// Each screen owns its own post list state, so the toggle takes a `patch`
// callback that updates the post wherever it lives. Updates are optimistic
// and roll back on failure; a per-post in-flight guard stops double taps.
import { apiFetch } from "../api/client";
import type { FeedPost } from "./feedTypes";

export type PostPatch = Partial<Pick<FeedPost, "liked_by_me" | "like_count" | "bookmarked_by_me">>;
export type PatchPost = (postId: string, patch: PostPatch) => void;

const inFlight = new Set<string>();

export async function toggleLike(post: FeedPost, patch: PatchPost) {
  const key = `${post.id}:like`;
  if (inFlight.has(key)) return;
  inFlight.add(key);

  const wasLiked = post.liked_by_me;
  const optimisticCount =
    post.like_count === null ? null : Math.max(0, post.like_count + (wasLiked ? -1 : 1));
  patch(post.id, { liked_by_me: !wasLiked, like_count: optimisticCount });

  try {
    const res = await apiFetch(`/posts/${post.id}/like`, { method: wasLiked ? "DELETE" : "POST" });
    patch(post.id, { liked_by_me: res.liked, like_count: res.like_count ?? null });
  } catch {
    patch(post.id, { liked_by_me: wasLiked, like_count: post.like_count });
  } finally {
    inFlight.delete(key);
  }
}

export async function toggleBookmark(post: FeedPost, patch: PatchPost) {
  const key = `${post.id}:bookmark`;
  if (inFlight.has(key)) return;
  inFlight.add(key);

  const wasBookmarked = post.bookmarked_by_me;
  patch(post.id, { bookmarked_by_me: !wasBookmarked });

  try {
    const res = await apiFetch(`/posts/${post.id}/bookmark`, { method: wasBookmarked ? "DELETE" : "POST" });
    patch(post.id, { bookmarked_by_me: res.bookmarked });
  } catch {
    patch(post.id, { bookmarked_by_me: wasBookmarked });
  } finally {
    inFlight.delete(key);
  }
}
