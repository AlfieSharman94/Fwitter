import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { colors, fonts, radii } from "../../src/theme/theme";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.container}>
        {/* decorative backdrop (approximates the prototype's radial glow + ring) */}
        <View pointerEvents="none" style={styles.glow} />
        <View pointerEvents="none" style={styles.ring} />

        <View style={styles.content}>
          <View style={styles.badge}>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeText}>Matchday, every day</Text>
          </View>

          <Text style={styles.logo}>
            FWIT<Text style={styles.logoAccent}>TER</Text>
          </Text>

          <Text style={styles.subtitle}>
            Football&rsquo;s loudest dressing room. Follow your clubs, fire off your takes,
            never miss a moment.
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.primaryButton} onPress={() => router.push("/(auth)/sign-up")}>
            <Text style={styles.primaryButtonText}>Create account</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/(auth)/sign-in")}>
            <Text style={styles.secondaryButtonText}>Log in</Text>
          </Pressable>
          <Text style={styles.terms}>By continuing you agree to the Terms &amp; House Rules.</Text>
        </View>
      </View>
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
    paddingHorizontal: 28,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: 40,
    alignSelf: "center",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(0,200,83,0.07)",
  },
  ring: {
    position: "absolute",
    top: -90,
    alignSelf: "center",
    width: 340,
    height: 340,
    borderRadius: 170,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.06)",
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: "rgba(0,200,83,0.12)",
    borderWidth: 1,
    borderColor: "rgba(0,200,83,0.3)",
    marginBottom: 22,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  badgeText: {
    fontFamily: fonts.heading,
    fontSize: 12,
    letterSpacing: 1.5,
    color: colors.accent,
    textTransform: "uppercase",
  },
  logo: {
    fontFamily: fonts.display,
    fontSize: 72,
    lineHeight: 74,
    color: colors.text,
    letterSpacing: -1,
    textTransform: "uppercase",
  },
  logoAccent: {
    color: colors.accent,
  },
  subtitle: {
    fontFamily: fonts.body,
    marginTop: 18,
    fontSize: 18,
    lineHeight: 25,
    color: colors.textMuted,
    maxWidth: 300,
  },
  footer: {
    paddingBottom: 24,
    gap: 12,
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
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.accentText,
  },
  secondaryButton: {
    height: 54,
    borderRadius: radii.lg,
    backgroundColor: colors.surface2,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: fonts.heading,
    fontSize: 18,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.text,
  },
  terms: {
    textAlign: "center",
    fontSize: 12,
    color: colors.textFaint,
    marginTop: 6,
  },
});
