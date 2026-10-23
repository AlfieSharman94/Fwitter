// mobile/app/_layout.tsx
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, Pressable, StyleSheet } from 'react-native';
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
import { usePushNavigation } from '../src/notifications/push';
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
  const { isBootstrapping, isSignedIn, isOnboarded, consentPending, refreshAuthState, signOut } = useAuth();
  const [retrying, setRetrying] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  // Tapped push notifications open their post or profile; the Gate above still
  // applies, so a signed-out tap just lands on Welcome.
  usePushNavigation();

  useEffect(() => {
    if (isBootstrapping) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const isWelcomeSuccess = segments[0] === 'welcome-success';
    const inConsentPending = segments[0] === 'consent-pending';

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
      } else if (isOnboarded === true && consentPending === true && !inConsentPending) {
        // A 13 to 15 year old waits here until a parent or guardian confirms; the API
        // refuses everything else with consent_pending, so there is nowhere else to go.
        router.replace('/consent-pending');
      } else if (isOnboarded === true && consentPending === false && (inAuthGroup || inOnboardingGroup || inConsentPending)) {
        router.replace('/(tabs)');
      }
      // If isOnboarded or consentPending is null, wait for it to be determined.
    }
  }, [isBootstrapping, isSignedIn, isOnboarded, consentPending, segments, router]);

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

  // Signed in but the API never answered: offer a retry (and a way out) rather than a
  // blank screen or a wrong turn into onboarding.
  if (isSignedIn && isOnboarded === null) {
    return (
      <ThemeProvider value={navTheme}>
        <View style={gateStyles.wrap}>
          <Text style={gateStyles.title}>Can’t reach Fwitter</Text>
          <Text style={gateStyles.body}>Check your connection, then try again.</Text>
          <Pressable
            style={[gateStyles.button, retrying && { opacity: 0.6 }]}
            disabled={retrying}
            onPress={async () => {
              setRetrying(true);
              try {
                await refreshAuthState();
              } finally {
                setRetrying(false);
              }
            }}
          >
            {retrying ? <ActivityIndicator color={colors.accentText} /> : <Text style={gateStyles.buttonText}>Try again</Text>}
          </Pressable>
          <Pressable onPress={signOut} hitSlop={8}>
            <Text style={gateStyles.link}>Sign out</Text>
          </Pressable>
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
        <Stack.Screen name="posts/[id]" />
        <Stack.Screen name="bookmarks" />
        <Stack.Screen name="hashtags/[tag]" />
        <Stack.Screen name="matches/index" />
        <Stack.Screen name="matches/[id]" />
        <Stack.Screen name="dm/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="welcome-success" />
        <Stack.Screen name="consent-pending" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="compose" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

const gateStyles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontFamily: 'RobotoCondensed_900Black', fontSize: 26, color: colors.text, textTransform: 'uppercase' },
  body: { fontFamily: 'Roboto_400Regular', fontSize: 15, color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  button: { height: 50, minWidth: 180, paddingHorizontal: 24, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'RobotoCondensed_700Bold', fontSize: 16, color: colors.accentText, textTransform: 'uppercase', letterSpacing: 0.3 },
  link: { fontFamily: 'Roboto_500Medium', fontSize: 14, color: colors.textDim, marginTop: 6 },
});

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
