import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../src/auth/AuthProvider";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii } from "../src/theme/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const handleLogOut = async () => {
    await signOut();
    router.replace("/(auth)/welcome");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Pressable style={styles.settingItem} onPress={() => router.push("/account")}>
            <View style={styles.settingItemContent}>
              <Ionicons name="person-circle" size={24} color={colors.text} />
              <Text style={[styles.settingItemText, styles.settingItemTextEnabled]}>Account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
          </Pressable>

          <Pressable style={styles.settingItem} onPress={() => router.push("/notification-settings")}>
            <View style={styles.settingItemContent}>
              <Ionicons name="notifications" size={24} color={colors.text} />
              <Text style={[styles.settingItemText, styles.settingItemTextEnabled]}>Notifications</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
          </Pressable>

          <Pressable style={styles.settingItem} disabled>
            <View style={styles.settingItemContent}>
              <Ionicons name="lock-closed" size={24} color={colors.textDim} />
              <Text style={styles.settingItemText}>Privacy</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Pressable style={styles.logoutItem} onPress={handleLogOut}>
            <Ionicons name="log-out-outline" size={24} color={colors.danger} />
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  },
  section: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  settingItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  settingItemText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textDim,
  },
  settingItemTextEnabled: {
    color: colors.text,
  },
  logoutItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  logoutText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.danger,
  },
});
