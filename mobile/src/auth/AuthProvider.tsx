// mobile/src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { bootstrapAuth, doSignIn, doSignOut, refreshAuth } from "./auth";
import { apiFetch } from "../api/client";
import { unregisterPushToken } from "../notifications/push";
import { setMe } from "./me";
import { onSessionLost } from "./session";

type AuthState = {
  isBootstrapping: boolean;
  isSignedIn: boolean;
  isOnboarded: boolean | null; // null = unknown, true/false = known
  signIn: (usernameOrEmail: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  // null when the API could not be reached.
  checkOnboarding: () => Promise<boolean | null>;
  refreshAuthState: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isBootstrapping, setBootstrapping] = useState(true);
  const [isSignedIn, setSignedIn] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  // null means "could not tell" (API unreachable): the gate then shows a retry screen
  // instead of dropping a signed-in user into onboarding.
  const checkOnboardingStatus = async (): Promise<boolean | null> => {
    try {
      // Try to get user profile to check if they're onboarded
      const profile = await apiFetch("/users/me/profile", { method: "GET" });
      // If profile exists and has is_onboarded flag, use it
      if (profile?.user?.is_onboarded !== undefined) {
        return profile.user.is_onboarded;
      }
      // Default to not onboarded - onboarding flow will verify
      return false;
    } catch (e: any) {
      const errorMsg = e?.message || "";
      // If API is unavailable, don't throw - just return false (not onboarded)
      // This prevents errors during bootstrap when API server is down
      if (errorMsg.includes("Can’t reach") || errorMsg.includes("Network request failed") || errorMsg.includes("Failed to fetch")) {
        return null;
      }
      // 404 means profile doesn't exist - not onboarded
      if (errorMsg.includes("profile_not_found") || errorMsg.includes("404")) {
        return false;
      }
      // Can't determine - assume not onboarded
      return false;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const user = await bootstrapAuth();
        if (user) {
          setSignedIn(true);
          // Check onboarding status (silently fail if API is unavailable)
          try {
            const onboarded = await checkOnboardingStatus();
            setIsOnboarded(onboarded);
          } catch (e: any) {
            // If API is unavailable during bootstrap, just set to null (unknown)
            // Don't log errors during bootstrap to reduce noise
            setIsOnboarded(null);
          }
        } else {
          setSignedIn(false);
          setIsOnboarded(null);
        }
      } catch (e: any) {
        // Silent failure on bootstrap
        setSignedIn(false);
        setIsOnboarded(null);
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
        setIsOnboarded(null);
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
          setIsOnboarded(null);
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
      signIn: async (u, p) => {
        await doSignIn(u, p);
        
        // Sanity check: verify the session works with the API
        try {
          await apiFetch("/users/me");
          setSignedIn(true);
          // Check onboarding status after sign in
          const onboarded = await checkOnboardingStatus();
          setIsOnboarded(onboarded);
        } catch (e: any) {
          const errorMsg = e?.message || "";
          
          // If it's a network error (API server not running), still allow sign-in
          // but show a helpful error message
          if (errorMsg.includes("Can’t reach") || errorMsg.includes("Network request failed") || errorMsg.includes("Failed to fetch")) {
            // Cognito worked but the API is unreachable: stay signed in, the gate shows a retry screen.
            setSignedIn(true);
            setIsOnboarded(null);
            throw new Error("Signed in, but Fwitter can’t be reached right now. Check your connection and try again.");
          }
          
          // For other errors (401, etc.), treat as authentication failure
          await doSignOut();
          setSignedIn(false);
          setIsOnboarded(null);
          // Preserve the original error message if it's more specific
          throw new Error(errorMsg || "Session invalid—please sign in again");
        }
      },
      signOut: async () => {
        // Needs the session, so it runs before the tokens are cleared.
        await unregisterPushToken();
        try {
          await doSignOut();
        } catch {
          // Already signed out (e.g. the Cognito user was just deleted): local state still resets.
        }
        setMe(null);
        setSignedIn(false);
        setIsOnboarded(null);
      },
      checkOnboarding: async () => {
        const onboarded = await checkOnboardingStatus();
        setIsOnboarded(onboarded);
        return onboarded;
      },
      // Re-syncs isSignedIn/isOnboarded with reality. The onboarding screens
      // (topics.tsx, confirm-signup.tsx) sign in via the raw auth.ts functions
      // directly rather than this context's signIn() above, so without this,
      // this context still thinks the user is signed out right after they
      // finish onboarding — and the navigation gate in _layout.tsx bounces
      // them back out past the screen they just completed. Call this once,
      // right before navigating away, after onboarding finishes.
      refreshAuthState: async () => {
        const user = await bootstrapAuth();
        if (user) {
          setSignedIn(true);
          const onboarded = await checkOnboardingStatus();
          setIsOnboarded(onboarded);
        } else {
          setSignedIn(false);
          setIsOnboarded(null);
        }
      },
    }),
    [isBootstrapping, isSignedIn, isOnboarded]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
