// mobile/src/auth/amplify.ts
// Lazy import to avoid top-level crash before polyfills load
let amplifyMod: typeof import("aws-amplify") | null = null;
async function getAmplify() {
  if (!amplifyMod) amplifyMod = await import("aws-amplify");
  return amplifyMod;
}

import { cognitoConfig, assertCognitoConfig } from "../config/cognito";

let configured = false;

export async function ensureAmplifyConfigured() {
  if (configured) return;

  assertCognitoConfig();
  const { Amplify } = await getAmplify();

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: cognitoConfig.userPoolId,
        userPoolClientId: cognitoConfig.userPoolClientId,
        region: cognitoConfig.region,
      },
    },
  });

  configured = true;
}
