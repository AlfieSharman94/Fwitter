import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../src/api/client";
import { PostCard } from "../../src/components/PostCard";
import type { FeedPost } from "../../src/feed/feedTypes";
import { patchPostList, type PatchPost } from "../../src/feed/engagement";
import { useFeedEvents } from "../../src/feed/optimisticFeed";
import { hasScore, isLive, kickoffTime, statusLabel, type Match } from "../../src/matches/matchTypes";
import { Crest } from "./index";
import { colors, fonts, radii } from "../../src/theme/theme";

const POLL_MS = 20_000;

export default function MatchScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [match, setMatch] = useState<Match | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFeedEvents(setPosts);

  const loadMatch = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetch(`/matches/${id}`);
      setMatch(data.match);
    } catch (e: any) {
      setError((prev) => prev ?? (e?.message ?? "Failed to load match"));
    }
  }, [id]);

  const loadPosts = useCallback(
    async (cursor: string | null = null, silent = false) => {
      if (!id) return;
      if (cursor) setLoadingMore(true);
      else if (!silent) setLoading(true);
      try {
        const base = `/matches/${id}/posts?limit=20`;
        const data = await apiFetch(cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base);
        const page: FeedPost[] = data.posts ?? [];
        // A silent poll only refreshes the newest page; anything already paged in stays.
        setPosts((prev) => {
          if (cursor) return [...prev, ...page];
          if (!silent) return page;
          const known = new Set(prev.map((p) => p.id));
          const fresh = page.filter((p) => !known.has(p.id));
          return [...fresh, ...prev];
        });
        if (!silent) setNextCursor(data.nextCursor ?? null);
        setError(null);
      } catch (e: any) {
        if (!cursor && !silent) setError(e?.message ?? "Failed to load posts");
      } finally {
        if (cursor) setLoadingMore(false);
        else if (!silent) setLoading(false);
      }
    },
    [id]
  );

  // Live hub: refresh the score and pick up new posts while the screen is open.
  useFocusEffect(
    useCallback(() => {
      loadMatch();
      loadPosts();
      const interval = setInterval(() => {
        loadMatch();
        loadPosts(null, true);
      }, POLL_MS);
      return () => clearInterval(interval);
    }, [loadMatch, loadPosts])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([loadMatch(), loadPosts()]).finally(() => setRefreshing(false));
  }, [loadMatch, loadPosts]);

  const patchPost: PatchPost = (postId, patch) => {
    setPosts((prev) => patchPostList(prev, postId, patch));
  };

  const header = (
    <View style={styles.header}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {match?.competition_name ?? "Match"}
      </Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (!match && loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {header}
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!match) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {header}
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error ?? "Match not found"}</Text>
          <Pressable onPress={() => { loadMatch(); loadPosts(); }} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const live = isLive(match.status);
  const score = hasScore(match);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {header}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <PostCard post={item} onPatch={patchPost} />}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListHeaderComponent={
          <View>
            <View style={styles.scoreCard}>
              <View style={styles.side}>
                <Crest uri={match.home_crest} name={match.home_name} size={44} />
                <Text style={styles.sideName} numberOfLines={2}>
                  {match.home_name}
                </Text>
              </View>
              <View style={styles.middle}>
                {score ? (
                  <Text style={[styles.bigScore, live && styles.bigScoreLive]}>
                    {match.home_score} – {match.away_score}
                  </Text>
                ) : (
                  <Text style={styles.bigKickoff}>{kickoffTime(match.kickoff_at)}</Text>
                )}
                <View style={[styles.statusPill, live && styles.statusPillLive]}>
                  <Text style={[styles.statusPillText, live && styles.statusPillTextLive]}>{statusLabel(match)}</Text>
                </View>
              </View>
              <View style={styles.side}>
                <Crest uri={match.away_crest} name={match.away_name} size={44} />
                <Text style={styles.sideName} numberOfLines={2}>
                  {match.away_name}
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.postButton}
              onPress={() => router.push({ pathname: "/compose", params: { match: match.id } })}
            >
              <Ionicons name="create-outline" size={18} color={colors.accentText} />
              <Text style={styles.postButtonText}>Post to this match</Text>
            </Pressable>

            <Text style={styles.sectionLabel}>
              {match.post_count > 0 ? `${match.post_count} ${match.post_count === 1 ? "post" : "posts"}` : "Match thread"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.listLoader} color={colors.accent} />
          ) : (
            <Text style={styles.empty}>Nothing posted yet. Get the chat going.</Text>
          )
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.listLoader} size="small" color={colors.accent} /> : null
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
        onEndReached={nextCursor && !loadingMore && !loading ? () => loadPosts(nextCursor) : undefined}
        onEndReachedThreshold={0.5}
      />
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
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.text,
    textTransform: "uppercase",
    paddingHorizontal: 8,
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
  scoreCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  side: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  sideName: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
    textAlign: "center",
  },
  middle: {
    alignItems: "center",
    gap: 8,
    minWidth: 96,
  },
  bigScore: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.text,
  },
  bigScoreLive: {
    color: colors.accent,
  },
  bigKickoff: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
  },
  statusPillLive: {
    backgroundColor: colors.accent,
  },
  statusPillText: {
    fontFamily: fonts.heading,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusPillTextLive: {
    color: colors.accentText,
  },
  postButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    height: 46,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
  },
  postButtonText: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: colors.accentText,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
  },
  listLoader: {
    marginTop: 24,
  },
  empty: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textDim,
    textAlign: "center",
    marginTop: 24,
    paddingHorizontal: 32,
  },
});
