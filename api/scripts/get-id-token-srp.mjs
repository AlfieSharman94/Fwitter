import "dotenv/config";
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";

const userPoolId = process.env.COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_APP_CLIENT_ID;
const username = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;

if (!userPoolId || !clientId || !username || !password) {
  console.error("Missing env vars. Need COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID, TEST_EMAIL, TEST_PASSWORD in api/.env");
  process.exit(1);
}

const pool = new CognitoUserPool({ UserPoolId: userPoolId, ClientId: clientId });

const user = new CognitoUser({
  Username: username,
  Pool: pool,
});

const authDetails = new AuthenticationDetails({
  Username: username,
  Password: password,
});

user.authenticateUser(authDetails, {
  onSuccess: (result) => {
    const idToken = result.getIdToken().getJwtToken();
    console.log(idToken);
  },
  onFailure: (err) => {
    console.error("Failed to authenticate:", err?.name || err, err?.message || "");
    process.exit(1);
  },
  newPasswordRequired: () => {
    console.error("User requires a new password (admin-created user?)");
    process.exit(1);
  },
});
