// mobile/app/_layout.tsx
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';
import {
  useFonts,
  Roboto_400Regular,
  Roboto_500Medium,
  Roboto_700Bold,
} from '@expo-google-fonts/roboto';
import {
  RobotoCondensed_700Bold,
  RobotoCondensed_900Black,
} from '@expo-google-fonts/roboto-condensed';

import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { colors } from '../src/theme/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Forced dark canvas so navigation transitions never flash white.
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.divider,
    primary: colors.accent,
  },
};

function Gate() {
  const { isBootstrapping, isSignedIn, isOnboarded } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isBootstrapping) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const isWelcomeSuccess = segments[0] === 'welcome-success';

    if (!isSignedIn) {
      // Not signed in - allow auth + onboarding groups.
      // The Cognito account is only created at the end of onboarding (topics.tsx),
      // so onboarding screens must be reachable while signed out.
      if (!inAuthGroup && !inOnboardingGroup && !isWelcomeSuccess) {
        router.replace('/(auth)/welcome');
      }
    } else {
      // Signed in - check onboarding status.
      // isOnboarded === false must redirect to onboarding no matter which screen we're
      // currently on. The previous version only checked this while in the "(auth)" group
      // and explicitly skipped it for "(tabs)"/"users"/"compose"/"settings" — but expo-router's
      // "(tabs)" anchor route means a signed-in-but-not-onboarded user can land directly on
      // tabs (e.g. an account that exists in Cognito but has no profile row yet on this
      // backend), and that exclusion let them sit there instead of being sent to onboarding.
      if (isOnboarded === false && !inOnboardingGroup) {
        router.replace('/(onboarding)/username');
      } else if (isOnboarded === true && (inAuthGroup || inOnboardingGroup)) {
        router.replace('/(tabs)');
      }
      // If isOnboarded is null, wait for it to be determined.
    }
  }, [isBootstrapping, isSignedIn, isOnboarded, segments, router]);

  // Show loading screen during bootstrap
  if (isBootstrapping) {
    return (
      <ThemeProvider value={navTheme}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
        <StatusBar style="light" />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="users/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="welcome-success" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Roboto_400Regular,
    Roboto_500Medium,
    Roboto_700Bold,
    RobotoCondensed_700Bold,
    RobotoCondensed_900Black,
  });

  // Hold on a dark canvas (not white) until the fonts are ready.
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
