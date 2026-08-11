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

// Profile details
const profileData = {
  username: process.env.PROFILE_USERNAME || "testuser123",
  displayName: process.env.PROFILE_DISPLAY_NAME || "Test User",
  dateOfBirth: process.env.PROFILE_DOB || "1990-01-01",
};

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
  onSuccess: async (result) => {
    const idToken = result.getIdToken().getJwtToken();
    
    console.log("✅ Authenticated successfully");
    console.log("Creating user profile...");
    
    try {
      const response = await fetch("http://localhost:3000/users/me/profile", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error("❌ Failed to create profile:", data);
        process.exit(1);
      }
      
      console.log("✅ Profile created successfully!");
      console.log("User details:", JSON.stringify(data.user, null, 2));
      console.log("\nYou can now search for this user with username:", profileData.username);
    } catch (error) {
      console.error("❌ Error creating profile:", error.message);
      process.exit(1);
    }
  },
  onFailure: (err) => {
    console.error("❌ Authentication failed:", err?.name || err, err?.message || "");
    process.exit(1);
  },
  newPasswordRequired: async (userAttributes, requiredAttributes) => {
    console.log("🔐 User requires a new password (admin-created user)");
    console.log("Setting new password...");
    
    const newPassword = process.env.NEW_PASSWORD || process.env.TEST_PASSWORD;
    if (!newPassword) {
      console.error("❌ Missing NEW_PASSWORD in .env");
      console.error("Add NEW_PASSWORD=<desired-password> to api/.env");
      process.exit(1);
    }
    
    // Set the new password
    user.completeNewPasswordChallenge(newPassword, requiredAttributes, {
      onSuccess: async (result) => {
        const idToken = result.getIdToken().getJwtToken();
        
        console.log("✅ Password set successfully");
        console.log("Creating user profile...");
        
        try {
          const response = await fetch("http://localhost:3000/users/me/profile", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(profileData),
          });
          
          const data = await response.json();
          
          if (!response.ok) {
            console.error("❌ Failed to create profile:", data);
            process.exit(1);
          }
          
          console.log("✅ Profile created successfully!");
          console.log("User details:", JSON.stringify(data.user, null, 2));
          console.log("\nYou can now search for this user with username:", profileData.username);
        } catch (error) {
          console.error("❌ Error creating profile:", error.message);
          process.exit(1);
        }
      },
      onFailure: (err) => {
        console.error("❌ Failed to set new password:", err?.name || err, err?.message || "");
        process.exit(1);
      },
    });
  },
});
