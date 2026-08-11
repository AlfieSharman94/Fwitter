import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "../../src/api/client";
import * as SecureStore from "expo-secure-store";

const ONBOARDING_DATA_KEY = "fwitter.onboarding.data";

export default function FinishScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinish = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await apiFetch("/users/me/onboarding/complete", {
        method: "POST",
      });

      // Clean up onboarding data
      await SecureStore.deleteItemAsync(ONBOARDING_DATA_KEY);

      router.replace("/welcome-success");
    } catch (e: any) {
      setError(e?.message ?? "Failed to complete onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backButton}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Step 4 of 4</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: "100%" }]} />
      </View>

      <View style={styles.content}>
        <View style={styles.textSection}>
          <Text style={styles.title}>You're all set!</Text>
          <Text style={styles.subtitle}>
            Your profile is complete. You can now start exploring and connecting with other football fans.
          </Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueButton, submitting && styles.continueButtonDisabled]}
          onPress={handleFinish}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>Finish</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    fontSize: 20,
    color: "#111",
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  progressBar: {
    height: 6,
    backgroundColor: "#e5e5e5",
    marginHorizontal: 16,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0d59f2",
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: "center",
  },
  textSection: {
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    color: "#111",
    marginBottom: 16,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    lineHeight: 22,
    textAlign: "center",
  },
  errorText: {
    color: "#c33",
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
  },
  continueButton: {
    backgroundColor: "#0d59f2",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  continueButtonDisabled: {
    backgroundColor: "#999",
  },
  continueButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
});
