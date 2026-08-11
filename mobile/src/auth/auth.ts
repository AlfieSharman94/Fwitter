// mobile/src/auth/auth.ts
// Lazy import to avoid top-level crash before polyfills load
let authMod: typeof import("aws-amplify/auth") | null = null;
async function getAuth() {
  if (!authMod) authMod = await import("aws-amplify/auth");
  return authMod;
}

import { ensureAmplifyConfigured } from "./amplify";
import { clearTokens, loadTokens, saveTokens } from "./tokenStore";

export async function bootstrapAuth() {
  try {
    await ensureAmplifyConfigured();
    const { getCurrentUser } = await getAuth();

    // If Amplify still has a valid session, we can refresh tokens into SecureStore.
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }
    const tokens = await getFreshTokens();
    if (tokens) {
      await saveTokens(tokens);
    }
    return user;
  } catch (e: any) {
    // Not signed in
    return null;
  }
}

export async function doSignIn(usernameOrEmail: string, password: string) {
  try {
    await ensureAmplifyConfigured();
    const { signIn, getCurrentUser, signOut } = await getAuth();

    // Check if user is already signed in - if so, sign out first
    try {
      const currentUser = await getCurrentUser();
      if (currentUser) {
        console.log("User already authenticated, signing out first...");
        await signOut();
      }
    } catch (e) {
      // No current user, proceed with sign in
    }

    const res = await signIn({
      username: usernameOrEmail,
      password,
    });

    // If you later enable MFA / challenges, handle res.nextStep here.
    const tokens = await getFreshTokens();
    if (!tokens) throw new Error("Signed in but no tokens returned.");
    await saveTokens(tokens);

    return res;
  } catch (e: any) {
    // Log underlying error for debugging
    console.error("doSignIn error:", e);
    console.error("Error name:", e?.name);
    console.error("Error message:", e?.message);
    console.error("Underlying error:", e?.underlyingError);
    if (e?.underlyingError) {
      console.error("Underlying error details:", JSON.stringify(e.underlyingError, null, 2));
    }
    
    // Re-throw with a user-friendly message
    const errorName = e?.name;
    if (errorName === "UserAlreadyAuthenticatedException") {
      // Try to sign out and retry once
      try {
        const auth = await getAuth();
        const currentUser = await auth.getCurrentUser();
        if (currentUser) {
          await auth.signOut();
          // Retry sign in after signing out
          const retryRes = await auth.signIn({
            username: usernameOrEmail,
            password,
          });
          const tokens = await getFreshTokens();
          if (!tokens) throw new Error("Signed in but no tokens returned.");
          await saveTokens(tokens);
          return retryRes;
        }
      } catch (retryError) {
        // If retry fails, throw original error
        throw new Error("Please sign out and try again");
      }
    } else if (errorName === "NotAuthorizedException") {
      throw new Error("Incorrect email or password");
    } else if (errorName === "UserNotConfirmedException") {
      throw new Error("Please verify your email address");
    } else if (errorName === "UserNotFoundException") {
      throw new Error("Account not found");
    }
    // For Unknown errors, try to extract more info
    if (errorName === "Unknown" && e?.underlyingError) {
      const underlying = e.underlyingError;
      if (underlying?.message) {
        throw new Error(underlying.message);
      }
      if (underlying?.code) {
        throw new Error(`Authentication failed: ${underlying.code}`);
      }
    }
    throw e;
  }
}

export async function doSignUp(email: string, password: string) {
  await ensureAmplifyConfigured();
  const { signUp } = await getAuth();

  // Minimal sign-up. If you require username, collect it too.
  return signUp({
    username: email,
    password,
    options: {
      userAttributes: { email },
    },
  });
}

export async function doSignOut() {
  await ensureAmplifyConfigured();
  const { signOut } = await getAuth();
  await Promise.allSettled([signOut(), clearTokens()]);
}

export async function confirmPasswordReset(username: string, confirmationCode: string, newPassword: string) {
  await ensureAmplifyConfigured();
  const { confirmResetPassword } = await getAuth();
  return confirmResetPassword({
    username,
    confirmationCode,
    newPassword,
  });
}

export async function doConfirmSignUp(username: string, confirmationCode: string) {
  await ensureAmplifyConfigured();
  const { confirmSignUp } = await getAuth();
  return confirmSignUp({
    username,
    confirmationCode,
  });
}

export async function doUpdatePassword(oldPassword: string, newPassword: string) {
  await ensureAmplifyConfigured();
  const { updatePassword } = await getAuth();
  return updatePassword({ oldPassword, newPassword });
}

/** Returns true if the JWT is expired or will expire within the next 5 minutes. */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    // JWT payload is base64url — convert to standard base64 before decoding
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    // 5-minute buffer so we refresh before the API rejects it
    return payload.exp * 1000 < Date.now() + 5 * 60 * 1000;
  } catch {
    return true; // Can't parse — treat as expired and let Amplify refresh
  }
}

export async function getIdToken(): Promise<string | null> {
  // Fast path: SecureStore — only if token is still valid
  const stored = await loadTokens();
  if (stored?.idToken && !isTokenExpired(stored.idToken)) {
    return stored.idToken;
  }

  // Token missing or expired — ask Amplify to refresh
  const tokens = await getFreshTokens();
  if (tokens) {
    await saveTokens(tokens);
    return tokens.idToken;
  }
  return null;
}

/** Silently refresh tokens via Amplify. Returns false if the session is gone. */
export async function refreshAuth(): Promise<boolean> {
  const tokens = await getFreshTokens();
  if (!tokens) return false;
  await saveTokens(tokens);
  return true;
}

async function getFreshTokens(): Promise<{
  idToken: string;
  accessToken: string;
  refreshToken?: string;
} | null> {
  const { fetchAuthSession } = await getAuth();
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();
  const accessToken = session.tokens?.accessToken?.toString();
  const refreshToken = session.tokens?.refreshToken?.toString();

  if (!idToken || !accessToken) return null;
  return { idToken, accessToken, refreshToken };
}
