import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "../../src/api/client";
import * as SecureStore from "expo-secure-store";

const ONBOARDING_DATA_KEY = "fwitter.onboarding.data";

type Team = {
  id: string;
  name: string;
  logo_url: string | null;
};

export default function TeamsExtraScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [primaryTeamId, setPrimaryTeamId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Load primary team from storage
    (async () => {
      const stored = await SecureStore.getItemAsync(ONBOARDING_DATA_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        setPrimaryTeamId(data.primaryTeamId);
        // Ensure primary team is always selected
        setSelectedTeamIds(new Set([data.primaryTeamId]));
      }
    })();
  }, []);

  const searchTeams = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setTeams([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/teams/search?q=${encodeURIComponent(searchQuery)}`);
      setTeams(data.teams ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to search teams");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleTeam = (teamId: string) => {
    // Prevent deselecting primary team
    if (teamId === primaryTeamId) {
      return;
    }

    const newSet = new Set(selectedTeamIds);
    if (newSet.has(teamId)) {
      newSet.delete(teamId);
    } else {
      if (newSet.size >= 10) {
        setError("You can select up to 10 teams");
        return;
      }
      newSet.add(teamId);
    }
    setSelectedTeamIds(newSet);
    setError(null);
  };

  const handleContinue = async () => {
    if (!primaryTeamId) {
      setError("Primary team not found");
      return;
    }

    const teamIds = Array.from(selectedTeamIds);
    if (teamIds.length === 0) {
      setError("Please select at least one team");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await apiFetch("/users/me/teams", {
        method: "PUT",
        body: JSON.stringify({
          primaryTeamId,
          teamIds,
        }),
      });

      router.push("/(onboarding)/topics");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save teams");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTeamsList = Array.from(selectedTeamIds).map((id) => {
    const team = teams.find((t) => t.id === id);
    return team ? { id, name: team.name } : null;
  }).filter(Boolean) as { id: string; name: string }[];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backButton}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Step 2 of 4</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: "50%" }]} />
      </View>

      <View style={styles.content}>
        <View style={styles.textSection}>
          <Text style={styles.title}>Add more teams</Text>
          <Text style={styles.subtitle}>
            Follow additional teams to see their content in your feed.
          </Text>
        </View>

        {selectedTeamsList.length > 0 && (
          <View style={styles.selectedSection}>
            <Text style={styles.selectedLabel}>Selected teams:</Text>
            <View style={styles.selectedChips}>
              {selectedTeamsList.map((team) => (
                <View
                  key={team.id}
                  style={[
                    styles.chip,
                    team.id === primaryTeamId && styles.chipPrimary,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      team.id === primaryTeamId && styles.chipTextPrimary,
                    ]}
                  >
                    {team.name}
                    {team.id === primaryTeamId && " (Primary)"}
                  </Text>
                  {team.id !== primaryTeamId && (
                    <Pressable
                      onPress={() => toggleTeam(team.id)}
                      style={styles.chipClose}
                    >
                      <Text style={styles.chipCloseText}>×</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search teams..."
              placeholderTextColor="#999"
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                searchTeams(text);
              }}
              autoCapitalize="none"
            />
          </View>
        </View>

        {loading && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" />
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {teams.length > 0 && (
          <FlatList
            data={teams}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isSelected = selectedTeamIds.has(item.id);
              const isPrimary = item.id === primaryTeamId;
              return (
                <Pressable
                  style={[
                    styles.teamCard,
                    isSelected && styles.teamCardSelected,
                    isPrimary && styles.teamCardPrimary,
                  ]}
                  onPress={() => toggleTeam(item.id)}
                  disabled={isPrimary}
                >
                  <Text
                    style={[
                      styles.teamName,
                      isSelected && styles.teamNameSelected,
                    ]}
                  >
                    {item.name}
                    {isPrimary && " (Primary)"}
                  </Text>
                  {isSelected && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </Pressable>
              );
            }}
            style={styles.teamsList}
          />
        )}

        {!loading && teams.length === 0 && query.trim().length > 0 && (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No teams found</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[styles.continueButton, submitting && styles.continueButtonDisabled]}
          onPress={handleContinue}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
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
  },
  textSection: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    lineHeight: 22,
  },
  selectedSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
  },
  selectedLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
    marginBottom: 8,
  },
  selectedChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#0d59f2",
    borderRadius: 20,
  },
  chipPrimary: {
    backgroundColor: "#0d59f2",
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  chipTextPrimary: {
    color: "#fff",
  },
  chipClose: {
    marginLeft: 6,
  },
  chipCloseText: {
    fontSize: 18,
    color: "#fff",
    fontWeight: "700",
  },
  searchSection: {
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#111",
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#c33",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  teamsList: {
    flex: 1,
  },
  teamCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    marginBottom: 8,
  },
  teamCardSelected: {
    backgroundColor: "#0d59f2",
  },
  teamCardPrimary: {
    opacity: 0.8,
  },
  teamName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  teamNameSelected: {
    color: "#fff",
  },
  checkmark: {
    fontSize: 20,
    color: "#fff",
    fontWeight: "700",
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
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
