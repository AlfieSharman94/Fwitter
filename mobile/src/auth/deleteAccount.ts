import { deleteUser } from "aws-amplify/auth";

// Removes the Cognito user. Called after the API profile is deleted, since that call
// needs a valid session. Amplify signs the user out as part of this.
export async function deleteCognitoAccount() {
  await deleteUser();
}
