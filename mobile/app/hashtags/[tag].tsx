import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../src/api/client";
import { PostCard } from "../../src/components/PostCard";
import type { FeedPost } from "../../src/feed/feedTypes";
import { patchPostList, type PatchPost } from "../../src/feed/engagement";
import { useFeedEvents } from "../../src/feed/optimisticFeed";
import { colors, fonts, radii } from "../../src/theme/theme";

export default function HashtagScreen() {
  const router = useRouter();
  const { tag: rawTag } = useLocalSearchParams<{ tag: string }>();
  const tag = (rawTag ?? "").toLowerCase();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFeedEvents(setPosts);

  const load = useCallback(
    async (cursor: string | null = null) => {
      if (!tag) return;
      if (cursor) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const base = `/hashtags/${encodeURIComponent(tag)}/posts?limit=20`;
        const data = await apiFetch(cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base);
        const page: FeedPost[] = data.posts ?? [];
        setPosts((prev) => (cursor ? [...prev, ...page] : page));
        setNextCursor(data.nextCursor ?? null);
      } catch (e: any) {
        if (!cursor) setError(e?.message ?? "Failed to load posts");
      } finally {
        if (cursor) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [tag]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  const patchPost: PatchPost = (id, patch) => {
    setPosts((prev) => patchPostList(prev, id, patch));
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          #{tag}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {loading && posts.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error && posts.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PostCard post={item} onPatch={patchPost} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptyBody}>Be the first to post with #{tag}.</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          onEndReached={nextCursor && !loadingMore && !loading ? () => load(nextCursor) : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footerLoader} size="small" color={colors.accent} /> : null
          }
          contentContainerStyle={posts.length === 0 ? styles.emptyContainer : undefined}
        />
      )}
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
    fontSize: 18,
    color: colors.accent2,
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
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    textTransform: "uppercase",
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
  footerLoader: {
    paddingVertical: 16,
  },
});
