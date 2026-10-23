import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { apiFetch } from "../../src/api/client";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { colors, fonts, radii } from "../../src/theme/theme";

const ONBOARDING_DATA_KEY = "fwitter.onboarding.data";

type Team = {
  id: string;
  name: string;
  logo_url: string | null;
  league: string | null;
  country: string | null;
};

// English clubs are told apart by division, everyone else by country.
function teamSubtitle(team: Team) {
  return team.country === "England" ? team.league : team.country;
}

export default function TeamSelectionScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [featured, setFeatured] = useState<Team[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [results, setResults] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore a previously-made pick if the user navigated back into this screen
  // (e.g. to fix something on an earlier step) instead of losing it.
  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(ONBOARDING_DATA_KEY);
      if (!stored) return;
      const data = JSON.parse(stored);
      if (data.primaryTeamId && data.primaryTeamName) {
        setSelectedTeam({
          id: data.primaryTeamId,
          name: data.primaryTeamName,
          logo_url: data.primaryTeamLogoUrl ?? null,
          league: null,
          country: null,
        });
      }
    })();
  }, []);

  // Default list shown until the user types something.
  useEffect(() => {
    (async () => {
      try {
        // Public endpoint; the user is not signed in yet during onboarding.
        const data = await apiFetch("/teams/featured", { auth: false });
        setFeatured(data.teams ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load teams");
      } finally {
        setFeaturedLoading(false);
      }
    })();
  }, []);

  const searchTeams = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Public endpoint; the user is not signed in yet during onboarding.
      const data = await apiFetch(`/teams/search?q=${encodeURIComponent(searchQuery)}`, { auth: false });
      setResults(data.teams ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to search teams");
    } finally {
      setLoading(false);
    }
  }, []);

  const searching = query.trim().length > 0;
  const teams = searching ? results : featured;
  const showSpinner = searching ? loading : featuredLoading;

  const handleContinue = async () => {
    if (!selectedTeam) {
      setError("Please select a team");
      return;
    }

    // Store selected team
    const stored = await SecureStore.getItemAsync(ONBOARDING_DATA_KEY);
    const existingData = stored ? JSON.parse(stored) : {};

    await SecureStore.setItemAsync(ONBOARDING_DATA_KEY, JSON.stringify({
      ...existingData,
      primaryTeamId: selectedTeam.id,
      primaryTeamName: selectedTeam.name,
      primaryTeamLogoUrl: selectedTeam.logo_url,
      teamIds: [selectedTeam.id], // Start with just primary team
    }));

    router.push("/(onboarding)/topics");
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
          <View style={[styles.progressFill, { width: "75%" }]} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text style={styles.eyebrow}>Step 3 of 4</Text>
            <Text style={styles.title}>Who do you support?</Text>
            <Text style={styles.subtitle}>Pick your one true club. This shapes your feed.</Text>

            <View style={styles.searchContainer}>
              <Ionicons name="search" size={18} color={colors.textDim} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search teams"
                placeholderTextColor={colors.placeholder}
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  searchTeams(text);
                }}
                autoCapitalize="none"
              />
            </View>

            {showSpinner && (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            {!searching && featured.length > 0 && (
              <Text style={styles.listCaption}>Popular clubs. Can’t see yours? Search above.</Text>
            )}

            {teams.length > 0 && (
              <View style={styles.teamsSection}>
                {teams.map((team) => {
                  const isSelected = selectedTeam?.id === team.id;
                  const subtitle = teamSubtitle(team);
                  return (
                    <Pressable
                      key={team.id}
                      style={[styles.teamCard, isSelected && styles.teamCardSelected]}
                      onPress={() => {
                        setSelectedTeam(team);
                        setError(null);
                      }}
                    >
                      <View style={styles.teamCardContent}>
                        <View style={styles.teamLogoContainer}>
                          <Text style={styles.teamLogoPlaceholder}>⚽</Text>
                        </View>
                        <View style={styles.teamText}>
                          <Text style={styles.teamName}>{team.name}</Text>
                          {!!subtitle && <Text style={styles.teamMeta}>{subtitle}</Text>}
                        </View>
                      </View>
                      {isSelected ? (
                        <View style={styles.selectedIndicator}>
                          <View style={styles.primaryBadge}>
                            <Text style={styles.primaryBadgeText}>Primary</Text>
                          </View>
                          <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                        </View>
                      ) : (
                        <View style={styles.unselectedIndicator} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {!loading && teams.length === 0 && searching && (
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>Can’t find your team? Try searching by city or nickname.</Text>
              </View>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.continueButton, !selectedTeam && styles.continueButtonDisabled]}
            onPress={handleContinue}
            disabled={!selectedTeam}
          >
            <Text style={[styles.continueButtonText, !selectedTeam && styles.continueButtonTextDisabled]}>Continue</Text>
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
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    marginTop: 18,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, fontFamily: fonts.body },
  centerContainer: { paddingVertical: 32, alignItems: "center" },
  errorText: { color: colors.danger, fontSize: 14, textAlign: "center", marginTop: 16, fontFamily: fonts.body },
  listCaption: { fontSize: 13, color: colors.textDim, marginTop: 18, fontFamily: fonts.body },
  teamsSection: { gap: 9, marginTop: 16 },
  teamCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 11,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface2,
  },
  teamCardSelected: { borderColor: colors.accent, backgroundColor: "rgba(0,200,83,0.08)" },
  teamCardContent: { flexDirection: "row", alignItems: "center", flex: 1, gap: 13 },
  teamLogoContainer: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: colors.surface3,
    justifyContent: "center",
    alignItems: "center",
  },
  teamLogoPlaceholder: { fontSize: 20 },
  teamText: { flex: 1 },
  teamName: { fontSize: 16, fontFamily: fonts.bodyMedium, color: colors.text },
  teamMeta: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  selectedIndicator: { flexDirection: "row", alignItems: "center", gap: 8 },
  primaryBadge: { backgroundColor: colors.accent, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  primaryBadgeText: { fontSize: 10, fontFamily: fonts.heading, color: colors.accentText, textTransform: "uppercase" },
  unselectedIndicator: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: "center", fontFamily: fonts.body },
  footer: { paddingHorizontal: 22, paddingBottom: 30, paddingTop: 8 },
  continueButton: { height: 54, borderRadius: radii.lg, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  continueButtonDisabled: { backgroundColor: colors.surface },
  continueButtonText: { fontFamily: fonts.heading, fontSize: 18, color: colors.accentText, textTransform: "uppercase", letterSpacing: 0.4 },
  continueButtonTextDisabled: { color: colors.textFaint },
});
