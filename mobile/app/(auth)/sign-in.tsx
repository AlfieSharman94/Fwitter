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
import { useAuth } from "../../src/auth/AuthProvider";
import { colors, fonts, radii } from "../../src/theme/theme";

export default function SignInScreen() {
  const { signIn, checkOnboarding } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  // Pre-fill email if provided (e.g., from forgot password flow)
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
    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    setError(null);
    setNeedsConfirmation(false);
    setBusy(true);

    try {
      await signIn(email.trim(), password);

      // Check onboarding status
      await checkOnboarding();

      // Navigation will be handled by the gate in _layout.tsx
      // But we can also explicitly navigate here
      router.replace("/");
    } catch (e: any) {
      const errorName = e?.name;
      const errorMessage = e?.message ?? "Sign-in failed. Please try again.";

      // Handle specific error types
      if (errorName === "NotAuthorizedException" || errorMessage.includes("Incorrect email or password")) {
        setError("Incorrect email or password");
      } else if (errorName === "UserNotConfirmedException" || errorMessage.includes("verify your email")) {
        setError("Please verify your email address");
        setNeedsConfirmation(true);
      } else if (errorMessage.includes("Network") || errorMessage.includes("Cannot reach")) {
        setError("Cannot reach API. Please check your connection.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleGoToConfirm() {
    router.push({
      pathname: "/(auth)/confirm-signup",
      params: { email: email.trim() },
    });
  }

  function handleForgotPassword() {
    router.push({
      pathname: "/(auth)/forgot-password",
      params: { email: email.trim() },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Pressable
            style={styles.backButton}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.push("/(auth)/welcome");
              }
            }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.headerBlock}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>The terraces missed you.</Text>
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

            <View>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!busy}
              />
            </View>

            <Pressable onPress={handleForgotPassword} style={styles.forgotLink}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            {!!error && (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={16} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {needsConfirmation && (
              <Pressable onPress={handleGoToConfirm} style={styles.confirmLink}>
                <Text style={styles.confirmLinkText}>Verify your email address</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.primaryButton, busy && styles.primaryButtonDisabled]}
              onPress={onSubmit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text style={styles.primaryButtonText}>Log in</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              New here?{" "}
              <Text style={styles.footerLink} onPress={() => router.push("/(auth)/sign-up")}>
                Create an account
              </Text>
            </Text>
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
  forgotLink: {
    alignSelf: "flex-start",
    marginTop: -6,
  },
  forgotText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.accent,
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
  confirmLink: {
    alignItems: "center",
  },
  confirmLinkText: {
    color: colors.accent2,
    fontSize: 14,
    textDecorationLine: "underline",
    fontFamily: fonts.bodyMedium,
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
  footer: {
    marginTop: "auto",
    alignItems: "center",
    paddingTop: 24,
  },
  footerText: {
    fontFamily: fonts.body,
    color: colors.textMuted,
    fontSize: 14,
  },
  footerLink: {
    color: colors.accent,
    fontFamily: fonts.bodyBold,
  },
});
