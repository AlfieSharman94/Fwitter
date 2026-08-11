// Tiny event bus so the compose modal can hand a freshly-created post to the
// home feed screen without a full refetch. The home feed subscribes; the
// composer publishes on a successful POST /posts.
import type { FeedPost } from "./feedTypes";

type Listener = (post: FeedPost) => void;

const listeners = new Set<Listener>();

export function onNewPost(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishNewPost(post: FeedPost): void {
  listeners.forEach((listener) => listener(post));
}
