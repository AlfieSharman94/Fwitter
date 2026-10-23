// Like / bookmark / repost toggles shared by every screen that renders a PostCard.
// Each screen owns its own post list state, so the toggle takes a `patch`
// callback that updates the post wherever it lives. Updates are optimistic
// and roll back on failure; a per-post in-flight guard stops double taps.
import { apiFetch } from "../api/client";
import type { FeedPost, FeedPostBase } from "./feedTypes";

export type PostPatch = Partial<
  Pick<FeedPostBase, "liked_by_me" | "like_count" | "bookmarked_by_me" | "reposted_by_me" | "repost_count">
>;
export type PatchPost = (postId: string, patch: PostPatch) => void;

// Applies a patch to a list: to the post itself, and to it where it appears as the
// original inside a plain repost row (actions on a repost card target the original).
export function patchPostList<T extends FeedPost>(list: T[], postId: string, patch: PostPatch): T[] {
  return list.map((p) => {
    if (p.id === postId) return { ...p, ...patch };
    if (p.repost_of && p.repost_of.id === postId) return { ...p, repost_of: { ...p.repost_of, ...patch } };
    return p;
  });
}

const inFlight = new Set<string>();

export async function toggleLike(post: FeedPostBase, patch: PatchPost) {
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

export async function toggleBookmark(post: FeedPostBase, patch: PatchPost) {
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

// Plain repost on/off. Quote posts go through the composer instead.
export async function toggleRepost(post: FeedPostBase, patch: PatchPost) {
  const key = `${post.id}:repost`;
  if (inFlight.has(key)) return;
  inFlight.add(key);

  const wasReposted = post.reposted_by_me;
  const optimisticCount =
    post.repost_count === null ? null : Math.max(0, post.repost_count + (wasReposted ? -1 : 1));
  patch(post.id, { reposted_by_me: !wasReposted, repost_count: optimisticCount });

  try {
    const res = await apiFetch(`/posts/${post.id}/repost`, { method: wasReposted ? "DELETE" : "POST" });
    patch(post.id, { reposted_by_me: res.reposted, repost_count: res.repost_count ?? null });
  } catch {
    patch(post.id, { reposted_by_me: wasReposted, repost_count: post.repost_count });
  } finally {
    inFlight.delete(key);
  }
}
