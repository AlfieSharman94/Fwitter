import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { apiFetch } from "../../src/api/client";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { colors, fonts, radii } from "../../src/theme/theme";

const ONBOARDING_DATA_KEY = "fwitter.onboarding.data";
const MIN_AGE = 13;
const JUNIOR_MAX_AGE = 15; // 13–15 = JUNIOR, 16+ = STANDARD

// Full-date age calculation from Y/M/D components (avoids timezone parsing drift).
// A user whose birthday is today counts as that age; tomorrow's birthday does not.
function calculateAge(year: number, month: number, day: number): number {
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month; // getMonth() is 0-based
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
    age--;
  }
  return age;
}

export default function PersonalDetailsScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    // Load stored username
    (async () => {
      const stored = await SecureStore.getItemAsync(ONBOARDING_DATA_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Username should already be stored from step 1
      }
    })();
  }, []);

  const checkEmail = useCallback(async (value: string) => {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setEmailAvailable(null);
      return;
    }

    setCheckingEmail(true);
    try {
      const result = await apiFetch(`/auth/email-available?email=${encodeURIComponent(trimmed)}`, { auth: false });
      setEmailAvailable(result.available);
    } catch (e) {
      setEmailAvailable(null);
    } finally {
      setCheckingEmail(false);
    }
  }, []);

  const handleContinue = async () => {
    setError(null);

    // Validation
    if (!displayName.trim()) {
      setError("Display name is required");
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (emailAvailable === false) {
      setError("Email is already registered");
      return;
    }

    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!dateOfBirth.trim()) {
      setError("Date of birth is required");
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateOfBirth)) {
      setError("Date of birth must be in YYYY-MM-DD format");
      return;
    }

    // Confirm it's a real calendar date
    const [birthYear, birthMonth, birthDay] = dateOfBirth.split("-").map(Number);
    const parsedDob = new Date(birthYear, birthMonth - 1, birthDay);
    const isRealDate =
      parsedDob.getFullYear() === birthYear &&
      parsedDob.getMonth() === birthMonth - 1 &&
      parsedDob.getDate() === birthDay;
    if (!isRealDate) {
      setError("Please enter a valid date of birth");
      return;
    }

    // Age gate: must be at least 13; derive age tier from full DOB
    const age = calculateAge(birthYear, birthMonth, birthDay);
    if (age < MIN_AGE) {
      setError(
        "Sorry, you need to be at least 13 to use Fwitter. Thanks for your interest!"
      );
      return;
    }
    const ageTier = age <= JUNIOR_MAX_AGE ? "JUNIOR" : "STANDARD";

    // Store all data for sign-up
    const stored = await SecureStore.getItemAsync(ONBOARDING_DATA_KEY);
    const existingData = stored ? JSON.parse(stored) : {};

    await SecureStore.setItemAsync(ONBOARDING_DATA_KEY, JSON.stringify({
      ...existingData,
      displayName: displayName.trim(),
      email: email.trim(),
      password,
      dateOfBirth: dateOfBirth.trim(),
      ageTier,
    }));

    router.push("/(onboarding)/team-selection");
  };

  // Display-only derived states (do not affect submit validation above).
  const emailBorder = checkingEmail
    ? colors.accent2
    : emailAvailable === true
      ? colors.accent
      : emailAvailable === false
        ? colors.danger
        : colors.border;
  const pwShort = password.length > 0 && password.length < 8;
  const confErr = confirmPassword.length > 0 && confirmPassword !== password;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "50%" }]} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.eyebrow}>Step 2 of 4</Text>
            <Text style={styles.title}>Your details</Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Display name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Jordan Vella"
                  placeholderTextColor={colors.placeholder}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, { borderColor: emailBorder }]}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.placeholder}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    checkEmail(text);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                <View style={styles.hintSlot}>
                  {checkingEmail ? (
                    <Text style={[styles.hint, { color: colors.accent2 }]}>Checking…</Text>
                  ) : emailAvailable === true ? (
                    <Text style={[styles.hint, { color: colors.accent }]}>Email available</Text>
                  ) : emailAvailable === false ? (
                    <Text style={[styles.hint, { color: colors.danger }]}>Email already registered</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.passwordRow}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Password</Text>
                  <TextInput
                    style={[styles.input, pwShort && { borderColor: colors.danger }]}
                    placeholder="Min 8 characters"
                    placeholderTextColor={colors.placeholder}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Confirm</Text>
                  <TextInput
                    style={[styles.input, confErr && { borderColor: colors.danger }]}
                    placeholder="Re-enter"
                    placeholderTextColor={colors.placeholder}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>
              </View>
              {pwShort && <Text style={styles.hint}>Password must be at least 8 characters</Text>}
              {confErr && <Text style={[styles.hint, { color: colors.danger }]}>Passwords don’t match</Text>}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Date of birth</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.placeholder}
                  value={dateOfBirth}
                  onChangeText={setDateOfBirth}
                />
                <Text style={styles.dobHint}>YYYY-MM-DD · you must be 13 or older</Text>
              </View>

              {error && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={16} color={colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.continueButton, busy && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, paddingTop: 6, paddingBottom: 14 },
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
  progressTrack: { height: 5, backgroundColor: colors.surface3, marginHorizontal: 22, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 3 },
  scrollContent: { flexGrow: 1, paddingBottom: 100 },
  content: { paddingHorizontal: 22, paddingTop: 24 },
  eyebrow: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 1.5, color: colors.accent, textTransform: "uppercase" },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text, textTransform: "uppercase", marginTop: 6 },
  form: { marginTop: 22, gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 14, color: "#cfcfcf" },
  input: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.body,
  },
  hintSlot: { minHeight: 16 },
  hint: { fontSize: 12.5, color: colors.textDim, fontFamily: fonts.body },
  dobHint: { fontSize: 12.5, color: colors.textFaint, fontFamily: fonts.body },
  passwordRow: { flexDirection: "row", gap: 16 },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  errorText: { flex: 1, fontFamily: fonts.bodyMedium, color: colors.danger, fontSize: 13 },
  footer: { paddingHorizontal: 22, paddingBottom: 30, paddingTop: 8 },
  continueButton: { height: 54, borderRadius: radii.lg, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  continueButtonDisabled: { opacity: 0.6 },
  continueButtonText: { fontFamily: fonts.heading, fontSize: 18, color: colors.accentText, textTransform: "uppercase", letterSpacing: 0.4 },
});
