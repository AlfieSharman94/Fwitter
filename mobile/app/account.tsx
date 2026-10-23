import React, { useEffect, useState } from "react";
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
  Alert,
  Image,
  Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../src/api/client";
import { doUpdatePassword } from "../src/auth/auth";
import { deleteCognitoAccount } from "../src/auth/deleteAccount";
import { useAuth } from "../src/auth/AuthProvider";
import { friendlyUploadError, pickImages, uploadImage } from "../src/media/upload";
import { colors, fonts, radii } from "../src/theme/theme";

type MeProfile = {
  id: string;
  username: string;
  display_name: string;
  email: string;
  date_of_birth: string;
  created_at: string;
  bio: string | null;
  profile_image_url: string | null;
  age_tier: "JUNIOR" | "STANDARD";
  public_profile: boolean;
};

export default function AccountScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [profile, setProfile] = useState<MeProfile | null>(null);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch("/users/me/profile");
        const u = data.user as MeProfile;
        setProfile(u);
        setUsername(u.username ?? "");
        setBio(u.bio ?? "");
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Failed to load account");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" })
    : "—";
  const dob = profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString() : "—";

  const handleSaveProfile = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 2 || trimmed.length > 30 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setProfileMsg({ ok: false, text: "Username must be 2–30 chars: letters, numbers, underscores." });
      return;
    }
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const data = await apiFetch("/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ username: trimmed, bio: bio.trim() }),
      });
      setProfile(data.user as MeProfile);
      setProfileMsg({ ok: true, text: "Saved." });
    } catch (e: any) {
      const text =
        e?.message === "username_taken"
          ? "That username is taken."
          : e?.message === "content_not_allowed"
            ? "That username or bio contains language we don’t allow."
            : e?.message ?? "Failed to save.";
      setProfileMsg({ ok: false, text });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangeAvatar = async () => {
    try {
      const [img] = await pickImages(1);
      if (!img) return;
      setAvatarBusy(true);
      const uploaded = await uploadImage(img, "avatar");
      const data = await apiFetch("/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ avatarMediaId: uploaded.id }),
      });
      setProfile(data.user as MeProfile);
    } catch (e: any) {
      Alert.alert("Error", friendlyUploadError(e));
    } finally {
      setAvatarBusy(false);
    }
  };

  // 13 to 15 year olds only. Applies straight away; the switch snaps back if the server refuses.
  const handleTogglePublic = async (value: boolean) => {
    if (!profile) return;
    const previous = profile;
    setProfile({ ...profile, public_profile: value });
    setSavingPrivacy(true);
    try {
      const data = await apiFetch("/users/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ publicProfile: value }),
      });
      setProfile(data.user as MeProfile);
    } catch (e: any) {
      setProfile(previous);
      Alert.alert("Error", e?.message ?? "Failed to save.");
    } finally {
      setSavingPrivacy(false);
    }
  };

  // Profile first (needs the session), then the Cognito user, then local state.
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete your account?",
      "Your profile, posts, likes, follows and saved posts are deleted straight away. This can’t be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await apiFetch("/users/me", { method: "DELETE" });
              try {
                await deleteCognitoAccount();
              } catch {
                // Profile is gone; a stale Cognito user just lands on onboarding next time.
              }
              await signOut();
              router.replace("/(auth)/welcome");
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to delete account.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleChangePassword = async () => {
    if (!oldPassword) {
      Alert.alert("Error", "Enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert("Error", "New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords don’t match.");
      return;
    }
    setSavingPassword(true);
    try {
      await doUpdatePassword(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Done", "Your password has been updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Avatar */}
            <View style={styles.avatarRow}>
              {profile?.profile_image_url ? (
                <Image source={{ uri: profile.profile_image_url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>{(profile?.display_name ?? "?").charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <Pressable
                style={[styles.buttonOutline, styles.avatarButton, avatarBusy && styles.buttonDisabled]}
                onPress={handleChangeAvatar}
                disabled={avatarBusy}
              >
                {avatarBusy ? <ActivityIndicator color={colors.text} /> : <Text style={styles.buttonOutlineText}>Change photo</Text>}
              </Pressable>
            </View>

            {/* Read-only details */}
            <Text style={styles.sectionLabel}>Details</Text>
            <View style={styles.readonlyCard}>
              <ReadonlyRow label="Email" value={profile?.email ?? "—"} />
              <ReadonlyRow label="Date of birth" value={dob} />
              <ReadonlyRow label="Member since" value={memberSince} last />
            </View>

            {/* Editable profile */}
            <Text style={styles.sectionLabel}>Profile</Text>
            <Text style={styles.fieldLabel}>Username</Text>
            <View style={styles.usernameField}>
              <Text style={styles.at}>@</Text>
              <TextInput
                style={styles.usernameInput}
                value={username}
                onChangeText={(t) => {
                  setUsername(t);
                  setProfileMsg(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={30}
                placeholder="username"
                placeholderTextColor={colors.placeholder}
              />
            </View>
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={(t) => {
                setBio(t);
                setProfileMsg(null);
              }}
              placeholder="Tell people about your football takes…"
              placeholderTextColor={colors.placeholder}
              multiline
              maxLength={300}
            />
            {profileMsg && (
              <Text style={[styles.msg, { color: profileMsg.ok ? colors.accent : colors.danger }]}>
                {profileMsg.text}
              </Text>
            )}
            <Pressable
              style={[styles.button, savingProfile && styles.buttonDisabled]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color={colors.accentText} />
              ) : (
                <Text style={styles.buttonText}>Save changes</Text>
              )}
            </Pressable>

            {/* Privacy: only 13 to 15 year olds have a choice, everyone else is public */}
            {profile?.age_tier === "JUNIOR" && (
              <>
                <Text style={styles.sectionLabel}>Privacy</Text>
                <View style={styles.readonlyCard}>
                  <View style={[styles.roRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.roLabel}>Public profile</Text>
                    <Switch
                      value={profile.public_profile}
                      onValueChange={handleTogglePublic}
                      disabled={savingPrivacy}
                      trackColor={{ true: colors.accent, false: colors.border }}
                    />
                  </View>
                </View>
                <Text style={styles.privacyHelp}>
                  {profile.public_profile
                    ? "Anyone on Fwitter can find you, follow you and see your posts."
                    : "Only other 13 to 15 year olds can find you, follow you and see your posts. Turn this on to be visible to everyone."}
                </Text>
              </>
            )}

            {/* Password */}
            <Text style={styles.sectionLabel}>Password</Text>
            <TextInput
              style={styles.input}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Current password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New password (min 8)"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm new password"
              placeholderTextColor={colors.placeholder}
              secureTextEntry
            />
            <Pressable
              style={[styles.buttonOutline, savingPassword && styles.buttonDisabled]}
              onPress={handleChangePassword}
              disabled={savingPassword}
            >
              {savingPassword ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.buttonOutlineText}>Update password</Text>
              )}
            </Pressable>

            {/* Danger zone */}
            <Text style={styles.sectionLabel}>Delete account</Text>
            <Text style={styles.dangerHelp}>
              Permanently removes your account and everything you’ve posted. There’s no grace period.
            </Text>
            <Pressable
              style={[styles.buttonDanger, deleting && styles.buttonDisabled]}
              onPress={handleDeleteAccount}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={styles.buttonDangerText}>Delete my account</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function ReadonlyRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.roRow, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.roLabel}>{label}</Text>
      <Text style={styles.roValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  headerTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, textTransform: "uppercase" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 20, paddingBottom: 48, gap: 10 },
  sectionLabel: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 14,
  },
  privacyHelp: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 18 },
  readonlyCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  roRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  roLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.textDim },
  roValue: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: "#cfcfcf", marginTop: 4 },
  usernameField: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
  },
  at: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.textDim, marginRight: 4 },
  usernameInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.text },
  bioInput: {
    minHeight: 88,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingTop: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    textAlignVertical: "top",
  },
  input: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  msg: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  button: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontFamily: fonts.heading, fontSize: 16, color: colors.accentText, textTransform: "uppercase", letterSpacing: 0.3 },
  buttonOutline: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonOutlineText: { fontFamily: fonts.heading, fontSize: 16, color: colors.text, textTransform: "uppercase", letterSpacing: 0.3 },
  dangerHelp: { fontFamily: fonts.body, fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: { width: 72, height: 72, borderRadius: 20 },
  avatarPlaceholder: { backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.display, fontSize: 30, color: colors.textBody },
  avatarButton: { flex: 1, marginTop: 0 },
  buttonDanger: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDangerText: { fontFamily: fonts.heading, fontSize: 16, color: colors.danger, textTransform: "uppercase", letterSpacing: 0.3 },
});
