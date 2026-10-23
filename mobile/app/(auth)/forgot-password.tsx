import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ensureAmplifyConfigured } from "../../src/auth/amplify";
import { colors, fonts, radii } from "../../src/theme/theme";

// Lazy import
let authMod: typeof import("aws-amplify/auth") | null = null;
async function getAuth() {
  if (!authMod) authMod = await import("aws-amplify/auth");
  return authMod;
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (params.email) {
      setEmail(params.email);
    }
  }, [params.email]);

  async function onSubmit() {
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      await ensureAmplifyConfigured();
      const { resetPassword } = await getAuth();

      await resetPassword({
        username: email.trim(),
      });

      setSuccess(true);
    } catch (e: any) {
      const errorName = e?.name;
      if (errorName === "UserNotFoundException") {
        setError("Account not found");
      } else if (errorName === "LimitExceededException") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(e?.message ?? "Failed to send reset code");
      }
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>We’ve sent a password reset code to {email}</Text>
          </View>

          <View style={styles.form}>
            <Pressable
              style={styles.primaryButton}
              onPress={() => router.push({
                pathname: "/(auth)/reset-password",
                params: { email: email.trim() },
              })}
            >
              <Text style={styles.primaryButtonText}>Enter reset code</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we’ll send you a code to reset your password.
            </Text>
          </View>

          <View style={styles.form}>
            <View>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!busy}
              />
            </View>

            {!!error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Pressable
              style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
              onPress={onSubmit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text style={styles.primaryButtonText}>Send reset code</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 28,
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
  headerBlock: {
    marginTop: 30,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 38,
    color: colors.text,
    textTransform: "uppercase",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
  },
  form: {
    marginTop: 30,
    gap: 18,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: "#cfcfcf",
    marginBottom: 7,
  },
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
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    fontFamily: fonts.bodyMedium,
    color: colors.danger,
    fontSize: 13,
    flex: 1,
  },
  primaryButton: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontFamily: fonts.heading,
    fontSize: 17,
    color: colors.accentText,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});
