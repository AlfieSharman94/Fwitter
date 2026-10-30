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
import { confirmPasswordReset } from "../../src/auth/auth";
import { colors, fonts, radii } from "../../src/theme/theme";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (params.email) {
      setEmail(params.email);
    }
  }, [params.email]);

  async function onSubmit() {
    // Validation
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!code.trim()) {
      setError("Reset code is required");
      return;
    }
    if (!newPassword.trim()) {
      setError("New password is required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      await confirmPasswordReset(email.trim(), code.trim(), newPassword.trim());

      // Success - navigate to sign-in with email prefilled
      router.replace({
        pathname: "/(auth)/sign-in",
        params: { email: email.trim() },
      });
    } catch (e: any) {
      const errorName = e?.name;
      if (errorName === "CodeMismatchException") {
        setError("Invalid reset code. Please check and try again.");
      } else if (errorName === "ExpiredCodeException") {
        setError("Reset code has expired. Please request a new one.");
      } else if (errorName === "InvalidPasswordException") {
        setError("Password does not meet requirements.");
      } else {
        setError(e?.message ?? "Failed to reset password");
      }
    } finally {
      setBusy(false);
    }
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
              Enter the code sent to {email || "your email"} and your new password.
            </Text>
          </View>

          <View style={styles.form}>
            <View>
              <Text style={styles.label}>Reset code</Text>
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor={colors.placeholder}
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
                editable={!busy}
              />
            </View>

            <View>
              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter a new password"
                placeholderTextColor={colors.placeholder}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                editable={!busy}
              />
            </View>

            <View>
              <Text style={styles.label}>Confirm password</Text>
              <TextInput
                style={styles.input}
                placeholder="Re-enter your password"
                placeholderTextColor={colors.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
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
                <Text style={styles.primaryButtonText}>Reset password</Text>
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
