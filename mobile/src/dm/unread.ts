// Unread message count for the Messages tab badge.
import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

let count = 0;
const listeners = new Set<(n: number) => void>();

export function setDmUnread(n: number) {
  count = n;
  listeners.forEach((l) => l(n));
}

export async function refreshDmUnread() {
  try {
    const data = await apiFetch("/dm/unread-count");
    setDmUnread(typeof data?.count === "number" ? data.count : 0);
  } catch {
    // Keep the last value.
  }
}

export function useDmUnread() {
  const [n, setN] = useState(count);
  useEffect(() => {
    listeners.add(setN);
    return () => {
      listeners.delete(setN);
    };
  }, []);
  return n;
}

export type Conversation = {
  id: string;
  other: { id: string; username: string; display_name: string; profile_image_url: string | null; verified_at: string | null };
  last_message_at: string | null;
  last_message_preview: string | null;
  unread: number;
  can_message: boolean;
  reason: string | null;
};

export type Message = { id: string; sender_id: string; content: string; created_at: string };

export function dmReasonText(reason: string | null | undefined) {
  switch (reason) {
    case "not_mutual":
      return "You can message each other once you both follow each other.";
    case "age_tier":
      return "Messaging is only available between accounts in the same age group.";
    case "blocked":
      return "You can’t message this account.";
    case "unavailable":
      return "This account isn’t available.";
    default:
      return "You can’t message this account right now.";
  }
}

export function friendlyDmError(e: any, fallback: string) {
  const m: string = e?.message ?? "";
  if (m.startsWith("dm_")) return dmReasonText(m.slice(3));
  if (m === "content_not_allowed") return "That message contains language we don’t allow on Fwitter.";
  return m || fallback;
}
