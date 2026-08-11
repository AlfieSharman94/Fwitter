import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";
import { colors, fonts, radii } from "../src/theme/theme";

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const res = await Notifications.getPermissionsAsync();
      setStatus(res.status);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-check on focus so returning from the OS settings reflects any change.
  useFocusEffect(
    useCallback(() => {
      check();
    }, [check])
  );

  const enabled = status === "granted";
  const undetermined = status === "undetermined";

  const statusText = loading ? "Checking…" : enabled ? "Enabled" : undetermined ? "Not set up" : "Disabled";

  const handlePress = async () => {
    if (undetermined) {
      const res = await Notifications.requestPermissionsAsync();
      setStatus(res.status);
      if (res.status !== "granted") {
        Linking.openSettings();
      }
    } else {
      // granted or denied → hand off to the OS settings to change it
      Linking.openSettings();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.statusCard}>
          <View style={[styles.dot, { backgroundColor: enabled ? colors.accent : colors.textFaint }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>Push notifications</Text>
            <Text style={[styles.statusValue, { color: enabled ? colors.accent : colors.textMuted }]}>
              {statusText}
            </Text>
          </View>
        </View>

        <Text style={styles.help}>
          {enabled
            ? "You’re set to receive push notifications from Fwitter. You can manage them anytime in your device settings."
            : "Turn on push notifications in your device settings to get match alerts and replies from Fwitter."}
        </Text>

        <Pressable style={styles.button} onPress={handlePress} disabled={loading}>
          <Text style={styles.buttonText}>
            {undetermined ? "Turn on notifications" : "Open device settings"}
          </Text>
        </Pressable>

        <Text style={styles.note}>
          This reflects your device’s permission for Fwitter. Delivery of actual pushes is set up separately.
        </Text>
      </View>
    </SafeAreaView>
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
  content: { padding: 20, gap: 16 },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  statusValue: { fontFamily: fonts.bodyBold, fontSize: 14, marginTop: 2 },
  help: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  button: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontFamily: fonts.heading, fontSize: 16, color: colors.accentText, textTransform: "uppercase", letterSpacing: 0.3 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, lineHeight: 17 },
});
