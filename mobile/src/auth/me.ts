// The signed-in user's id and username, loaded once the tabs mount. Lets components
// like PostCard know whether a post is the viewer's own without each list fetching it.
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

export type Me = { id: string; username: string };

let me: Me | null = null;
const listeners = new Set<(m: Me | null) => void>();

export function getMe() {
  return me;
}

export function setMe(next: Me | null) {
  me = next;
  listeners.forEach((l) => l(next));
}

export async function loadMe() {
  try {
    const data = await apiFetch("/users/me/profile");
    if (data?.user?.id) setMe({ id: data.user.id, username: data.user.username });
  } catch {
    // Leave whatever we had; the next mount retries.
  }
}

export function useMe() {
  const [current, setCurrent] = useState(me);
  useEffect(() => {
    listeners.add(setCurrent);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  return current;
}
