export type Role = 'USER' | 'MODERATOR' | 'ADMIN';

export type Me = { id: string; role: Role };

export type ReportRow = {
  id: string;
  reason: string;
  details: string | null;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  created_at: string;
  resolved_at: string | null;
  reporter: { id: string; username: string };
  post: {
    id: string;
    content: string;
    created_at: string;
    hidden_at: string | null;
    hidden_reason: string | null;
    report_count: number;
    users: { id: string; username: string; display_name: string };
    media: { url: string }[];
  } | null;
  user: {
    id: string;
    username: string;
    display_name: string;
    suspended_until: string | null;
    banned_at: string | null;
    role: Role;
  } | null;
};

export type UserRow = {
  id: string;
  username: string;
  display_name: string;
  email: string;
  role: Role;
  age_tier: string;
  created_at: string;
  suspended_until: string | null;
  banned_at: string | null;
  reports_received: number;
  posts: number;
};

export type UserDetail = {
  id: string;
  username: string;
  display_name: string;
  email: string;
  bio: string | null;
  role: Role;
  age_tier: string;
  date_of_birth: string;
  created_at: string;
  suspended_until: string | null;
  banned_at: string | null;
  posts: { id: string; content: string; created_at: string; hidden_at: string | null; hidden_reason: string | null; report_count: number; media: { url: string }[] }[];
  reports_received: { id: string; reason: string; details: string | null; status: string; created_at: string; reporter: { username: string } }[];
  moderation_received: { id: string; action: string; note: string | null; created_at: string; actor: { username: string } | null }[];
};

export type ActionRow = {
  id: string;
  action: string;
  note: string | null;
  target_post_id: string | null;
  post_snapshot: string | null;
  created_at: string;
  actor: { id: string; username: string } | null;
  target_user: { id: string; username: string } | null;
};

export function userStatus(u: { suspended_until: string | null; banned_at: string | null }): 'banned' | 'suspended' | 'active' {
  if (u.banned_at) return 'banned';
  if (u.suspended_until && new Date(u.suspended_until).getTime() > Date.now()) return 'suspended';
  return 'active';
}
