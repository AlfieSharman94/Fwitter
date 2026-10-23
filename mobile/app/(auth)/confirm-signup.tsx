import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doConfirmSignUp, doResendSignUpCode, doSignIn } from "../../src/auth/auth";
import { useAuth } from "../../src/auth/AuthProvider";
import { completeOnboardingProfile } from "../../src/onboarding/completeProfile";
import * as SecureStore from "expo-secure-store";
import { colors, fonts, radii } from "../../src/theme/theme";

const ONBOARDING_DATA_KEY = "fwitter.onboarding.data";

export default function ConfirmSignUpScreen() {
  const router = useRouter();
  const { refreshAuthState } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!code.trim()) {
      setError("Please enter the confirmation code");
      return;
    }

    const email = params.email;
    if (!email) {
      setError("Email not provided");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      // 1. Confirm sign up with the entered code. If a previous attempt already
      // confirmed this account (e.g. it succeeded but a later step failed and
      // the user retried), Cognito rejects a second confirm — treat that as
      // success rather than an error, since the end state is what we want.
      try {
        await doConfirmSignUp(email, code.trim());
      } catch (confirmError: any) {
        const alreadyConfirmed =
          confirmError?.name === "NotAuthorizedException" &&
          /confirmed/i.test(confirmError?.message ?? "");
        if (!alreadyConfirmed) throw confirmError;
      }

      // 2. Read onboarding data — all fields live under fwitter.onboarding.data
      const stored = await SecureStore.getItemAsync(ONBOARDING_DATA_KEY);
      if (!stored) {
        throw new Error("Onboarding data not found");
      }
      const onboardingData = JSON.parse(stored);

      // 3. Auto sign in
      await doSignIn(onboardingData.email, onboardingData.password);

      // 4-7. Create profile, set teams/topics, mark onboarding complete
      await completeOnboardingProfile(onboardingData);

      // 8. Sync this context's signed-in/onboarded state with reality — without
      // this the navigation gate still thinks we're signed out and bounces us
      // back out right after we finish.
      await refreshAuthState();

      // 9. Clean up
      await SecureStore.deleteItemAsync(ONBOARDING_DATA_KEY);

      // 10. Done
      router.replace("/welcome-success");
    } catch (e: any) {
      const errorName = e?.name;
      if (errorName === "CodeMismatchException") {
        setError("Invalid confirmation code. Please check and try again.");
      } else if (errorName === "ExpiredCodeException") {
        setError("Confirmation code has expired. Please sign up again.");
      } else {
        setError(e?.message ?? "Failed to confirm sign up");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Verify your email</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>Enter the confirmation code sent to {params.email}</Text>
        <Pressable
          onPress={async () => {
            if (!params.email) return;
            try {
              await doResendSignUpCode(params.email);
              setResendMsg("A new code is on its way.");
            } catch (e: any) {
              setResendMsg(e?.message ?? "Couldn’t resend the code.");
            }
          }}
          hitSlop={8}
          style={styles.resendLink}
        >
          <Text style={styles.resendText}>{resendMsg ?? "Didn’t get a code? Resend it"}</Text>
        </Pressable>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Confirmation code"
          placeholderTextColor={colors.placeholder}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          style={styles.input}
        />

        {!!error && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={[styles.submitButton, busy && styles.submitButtonDisabled]}
        >
          {busy ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={styles.submitButtonText}>Confirm</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  resendLink: { alignSelf: "flex-start", marginTop: 4, marginBottom: 8 },
  resendText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accent2 },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
    textTransform: "uppercase",
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
    gap: 16,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
  },
  input: {
    height: 52,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    fontSize: 16,
    fontFamily: fonts.body,
    textAlign: "center",
    letterSpacing: 2,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
  },
  submitButton: {
    height: 52,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontFamily: fonts.heading,
    color: colors.accentText,
    fontSize: 17,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
