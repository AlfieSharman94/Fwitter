// mobile/src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { bootstrapAuth, doSignIn, doSignOut, refreshAuth } from "./auth";
import { apiFetch } from "../api/client";
import { unregisterPushToken } from "../notifications/push";
import { setMe } from "./me";
import { onSessionLost } from "./session";

// What GET /users/me/profile says about where the signed-in user should be.
export type ProfileStatus = {
  onboarded: boolean;
  // A 13 to 15 year old whose parent or guardian has not confirmed yet.
  consentPending: boolean;
  guardianEmail: string | null;
  // The profile row is gone (e.g. the guardian declined and the account was deleted).
  profileMissing: boolean;
};

type AuthState = {
  isBootstrapping: boolean;
  isSignedIn: boolean;
  isOnboarded: boolean | null; // null = unknown, true/false = known
  consentPending: boolean | null; // null = unknown
  guardianEmail: string | null;
  signIn: (usernameOrEmail: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // null when the API could not be reached.
  checkOnboarding: () => Promise<boolean | null>;
  refreshAuthState: () => Promise<ProfileStatus | null>;
};

const AuthContext = createContext<AuthState | null>(null);

const UNKNOWN_PROFILE: ProfileStatus = { onboarded: false, consentPending: false, guardianEmail: null, profileMissing: false };

// null means "could not tell" (API unreachable): the gate then shows a retry screen
// instead of dropping a signed-in user into onboarding.
const loadProfileStatus = async (): Promise<ProfileStatus | null> => {
  try {
    const profile = await apiFetch("/users/me/profile", { method: "GET" });
    const user = profile?.user;
    // If profile exists and has is_onboarded flag, use it; otherwise the onboarding flow will verify.
    if (user?.is_onboarded === undefined) return UNKNOWN_PROFILE;
    return {
      onboarded: !!user.is_onboarded,
      consentPending: !!user.consent_pending,
      guardianEmail: user.guardian_consent?.guardian_email ?? null,
      profileMissing: false,
    };
  } catch (e: any) {
    const errorMsg = e?.message || "";
    if (errorMsg.includes("Can’t reach") || errorMsg.includes("Network request failed") || errorMsg.includes("Failed to fetch")) {
      return null;
    }
    // Anything else reads as "not onboarded". 404 is also remembered, since it means the
    // profile row itself is gone.
    const profileMissing = errorMsg.includes("profile_not_found") || errorMsg.includes("404");
    return { ...UNKNOWN_PROFILE, profileMissing };
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isBootstrapping, setBootstrapping] = useState(true);
  const [isSignedIn, setSignedIn] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);
  const [consentPending, setConsentPending] = useState<boolean | null>(null);
  const [guardianEmail, setGuardianEmail] = useState<string | null>(null);

  const clearStatus = () => {
    setIsOnboarded(null);
    setConsentPending(null);
    setGuardianEmail(null);
  };

  const applyStatus = (status: ProfileStatus | null) => {
    if (!status) {
      clearStatus();
      return;
    }
    setIsOnboarded(status.onboarded);
    setConsentPending(status.consentPending);
    setGuardianEmail(status.guardianEmail);
  };

  const signOut = async () => {
    // Needs the session, so it runs before the tokens are cleared.
    await unregisterPushToken();
    try {
      await doSignOut();
    } catch {
      // Already signed out (e.g. the Cognito user was just deleted): local state still resets.
    }
    setMe(null);
    setSignedIn(false);
    clearStatus();
  };

  useEffect(() => {
    (async () => {
      try {
        const user = await bootstrapAuth();
        if (user) {
          setSignedIn(true);
          // Check onboarding status (silently fail if API is unavailable)
          try {
            applyStatus(await loadProfileStatus());
          } catch (e: any) {
            // If API is unavailable during bootstrap, just set to null (unknown)
            // Don't log errors during bootstrap to reduce noise
            clearStatus();
          }
        } else {
          setSignedIn(false);
          clearStatus();
        }
      } catch (e: any) {
        // Silent failure on bootstrap
        setSignedIn(false);
        clearStatus();
      } finally {
        setBootstrapping(false);
      }
    })();
  }, []);

  // The API client signs out locally on an expired or refused session; mirror that here
  // so the gate sends the user to Welcome straight away.
  useEffect(
    () =>
      onSessionLost(() => {
        setMe(null);
        setSignedIn(false);
        clearStatus();
      }),
    []
  );

  // Proactively refresh tokens when the app returns to the foreground.
  // This covers the case where the user backgrounds the app for >1 hour.
  const appState = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current !== 'active' && nextState === 'active' && isSignedIn) {
        const ok = await refreshAuth();
        if (!ok) {
          // Refresh token expired or revoked — force sign-out
          await doSignOut();
          setSignedIn(false);
          clearStatus();
        }
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, [isSignedIn]);

  const value = useMemo<AuthState>(
    () => ({
      isBootstrapping,
      isSignedIn,
      isOnboarded,
      consentPending,
      guardianEmail,
      signIn: async (u, p) => {
        await doSignIn(u, p);

        // Sanity check: verify the session works with the API
        try {
          await apiFetch("/users/me");
          setSignedIn(true);
          // Check onboarding status after sign in
          applyStatus(await loadProfileStatus());
        } catch (e: any) {
          const errorMsg = e?.message || "";

          // If it's a network error (API server not running), still allow sign-in
          // but show a helpful error message
          if (errorMsg.includes("Can’t reach") || errorMsg.includes("Network request failed") || errorMsg.includes("Failed to fetch")) {
            // Cognito worked but the API is unreachable: stay signed in, the gate shows a retry screen.
            setSignedIn(true);
            clearStatus();
            throw new Error("Signed in, but Fwitter can’t be reached right now. Check your connection and try again.");
          }

          // For other errors (401, etc.), treat as authentication failure
          await doSignOut();
          setSignedIn(false);
          clearStatus();
          // Preserve the original error message if it's more specific
          throw new Error(errorMsg || "Session invalid—please sign in again");
        }
      },
      signOut,
      checkOnboarding: async () => {
        const status = await loadProfileStatus();
        applyStatus(status);
        return status ? status.onboarded : null;
      },
      // Re-syncs isSignedIn/isOnboarded with reality. The onboarding screens
      // (topics.tsx, confirm-signup.tsx) sign in via the raw auth.ts functions
      // directly rather than this context's signIn() above, so without this,
      // this context still thinks the user is signed out right after they
      // finish onboarding — and the navigation gate in _layout.tsx bounces
      // them back out past the screen they just completed. Call this once,
      // right before navigating away, after onboarding finishes. The pending
      // consent screen also calls it to see whether the guardian has confirmed.
      refreshAuthState: async () => {
        const user = await bootstrapAuth();
        if (!user) {
          setSignedIn(false);
          clearStatus();
          return null;
        }
        const status = await loadProfileStatus();
        if (status?.profileMissing && consentPending === true) {
          // We were waiting for consent and the profile is gone: the guardian declined and
          // the account was deleted. Drop the session rather than restarting onboarding.
          await signOut();
          return status;
        }
        setSignedIn(true);
        applyStatus(status);
        return status;
      },
    }),
    [isBootstrapping, isSignedIn, isOnboarded, consentPending, guardianEmail]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
