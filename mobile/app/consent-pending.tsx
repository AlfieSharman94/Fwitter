import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../src/api/client";
import { useAuth } from "../src/auth/AuthProvider";
import { colors, fonts, radii } from "../src/theme/theme";

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The API's refusal codes, in words a 13-year-old can act on.
function friendly(message: string | undefined): string {
  switch (message) {
    case "consent_email_recently_sent":
      return "We sent one less than a minute ago. Give it a moment, then try again.";
    case "guardian_email_same_as_user":
      return "That’s your own email. Enter your parent or guardian’s.";
    case "consent_email_failed":
      return "We couldn’t send the email just now. Please try again in a few minutes.";
    case "consent_already_confirmed":
      return "Consent is already confirmed. Tap “Check again”.";
    default:
      return message || "Something went wrong. Please try again.";
  }
}

// Where a 13 to 15 year old waits after sign-up: the API refuses everything else until a
// parent or guardian taps Confirm in the email. The gate in _layout.tsx moves on to the
// tabs as soon as refreshAuthState sees the confirmation.
export default function ConsentPendingScreen() {
  const { guardianEmail, refreshAuthState, signOut } = useAuth();
  const [busy, setBusy] = useState<"resend" | "change" | "check" | "signout" | null>(null);
  const [editing, setEditing] = useState(!guardianEmail);
  const [newEmail, setNewEmail] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const resend = async () => {
    setBusy("resend");
    setNotice(null);
    try {
      await apiFetch("/users/me/guardian/resend", { method: "POST" });
      setNotice({ ok: true, text: `Sent again to ${guardianEmail}.` });
    } catch (e: any) {
      setNotice({ ok: false, text: friendly(e?.message) });
    } finally {
      setBusy(null);
    }
  };

  const saveEmail = async () => {
    const value = newEmail.trim().toLowerCase();
    if (!EMAIL_FORMAT.test(value)) {
      setNotice({ ok: false, text: "Enter a valid email address." });
      return;
    }
    setBusy("change");
    setNotice(null);
    try {
      await apiFetch("/users/me/guardian", { method: "PATCH", body: JSON.stringify({ guardianEmail: value }) });
      await refreshAuthState();
      setEditing(false);
      setNewEmail("");
      setNotice({ ok: true, text: `Sent to ${value}.` });
    } catch (e: any) {
      setNotice({ ok: false, text: friendly(e?.message) });
    } finally {
      setBusy(null);
    }
  };

  const checkAgain = async () => {
    setBusy("check");
    setNotice(null);
    try {
      const status = await refreshAuthState();
      if (status?.profileMissing) {
        Alert.alert("Account removed", "Your parent or guardian chose not to give consent, so this account has been deleted.");
        return;
      }
      if (status?.consentPending) {
        setNotice({ ok: false, text: "Not confirmed yet. Ask them to check their inbox and spam folder." });
      }
    } catch (e: any) {
      setNotice({ ok: false, text: friendly(e?.message) });
    } finally {
      setBusy(null);
    }
  };

  const logOut = async () => {
    setBusy("signout");
    try {
      await signOut();
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.iconGlow}>
              <View style={styles.iconCircle}>
                <Ionicons name="mail-unread-outline" size={38} color={colors.accentText} />
              </View>
            </View>

            <Text style={styles.title}>One more step</Text>
            <Text style={styles.subtitle}>
              Because you’re under 16, a parent or guardian needs to say it’s OK before you can use Fwitter.
            </Text>

            {guardianEmail && !editing ? (
              <>
                <Text style={styles.subtitle}>We’ve emailed a link to</Text>
                <Text style={styles.email}>{guardianEmail}</Text>
                <Text style={styles.subtitle}>Ask them to open it and tap Confirm. The link lasts 7 days.</Text>
              </>
            ) : (
              <View style={styles.form}>
                <Text style={styles.label}>Parent or guardian’s email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="parent@example.com"
                  placeholderTextColor={colors.placeholder}
                  value={newEmail}
                  onChangeText={setNewEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
                <Pressable
                  style={[styles.primaryButton, busy && styles.buttonDisabled]}
                  onPress={saveEmail}
                  disabled={!!busy}
                >
                  {busy === "change" ? (
                    <ActivityIndicator color={colors.accentText} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send the link</Text>
                  )}
                </Pressable>
                {guardianEmail && (
                  <Pressable onPress={() => setEditing(false)} disabled={!!busy}>
                    <Text style={styles.linkText}>Keep {guardianEmail}</Text>
                  </Pressable>
                )}
              </View>
            )}

            {notice && (
              <View style={styles.noticeRow}>
                <Ionicons
                  name={notice.ok ? "checkmark-circle" : "alert-circle"}
                  size={16}
                  color={notice.ok ? colors.accent : colors.danger}
                />
                <Text style={[styles.noticeText, { color: notice.ok ? colors.accent : colors.danger }]}>{notice.text}</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={[styles.primaryButton, busy && styles.buttonDisabled]} onPress={checkAgain} disabled={!!busy}>
            {busy === "check" ? (
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <Text style={styles.primaryButtonText}>I’ve got the OK, check again</Text>
            )}
          </Pressable>
          {guardianEmail && !editing && (
            <View style={styles.secondaryRow}>
              <Pressable style={[styles.secondaryButton, busy && styles.buttonDisabled]} onPress={resend} disabled={!!busy}>
                {busy === "resend" ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Resend email</Text>
                )}
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, busy && styles.buttonDisabled]}
                onPress={() => {
                  setNotice(null);
                  setEditing(true);
                }}
                disabled={!!busy}
              >
                <Text style={styles.secondaryButtonText}>Use a different email</Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={logOut} disabled={!!busy}>
            <Text style={styles.linkText}>Log out</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: "center" },
  content: { paddingHorizontal: 24, paddingVertical: 24, alignItems: "center" },
  iconGlow: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: "rgba(0,200,83,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: fonts.display, fontSize: 38, color: colors.text, textTransform: "uppercase", marginTop: 24 },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 300,
  },
  email: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.text, textAlign: "center", marginTop: 6 },
  form: { alignSelf: "stretch", marginTop: 20, gap: 10 },
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
  noticeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, paddingHorizontal: 8 },
  noticeText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13 },
  footer: { paddingHorizontal: 24, paddingBottom: 24, gap: 12 },
  primaryButton: {
    height: 54,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.accentText,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  secondaryRow: { flexDirection: "row", gap: 12 },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  buttonDisabled: { opacity: 0.6 },
  linkText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.textMuted, textAlign: "center", paddingVertical: 6 },
});
