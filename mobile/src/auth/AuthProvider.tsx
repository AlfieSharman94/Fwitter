// mobile/src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { bootstrapAuth, doSignIn, doSignOut, refreshAuth } from "./auth";
import { apiFetch } from "../api/client";

type AuthState = {
  isBootstrapping: boolean;
  isSignedIn: boolean;
  isOnboarded: boolean | null; // null = unknown, true/false = known
  signIn: (usernameOrEmail: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkOnboarding: () => Promise<boolean>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isBootstrapping, setBootstrapping] = useState(true);
  const [isSignedIn, setSignedIn] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  const checkOnboardingStatus = async (): Promise<boolean> => {
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
      if (errorMsg.includes("Cannot reach API") || errorMsg.includes("Network request failed") || errorMsg.includes("Failed to fetch")) {
        return false; // Assume not onboarded if API is down
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
          if (errorMsg.includes("Cannot reach API") || errorMsg.includes("Network request failed") || errorMsg.includes("Failed to fetch")) {
            // API server is down - still mark as signed in (Cognito worked)
            // but user will see errors when trying to use API features
            setSignedIn(true);
            setIsOnboarded(null);
            throw new Error("Signed in successfully, but cannot connect to API server. Please ensure the API is running (cd api && npm run start:dev)");
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
        await doSignOut();
        setSignedIn(false);
        setIsOnboarded(null);
      },
      checkOnboarding: async () => {
        const onboarded = await checkOnboardingStatus();
        setIsOnboarded(onboarded);
        return onboarded;
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
