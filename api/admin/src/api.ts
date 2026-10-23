import { idToken } from './auth';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Same origin as the API when served from it; VITE_API_BASE_URL overrides for other setups.
const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await idToken();
  if (!token) throw new ApiError(401, 'not_signed_in');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? `request_failed_${res.status}`);
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

export const fmt = {
  when(iso: string | null | undefined) {
    return iso ? new Date(iso).toLocaleString() : '';
  },
  ago(iso: string) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  },
};

// Internal tool: a browser prompt is good enough for the optional note on an action.
export function askNote(label: string): string | undefined | null {
  const note = window.prompt(label, '');
  if (note === null) return null; // cancelled
  return note.trim() || undefined;
}
