// mobile/src/api/client.ts
import { getIdToken, doSignOut } from "../auth/auth";
import { API_BASE_URL } from "../config";

// Use environment variable if set and not localhost (localhost doesn't work on physical devices),
// otherwise use config file
const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const BASE_URL = (envUrl && !envUrl.includes('localhost')) ? envUrl : API_BASE_URL;

type FetchOptions = RequestInit & { auth?: boolean };

export async function apiFetch(path: string, options: FetchOptions = {}) {
  const { auth = true, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as any),
  };

  if (auth) {
    const idToken = await getIdToken();
    if (!idToken) {
      // Not signed in locally — force sign out cleanup.
      await doSignOut();
      throw new Error("Not authenticated");
    }
    finalHeaders.Authorization = `Bearer ${idToken}`;
  }

  const fullUrl = `${BASE_URL}${path}`;

  let res: Response;
  try {
    res = await fetch(fullUrl, {
      ...rest,
      headers: finalHeaders,
    });
  } catch (e: any) {
    // Network error (can't reach server)
    const errorMsg = e?.message || "Network request failed";
    if (errorMsg.includes("Network request failed") || errorMsg.includes("Failed to fetch")) {
      // Log a single concise error message instead of multiple lines
      console.error(`[API] Cannot reach server at ${BASE_URL}. Is the API running? (cd api && npm run start:dev)`);
      throw new Error(`Cannot reach API at ${BASE_URL}. Ensure the NestJS API server is running (cd api && npm run start:dev) and the IP address in mobile/src/config.ts matches your machine's IP.`);
    }
    throw e;
  }

  if (res.status === 401) {
    // Token expired / invalid → clear local auth and let router gate push to sign-in
    await doSignOut();
    throw new Error("Session expired. Please sign in again.");
  }

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    // Log error details for debugging
    console.error(`API Error [${res.status}]:`, fullUrl, body);
    const msg = (body && (body.message || body.error)) || `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return body;
}
