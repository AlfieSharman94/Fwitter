// Tiny event bus between screens that own post lists:
// - the composer hands a freshly created post to the home feed (no refetch)
// - deleting a post, or blocking someone, drops the affected posts from every open list
import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { FeedPost } from "./feedTypes";

type PostListener = (post: FeedPost) => void;
type IdListener = (id: string) => void;

const newPostListeners = new Set<PostListener>();
const removedListeners = new Set<IdListener>();
const blockedListeners = new Set<IdListener>();

export function onNewPost(listener: PostListener): () => void {
  newPostListeners.add(listener);
  return () => {
    newPostListeners.delete(listener);
  };
}

export function publishNewPost(post: FeedPost): void {
  newPostListeners.forEach((listener) => listener(post));
}

export function onPostRemoved(listener: IdListener): () => void {
  removedListeners.add(listener);
  return () => {
    removedListeners.delete(listener);
  };
}

export function publishPostRemoved(postId: string): void {
  removedListeners.forEach((listener) => listener(postId));
}

export function publishAuthorBlocked(userId: string): void {
  blockedListeners.forEach((listener) => listener(userId));
}

// Keeps a screen's post list in step with deletions and blocks made anywhere in the app.
export function useFeedEvents(setPosts: Dispatch<SetStateAction<FeedPost[]>>) {
  useEffect(() => {
    const offRemoved = onPostRemoved((id) => {
      setPosts((prev) => prev.filter((p) => p.id !== id && p.repost_of?.id !== id));
    });
    const onBlocked: IdListener = (userId) => {
      setPosts((prev) => prev.filter((p) => p.author_id !== userId && p.repost_of?.author_id !== userId));
    };
    blockedListeners.add(onBlocked);
    return () => {
      offRemoved();
      blockedListeners.delete(onBlocked);
    };
  }, [setPosts]);
}
