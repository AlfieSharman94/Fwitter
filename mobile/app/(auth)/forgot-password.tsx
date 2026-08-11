import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ensureAmplifyConfigured } from "../../src/auth/amplify";

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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
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
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                We've sent a password reset code to {email}
              </Text>

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
        </View>
      </SafeAreaView>
    );
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
              Enter your email address and we'll send you a code to reset your password.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#5b7083"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
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
                  <Text style={styles.primaryButtonText}>Send reset code</Text>
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
