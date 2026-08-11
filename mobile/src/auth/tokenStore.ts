// mobile/src/auth/tokenStore.ts
import * as SecureStore from "expo-secure-store";

const KEY_ID_TOKEN = "fwitter.idToken";
const KEY_ACCESS_TOKEN = "fwitter.accessToken";
const KEY_REFRESH_TOKEN = "fwitter.refreshToken";

export type StoredTokens = {
  idToken: string;
  accessToken: string;
  refreshToken?: string; // may be undefined depending on flow
};

export async function saveTokens(tokens: StoredTokens) {
  await SecureStore.setItemAsync(KEY_ID_TOKEN, tokens.idToken);
  await SecureStore.setItemAsync(KEY_ACCESS_TOKEN, tokens.accessToken);

  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(KEY_REFRESH_TOKEN, tokens.refreshToken);
  } else {
    await SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN);
  }
}

export async function loadTokens(): Promise<StoredTokens | null> {
  const [idToken, accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(KEY_ID_TOKEN),
    SecureStore.getItemAsync(KEY_ACCESS_TOKEN),
    SecureStore.getItemAsync(KEY_REFRESH_TOKEN),
  ]);

  if (!idToken || !accessToken) return null;
  return { idToken, accessToken, refreshToken: refreshToken ?? undefined };
}

export async function clearTokens() {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ID_TOKEN),
    SecureStore.deleteItemAsync(KEY_ACCESS_TOKEN),
    SecureStore.deleteItemAsync(KEY_REFRESH_TOKEN),
  ]);
}
