import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="username" />
      <Stack.Screen name="personal-details" />
      <Stack.Screen name="team-selection" />
      <Stack.Screen name="topics" />
      {/* Keep old routes for backwards compatibility */}
      <Stack.Screen name="teams-primary" />
      <Stack.Screen name="teams-extra" />
      <Stack.Screen name="finish" />
    </Stack>
  );
}
