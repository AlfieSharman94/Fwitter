import { CognitoIdentityProviderClient, ConfirmForgotPasswordCommand } from "@aws-sdk/client-cognito-identity-provider";
import "dotenv/config";

const region = process.env.AWS_REGION;
const clientId = process.env.COGNITO_APP_CLIENT_ID;
const username = process.env.TEST_EMAIL;
const confirmationCode = process.env.RESET_CODE; // The code from email
const newPassword = process.env.NEW_PASSWORD;

if (!region || !clientId || !username || !confirmationCode || !newPassword) {
  console.error("Missing env vars. Need:");
  console.error("  AWS_REGION");
  console.error("  COGNITO_APP_CLIENT_ID");
  console.error("  TEST_EMAIL (username)");
  console.error("  RESET_CODE (from email)");
  console.error("  NEW_PASSWORD (new password to set)");
  console.error("\nAdd RESET_CODE and NEW_PASSWORD to api/.env temporarily");
  process.exit(1);
}

const cognito = new CognitoIdentityProviderClient({ region });

const cmd = new ConfirmForgotPasswordCommand({
  ClientId: clientId,
  Username: username,
  ConfirmationCode: confirmationCode,
  Password: newPassword,
});

try {
  await cognito.send(cmd);
  console.log("✅ Password reset confirmed successfully!");
  console.log(`You can now sign in with email: ${username} and the new password.`);
} catch (err) {
  console.error("❌ Failed to confirm password reset:", err?.name, err?.message);
  if (err?.name === "CodeMismatchException") {
    console.error("\nThe confirmation code is incorrect or expired. Request a new one.");
  } else if (err?.name === "ExpiredCodeException") {
    console.error("\nThe confirmation code has expired. Request a new one.");
  }
  process.exit(1);
}
