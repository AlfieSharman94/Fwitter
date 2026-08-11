import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii } from "../src/theme/theme";

export default function WelcomeSuccessScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.iconGlow}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={42} color={colors.accentText} />
          </View>
        </View>

        <Text style={styles.title}>You’re in!</Text>
        <Text style={styles.subtitle}>
          Your locker’s ready. Time to make some noise on the timeline.
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.primaryButton} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.primaryButtonText}>Enter Fwitter</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
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
  title: {
    fontFamily: fonts.display,
    fontSize: 38,
    color: colors.text,
    textTransform: "uppercase",
    marginTop: 24,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 280,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
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
});
