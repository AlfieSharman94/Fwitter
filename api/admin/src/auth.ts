import { Amplify } from 'aws-amplify';
import { fetchAuthSession, getCurrentUser, signIn, signOut } from 'aws-amplify/auth';

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID as string | undefined;
const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID as string | undefined;

export const authConfigured = !!(userPoolId && userPoolClientId);

if (authConfigured) {
  Amplify.configure({ Auth: { Cognito: { userPoolId: userPoolId!, userPoolClientId: userPoolClientId! } } });
}

export async function login(email: string, password: string) {
  const result = await signIn({ username: email, password });
  if (!result.isSignedIn) throw new Error(`Sign-in needs another step: ${result.nextStep.signInStep}`);
}

export async function logout() {
  await signOut();
}

export async function hasSession(): Promise<boolean> {
  try {
    await getCurrentUser();
    return true;
  } catch {
    return false;
  }
}

export async function idToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() ?? null;
  } catch {
    return null;
  }
}
