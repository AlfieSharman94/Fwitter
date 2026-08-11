// mobile/src/config/cognito.ts
export const cognitoConfig = {
  region: process.env.EXPO_PUBLIC_AWS_REGION!,
  userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID!,
  userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_CLIENT_ID!,
};

export function assertCognitoConfig() {
  const missing = Object.entries(cognitoConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(
      `Missing Cognito env vars: ${missing.join(", ")}. Check mobile/.env (EXPO_PUBLIC_*)`
    );
  }
}
