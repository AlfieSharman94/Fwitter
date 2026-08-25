import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { apiFetch } from "../../src/api/client";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { colors, fonts, radii } from "../../src/theme/theme";

const ONBOARDING_DATA_KEY = "fwitter.onboarding.data";

export default function UsernameScreen() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guards against two problems from checking on every keystroke:
  // 1. Requests can resolve out of order (e.g. the check for "jo" can finish after
  //    the check for "john"), which previously let a stale response overwrite the
  //    correct current result — a taken name could flash "available".
  // 2. Firing a request per character is wasteful and was tied to the field
  //    losing focus (see the debounce below).
  const requestSeq = useRef(0);

  const checkUsername = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    const seq = ++requestSeq.current;
    setCheckingUsername(true);
    try {
      const result = await apiFetch(`/auth/username-available?username=${encodeURIComponent(trimmed)}`, { auth: false });
      if (seq !== requestSeq.current) return; // a newer request superseded this one
      setUsernameAvailable(result.available);
      setError(null);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setUsernameAvailable(null);
    } finally {
      if (seq === requestSeq.current) setCheckingUsername(false);
    }
  }, []);

  // Debounce: only check once the user pauses typing, instead of on every keystroke.
  useEffect(() => {
    const trimmed = username.trim();
    if (trimmed.length < 2) {
      setUsernameAvailable(null);
      return;
    }
    const timer = setTimeout(() => {
      checkUsername(trimmed);
    }, 500);
    return () => clearTimeout(timer);
  }, [username, checkUsername]);

  const handleContinue = async () => {
    const trimmed = username.trim();

    if (!trimmed) {
      setError("Username is required");
      return;
    }

    if (trimmed.length < 2 || trimmed.length > 30 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Username must be 2-30 characters and contain only letters, numbers, and underscores");
      return;
    }

    if (usernameAvailable === false) {
      setError("Username is already taken");
      return;
    }

    if (usernameAvailable === null && !checkingUsername) {
      // Check availability first
      await checkUsername(trimmed);
      return;
    }

    if (usernameAvailable !== true) {
      setError("Please wait for username check to complete");
      return;
    }

    // Store username for next step
    await SecureStore.setItemAsync(ONBOARDING_DATA_KEY, JSON.stringify({
      username: trimmed,
    }));

    router.push("/(onboarding)/personal-details");
  };

  const inputBorder = checkingUsername
    ? colors.accent2
    : usernameAvailable === true
      ? colors.accent
      : usernameAvailable === false
        ? colors.danger
        : colors.border;

  const canContinue = usernameAvailable === true && !checkingUsername;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => {
              try {
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace("/(auth)/welcome");
                }
              } catch (e) {
                router.replace("/(auth)/welcome");
              }
            }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "25%" }]} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.eyebrow}>Step 1 of 4</Text>
            <Text style={styles.title}>Pick your handle</Text>
            <Text style={styles.subtitle}>This is how the timeline will know you.</Text>

            <View style={styles.inputSection}>
              <View style={[styles.inputContainer, { borderColor: inputBorder }]}>
                <Text style={styles.atSymbol}>@</Text>
                <TextInput
                  style={styles.input}
                  placeholder="yourname"
                  placeholderTextColor={colors.placeholder}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    setError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                />
                {checkingUsername && <ActivityIndicator size="small" color={colors.accent2} />}
                {usernameAvailable === true && !checkingUsername && (
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                )}
                {usernameAvailable === false && !checkingUsername && (
                  <Ionicons name="close-circle" size={20} color={colors.danger} />
                )}
              </View>

              <View style={styles.statusRow}>
                {checkingUsername ? (
                  <Text style={[styles.statusText, { color: colors.accent2 }]}>Checking availability…</Text>
                ) : usernameAvailable === true ? (
                  <Text style={[styles.statusText, { color: colors.accent }]}>Nice — that one’s free</Text>
                ) : usernameAvailable === false ? (
                  <Text style={[styles.statusText, { color: colors.danger }]}>Already taken — try another</Text>
                ) : error ? (
                  <Text style={[styles.statusText, { color: colors.danger }]}>{error}</Text>
                ) : (
                  <Text style={[styles.statusText, { color: colors.textFaint }]}>
                    2–30 characters · letters, numbers &amp; underscores
                  </Text>
                )}
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!canContinue}
          >
            <Text style={[styles.continueButtonText, !canContinue && styles.continueButtonTextDisabled]}>Continue</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 14,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 5,
    backgroundColor: colors.surface3,
    marginHorizontal: 22,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 3 },
  scrollContent: { flexGrow: 1, paddingBottom: 100 },
  content: { paddingHorizontal: 22, paddingTop: 24 },
  eyebrow: {
    fontFamily: fonts.heading,
    fontSize: 13,
    letterSpacing: 1.5,
    color: colors.accent,
    textTransform: "uppercase",
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.text,
    textTransform: "uppercase",
    marginTop: 6,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, marginTop: 10 },
  inputSection: { marginTop: 26 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 54,
    borderRadius: radii.md,
    borderWidth: 2,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  atSymbol: { fontSize: 18, color: colors.textDim, fontFamily: fonts.bodyMedium },
  input: { flex: 1, fontSize: 18, color: colors.text, fontFamily: fonts.body },
  statusRow: { minHeight: 18, marginTop: 10, paddingHorizontal: 4 },
  statusText: { fontSize: 13, fontFamily: fonts.bodyMedium },
  footer: { paddingHorizontal: 22, paddingBottom: 30, paddingTop: 8 },
  continueButton: {
    height: 54,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonDisabled: { backgroundColor: colors.surface },
  continueButtonText: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.accentText,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  continueButtonTextDisabled: { color: colors.textFaint },
});
