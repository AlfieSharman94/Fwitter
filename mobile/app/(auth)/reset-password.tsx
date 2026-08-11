import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { confirmPasswordReset } from "../../src/auth/auth";

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
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.closeButton}>✕</Text>
            </Pressable>
            <View style={styles.logo}>
              <Text style={styles.logoText}>⚽</Text>
            </View>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>
              Enter the code sent to {email || "your email"} and your new password.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Reset code"
                  placeholderTextColor="#5b7083"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  editable={!busy}
                />
                <View style={styles.inputUnderline} />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="New password"
                  placeholderTextColor="#5b7083"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  editable={!busy}
                />
                <View style={styles.inputUnderline} />
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm password"
                  placeholderTextColor="#5b7083"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  editable={!busy}
                />
                <View style={styles.inputUnderline} />
              </View>

              {!!error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Pressable
                style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
                onPress={onSubmit}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Reset password</Text>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(16, 22, 34, 0.95)",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  closeButton: {
    fontSize: 24,
    color: "#fff",
    fontWeight: "300",
  },
  logo: {
    width: 40,
    height: 40,
    backgroundColor: "#0d59f2",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0d59f2",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  logoText: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 32,
    maxWidth: 480,
    alignSelf: "center",
    width: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#90a4cb",
    marginBottom: 32,
    lineHeight: 22,
  },
  form: {
    gap: 24,
  },
  inputContainer: {
    position: "relative",
  },
  input: {
    fontSize: 18,
    color: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    borderBottomWidth: 1,
    borderBottomColor: "#222f49",
  },
  inputUnderline: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#0d59f2",
    opacity: 0,
  },
  errorContainer: {
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#ff4444",
    textAlign: "center",
  },
  primaryButton: {
    backgroundColor: "#0d59f2",
    borderRadius: 9999,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0d59f2",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    marginTop: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: "#999",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
