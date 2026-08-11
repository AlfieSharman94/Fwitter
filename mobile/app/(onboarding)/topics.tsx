import React, { useState, useCallback } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { apiFetch } from "../../src/api/client";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { doSignUp, doSignIn } from "../../src/auth/auth";
import { colors, fonts, radii } from "../../src/theme/theme";

const ONBOARDING_DATA_KEY = "fwitter.onboarding.data";

type Topic = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
};

export default function TopicsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(new Set());
  const [selectedTopicsMap, setSelectedTopicsMap] = useState<Map<string, Topic>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const searchTopics = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setTopics([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/topics/search?q=${encodeURIComponent(searchQuery)}`);
      setTopics(data.topics ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to search topics");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleContinue = async () => {
    const topicIds = Array.from(selectedTopicIds);

    setSubmitting(true);
    setError(null);

    try {
      // Get stored onboarding data
      const stored = await SecureStore.getItemAsync(ONBOARDING_DATA_KEY);
      if (!stored) {
        throw new Error("Onboarding data not found");
      }
      const onboardingData = JSON.parse(stored);

      // Step 1: Sign up with Cognito
      const signUpResult = await doSignUp(onboardingData.email, onboardingData.password);

      // Step 2: If confirmation required, navigate to confirm screen
      if (signUpResult.nextStep?.signUpStep === "CONFIRM_SIGN_UP") {
        // Store all data for after confirmation
        await SecureStore.setItemAsync(ONBOARDING_DATA_KEY, JSON.stringify({
          ...onboardingData,
          topicIds,
          needsConfirmation: true,
        }));
        router.push({
          pathname: "/(auth)/confirm-signup",
          params: { email: onboardingData.email },
        });
        return;
      }

      // Step 3: Auto-confirmed - sign in and create profile
      await doSignIn(onboardingData.email, onboardingData.password);

      // Step 4: Create profile
      await apiFetch("/users/me/profile", {
        method: "POST",
        body: JSON.stringify({
          username: onboardingData.username,
          displayName: onboardingData.displayName,
          dateOfBirth: onboardingData.dateOfBirth,
          ageTier: onboardingData.ageTier,
        }),
      });

      // Step 5: Set teams
      await apiFetch("/users/me/teams", {
        method: "PUT",
        body: JSON.stringify({
          primaryTeamId: onboardingData.primaryTeamId,
          teamIds: onboardingData.teamIds || [onboardingData.primaryTeamId],
        }),
      });

      // Step 6: Set topics
      await apiFetch("/users/me/topics", {
        method: "PUT",
        body: JSON.stringify({
          topicIds,
        }),
      });

      // Step 7: Complete onboarding
      await apiFetch("/users/me/onboarding/complete", {
        method: "POST",
      });

      // Clean up
      await SecureStore.deleteItemAsync(ONBOARDING_DATA_KEY);

      router.replace("/welcome-success");
    } catch (e: any) {
      setError(e?.message ?? "Failed to complete onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTopic = (topic: Topic) => {
    const newSet = new Set(selectedTopicIds);
    const newMap = new Map(selectedTopicsMap);

    if (newSet.has(topic.id)) {
      newSet.delete(topic.id);
      newMap.delete(topic.id);
    } else {
      if (newSet.size >= 50) {
        setError("You can select up to 50 topics");
        return;
      }
      newSet.add(topic.id);
      newMap.set(topic.id, topic);
    }
    setSelectedTopicIds(newSet);
    setSelectedTopicsMap(newMap);
    setError(null);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: "100%" }]} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.eyebrow}>Step 4 of 4</Text>
            <Text style={styles.title}>Tune your topics</Text>
            <Text style={styles.subtitle}>
              Tap what you’re into.{" "}
              <Text style={styles.subtitleCount}>{selectedTopicIds.size}/50 selected</Text>
            </Text>

            {selectedTopicsMap.size > 0 && (
              <View style={styles.selectedChips}>
                {Array.from(selectedTopicsMap.values()).map((topic) => (
                  <Pressable key={topic.id} style={styles.chip} onPress={() => toggleTopic(topic)}>
                    <Text style={styles.chipText}>#{topic.name}</Text>
                    <Ionicons name="close" size={15} color={colors.accentText} />
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={colors.textDim} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search topics (e.g. VAR, Transfer News)"
                placeholderTextColor={colors.placeholder}
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  searchTopics(text);
                }}
                autoCapitalize="none"
              />
            </View>

            {loading && (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            {topics.length > 0 && (
              <View style={styles.topicChips}>
                {topics.map((item) => {
                  const isSelected = selectedTopicIds.has(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.topicPill, isSelected && styles.topicPillSelected]}
                      onPress={() => toggleTopic(item)}
                    >
                      <Text style={[styles.topicPillText, isSelected && styles.topicPillTextSelected]}>
                        #{item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {!loading && topics.length === 0 && query.trim().length > 0 && (
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>Follow more topics to see more relevant content.</Text>
              </View>
            )}

            <View style={styles.infoNote}>
              <Ionicons name="information-circle" size={18} color={colors.accent2} />
              <Text style={styles.infoNoteText}>
                Finishing here creates your account and profile. We’ll set everything up in the background.
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.continueButton, submitting && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.accentText} />
            ) : (
              <Text style={styles.continueButtonText}>Finish &amp; create account</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, paddingTop: 6, paddingBottom: 14 },
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
  progressTrack: { height: 5, backgroundColor: colors.surface3, marginHorizontal: 22, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.accent, borderRadius: 3 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  content: { paddingHorizontal: 22, paddingTop: 24 },
  eyebrow: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 1.5, color: colors.accent, textTransform: "uppercase" },
  title: { fontFamily: fonts.display, fontSize: 34, color: colors.text, textTransform: "uppercase", marginTop: 6 },
  subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, marginTop: 10 },
  subtitleCount: { fontFamily: fonts.bodyBold, color: colors.accent },
  selectedChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
  },
  chipText: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.accentText },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 46,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, fontFamily: fonts.body },
  centerContainer: { paddingVertical: 24, alignItems: "center" },
  errorText: { color: colors.danger, fontSize: 14, textAlign: "center", marginTop: 14, fontFamily: fonts.body },
  topicChips: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 18 },
  topicPill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface3,
  },
  topicPillSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  topicPillText: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.textBody },
  topicPillTextSelected: { color: colors.accentText },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", fontFamily: fonts.body },
  infoNote: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    marginTop: 22,
    padding: 13,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  infoNoteText: { flex: 1, fontSize: 13, color: colors.textMuted, lineHeight: 19, fontFamily: fonts.body },
  footer: { paddingHorizontal: 22, paddingBottom: 30, paddingTop: 8 },
  continueButton: { height: 54, borderRadius: radii.lg, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  continueButtonDisabled: { opacity: 0.6 },
  continueButtonText: { fontFamily: fonts.heading, fontSize: 18, color: colors.accentText, textTransform: "uppercase", letterSpacing: 0.4 },
});
