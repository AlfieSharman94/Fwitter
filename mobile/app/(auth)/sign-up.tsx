import React from "react";
import { useRouter } from "expo-router";

// Account creation is handled through the onboarding flow (username -> personal
// details -> team -> topics, where Cognito sign-up actually happens). This screen
// just forwards to the first onboarding step.
export default function SignUpScreen() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace("/(onboarding)/username");
  }, []);

  return null;
}
