// Linked accounts: the sharer's chosen activity shows in an 18+ viewer's app.
import { apiFetch } from "../api/client";

export type LinkShare = "POSTS" | "REPLIES" | "REPOSTS" | "QUOTES" | "FOLLOWS" | "MESSAGES";

export const SHARE_OPTIONS: { key: LinkShare; label: string; hint: string }[] = [
  { key: "POSTS", label: "Posts", hint: "Everything you post" },
  { key: "REPLIES", label: "Replies", hint: "Your replies to other posts" },
  { key: "REPOSTS", label: "Reposts", hint: "Posts you repost" },
  { key: "QUOTES", label: "Quotes", hint: "Posts you quote" },
  { key: "FOLLOWS", label: "New follows", hint: "Who you start following" },
  { key: "MESSAGES", label: "Messages", hint: "Messages you send. Never the other person's" },
];

export const shareLabel = (s: LinkShare) => SHARE_OPTIONS.find((o) => o.key === s)?.label ?? s;

export type Link = {
  id: string;
  role: "sharer" | "viewer";
  status: "PENDING" | "ACTIVE";
  shares: LinkShare[];
  requestedShares: LinkShare[];
  other: { id: string; username: string; displayName: string; avatarUrl: string | null };
  canUnlink: boolean;
  needsStayAnswer: boolean;
  createdAt: string;
};

export async function fetchLinks(): Promise<Link[]> {
  const data = await apiFetch("/links");
  return data.links ?? [];
}

export function friendlyLinkError(e: any): string {
  switch (e?.message) {
    case "link_viewer_too_young":
      return "You can only link to someone aged 18 or over.";
    case "link_limit_reached":
      return "You can link to up to two people.";
    case "link_exists":
      return "You've already asked to link with this person.";
    case "unlink_needs_viewer":
      return "Until you're 16, only the person you're linked to can unlink.";
    case "blocked":
      return "You can't link with this account.";
    default:
      return e?.message ?? "Something went wrong. Please try again.";
  }
}
