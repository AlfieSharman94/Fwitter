// Unread notification count shared between the tab badge and the Activity screen.
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

let count = 0;
const listeners = new Set<(n: number) => void>();

export function setUnread(n: number) {
  count = n;
  listeners.forEach((l) => l(n));
}

export async function refreshUnread() {
  try {
    const data = await apiFetch("/notifications/unread-count");
    setUnread(typeof data?.count === "number" ? data.count : 0);
  } catch {
    // Keep the last known value; the next refresh will correct it.
  }
}

export function useUnreadCount() {
  const [n, setN] = useState(count);
  useEffect(() => {
    listeners.add(setN);
    return () => {
      listeners.delete(setN);
    };
  }, []);
  return n;
}
