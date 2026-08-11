import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
import "dotenv/config";

const region = process.env.AWS_REGION;
const clientId = process.env.COGNITO_APP_CLIENT_ID;
const username = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

if (!region || !clientId || !username || !password) {
  console.error("Missing env vars. Need AWS_REGION, COGNITO_APP_CLIENT_ID, TEST_EMAIL, TEST_PASSWORD in api/.env");
  process.exit(1);
}

const cognito = new CognitoIdentityProviderClient({ region });

const cmd = new InitiateAuthCommand({
  AuthFlow: "USER_PASSWORD_AUTH",
  ClientId: clientId,
  AuthParameters: {
    USERNAME: username,
    PASSWORD: password,
  },
});

try {
  const res = await cognito.send(cmd);

  const idToken = res.AuthenticationResult?.IdToken;
  if (!idToken) {
    console.error("No IdToken returned. Response:", res);
    process.exit(1);
  }

  console.log(idToken);
} catch (err) {
  console.error("Failed to get token:", err?.name, err?.message);
  // Common issues:
  // - UserNotConfirmedException: user hasn't verified email yet
  // - NotAuthorizedException: wrong password
  // - InvalidParameterException: auth flow not enabled on app client
  process.exit(1);
}
