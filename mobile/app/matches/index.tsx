import React, { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../src/api/client";
import { dayLabel, hasScore, isLive, statusLabel, type Match } from "../../src/matches/matchTypes";
import { colors, fonts, radii } from "../../src/theme/theme";

type Scope = "mine" | "all";
const POLL_MS = 30_000;

export default function MatchdayScreen() {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("mine");
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await apiFetch(`/matches?scope=${scope}`);
        setMatches(data.matches ?? []);
        setError(null);
      } catch (e: any) {
        if (!silent) setError(e?.message ?? "Failed to load matches");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [scope]
  );

  // Load on focus and keep scores fresh while the screen is open.
  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(() => load(true), POLL_MS);
      return () => clearInterval(interval);
    }, [load])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load(true).finally(() => setRefreshing(false));
  }, [load]);

  const sections = groupByDay(matches);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Matchday</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.scopeRow}>
        {(["mine", "all"] as const).map((s) => (
          <Pressable key={s} onPress={() => setScope(s)} style={[styles.scopeChip, scope === s && styles.scopeChipActive]}>
            <Text style={[styles.scopeChipText, scope === s && styles.scopeChipTextActive]}>
              {s === "mine" ? "My clubs" : "All matches"}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && matches.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error && matches.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(m) => m.id}
          renderSectionHeader={({ section }) => <Text style={styles.sectionLabel}>{section.title}</Text>}
          renderItem={({ item }) => <MatchRow match={item} onPress={() => router.push(`/matches/${item.id}`)} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="football-outline" size={34} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No matches</Text>
              <Text style={styles.emptyBody}>
                {scope === "mine"
                  ? "Nothing for your clubs in the next week. Try all matches."
                  : "No fixtures loaded yet. Check back soon."}
              </Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          contentContainerStyle={matches.length === 0 ? styles.emptyContainer : undefined}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

function groupByDay(matches: Match[]) {
  const sections: { title: string; data: Match[] }[] = [];
  for (const m of matches) {
    const title = dayLabel(m.kickoff_at);
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.data.push(m);
    else sections.push({ title, data: [m] });
  }
  return sections;
}

export function MatchRow({ match, onPress }: { match: Match; onPress?: () => void }) {
  const live = isLive(match.status);
  const score = hasScore(match);
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.competition} numberOfLines={1}>
        {match.competition_name}
      </Text>
      <View style={styles.teamsRow}>
        <View style={styles.team}>
          <Crest uri={match.home_crest} name={match.home_name} />
          <Text style={styles.teamName} numberOfLines={1}>
            {match.home_name}
          </Text>
        </View>
        <View style={styles.centre}>
          {score ? (
            <Text style={[styles.score, live && styles.scoreLive]}>
              {match.home_score} – {match.away_score}
            </Text>
          ) : (
            <Text style={styles.kickoff}>{statusLabel(match)}</Text>
          )}
          {score && (
            <Text style={[styles.status, live && styles.statusLive]}>{statusLabel(match)}</Text>
          )}
        </View>
        <View style={[styles.team, styles.teamRight]}>
          <Text style={[styles.teamName, styles.teamNameRight]} numberOfLines={1}>
            {match.away_name}
          </Text>
          <Crest uri={match.away_crest} name={match.away_name} />
        </View>
      </View>
      {match.post_count > 0 && (
        <Text style={styles.postCount}>
          {match.post_count} {match.post_count === 1 ? "post" : "posts"}
        </Text>
      )}
    </Pressable>
  );
}

export function Crest({ uri, name, size = 26 }: { uri: string | null; name: string; size?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size }} resizeMode="contain" />;
  return (
    <View style={[styles.crestPlaceholder, { width: size, height: size, borderRadius: size / 3 }]}>
      <Text style={styles.crestText}>{name.charAt(0).toUpperCase()}</Text>
    </View>
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
  scopeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  scopeChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
  },
  scopeChipActive: {
    backgroundColor: colors.accent,
  },
  scopeChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textMuted,
  },
  scopeChipTextActive: {
    color: colors.accentText,
    fontFamily: fonts.bodyBold,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
    fontFamily: fonts.body,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  retryText: {
    color: colors.accentText,
    fontFamily: fonts.bodyBold,
  },
  sectionLabel: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowDivider,
    gap: 6,
  },
  competition: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
  },
  teamsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  team: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  teamRight: {
    justifyContent: "flex-end",
  },
  teamName: {
    flexShrink: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.text,
  },
  teamNameRight: {
    textAlign: "right",
  },
  centre: {
    minWidth: 64,
    alignItems: "center",
  },
  score: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.text,
  },
  scoreLive: {
    color: colors.accent,
  },
  kickoff: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.textMuted,
  },
  status: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: colors.textDim,
    marginTop: 2,
  },
  statusLive: {
    color: colors.accent,
  },
  postCount: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textDim,
    textAlign: "center",
  },
  crestPlaceholder: {
    backgroundColor: colors.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
  crestText: {
    fontFamily: fonts.heading,
    fontSize: 12,
    color: colors.textBody,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    textTransform: "uppercase",
    marginTop: 18,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 290,
  },
});
