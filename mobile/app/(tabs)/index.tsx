import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { apiFetch } from "../../src/api/client";
import { SideMenu } from "../../src/components/SideMenu";
import { PostCard } from "../../src/components/PostCard";
import { patchPostList, type PatchPost } from "../../src/feed/engagement";
import { Ionicons } from "@expo/vector-icons";
import type { FeedPost } from "../../src/feed/feedTypes";
import { onNewPost, useFeedEvents } from "../../src/feed/optimisticFeed";
import { colors, fonts, radii } from "../../src/theme/theme";

type FeedType = "12th-man" | "squad";
type FeedSort = "ranked" | "latest";

export default function HomeScreen() {
  const router = useRouter();
  const [feedType, setFeedType] = useState<FeedType>("squad");
  // 12th Man only: "For you" (ranked) or "Latest" (chronological).
  const [sort, setSort] = useState<FeedSort>("ranked");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const apiUnavailableRef = useRef(false); // Track if API is unavailable to prevent repeated retries

  const loadFeed = useCallback(
    async (cursor: string | null = null, append: boolean = false) => {
      // Don't retry if API is unavailable
      if (apiUnavailableRef.current && !append) {
        return;
      }

      try {
        if (!append) {
          setLoading(true);
          setError(null);
        } else {
          setLoadingMore(true);
        }

        const endpoint = feedType === "12th-man" ? `/feed/12th-man?limit=20&sort=${sort}` : "/feed/squad?limit=20";
        const url = cursor ? `${endpoint}&cursor=${encodeURIComponent(cursor)}` : endpoint;

        const data = await apiFetch(url);

        // API is working - reset the unavailable flag
        apiUnavailableRef.current = false;

        if (append) {
          setPosts((prev) => [...prev, ...(data.posts ?? [])]);
        } else {
          setPosts(data.posts ?? []);
        }
        setNextCursor(data.nextCursor ?? null);
      } catch (e: any) {
        const errorMsg = e?.message || "";

        // If it's a network error, mark API as unavailable to prevent repeated retries
        if (errorMsg.includes("Cannot reach API") || errorMsg.includes("Network request failed") || errorMsg.includes("Failed to fetch")) {
          apiUnavailableRef.current = true;
        }

        if (!append) {
          setError(errorMsg || "Failed to load feed");
        }
      } finally {
        if (!append) {
          setLoading(false);
        } else {
          setLoadingMore(false);
        }
      }
    },
    [feedType, sort]
  );

  useFeedEvents(setPosts);

  // Instantly show the current user's own new post (published by the composer)
  // without waiting for a refetch. Dedup by id so a later refetch can't double it.
  useEffect(() => {
    const unsubscribe = onNewPost((post) => {
      setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
    });
    return unsubscribe;
  }, []);

  // Loads on mount, when the feed type changes (new loadFeed identity), and whenever the
  // screen regains focus (e.g. after posting). Deps are deliberately just loadFeed: having
  // `loading` in them re-ran this after every fetch and started another one, so the feed
  // refetched forever while the screen was focused. loadFeed already no-ops while the API
  // is marked unavailable.
  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed().finally(() => setRefreshing(false));
  }, [loadFeed]);

  const hasNextPage = !!nextCursor;
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !loadingMore && !loading) {
      loadFeed(nextCursor, true);
    }
  }, [hasNextPage, nextCursor, loadingMore, loading, loadFeed]);

  const patchPost = useCallback<PatchPost>((id, patch) => {
    setPosts((prev) => patchPostList(prev, id, patch));
  }, []);

  const handleFeedChange = (type: FeedType) => {
    setFeedType(type);
    setPosts([]);
    setNextCursor(null);
  };

  const handleSortChange = (next: FeedSort) => {
    if (next === sort) return;
    setSort(next);
    setPosts([]);
    setNextCursor(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => setDrawerVisible(true)} style={styles.profileButton}>
          <View style={styles.profileIcon}>
            <Ionicons name="person" size={18} color={colors.accentText} />
          </View>
        </Pressable>
        <View style={styles.logoContainer}>
          <Ionicons name="football" size={26} color={colors.accent} />
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Feed Toggle */}
      <View style={styles.toggleContainer}>
        <Pressable
          onPress={() => handleFeedChange("squad")}
          style={[styles.toggleButton, feedType === "squad" && styles.toggleButtonActive]}
        >
          <Text style={[styles.toggleText, feedType === "squad" && styles.toggleTextActive]}>Squad</Text>
        </Pressable>
        <Pressable
          onPress={() => handleFeedChange("12th-man")}
          style={[styles.toggleButton, feedType === "12th-man" && styles.toggleButtonActive]}
        >
          <Text style={[styles.toggleText, feedType === "12th-man" && styles.toggleTextActive]}>12th Man</Text>
        </Pressable>
      </View>

      {feedType === "12th-man" && (
        <View style={styles.sortRow}>
          {(["ranked", "latest"] as const).map((s) => (
            <Pressable
              key={s}
              onPress={() => handleSortChange(s)}
              style={[styles.sortChip, sort === s && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, sort === s && styles.sortChipTextActive]}>
                {s === "ranked" ? "For you" : "Latest"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Feed Content */}
      {loading && posts.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error && posts.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => loadFeed()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={posts}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <PostCard post={item} onPatch={patchPost} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            feedType === "squad" ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="people" size={34} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>Build your Squad</Text>
                <Text style={styles.emptyBody}>
                  Follow people to fill this feed with their posts.
                </Text>
                <Pressable onPress={() => router.push("/(tabs)/explore")} style={styles.ctaButton}>
                  <Text style={styles.ctaButtonText}>Find people to follow</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="football-outline" size={34} color={colors.accent} />
                </View>
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.emptyBody}>
                  Posts about the teams and topics you follow will show up here.
                </Text>
              </View>
            )
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
          onEndReached={hasNextPage && !loadingMore && !loading ? handleLoadMore : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.accent} />
              </View>
            ) : null
          }
          contentContainerStyle={posts.length === 0 ? styles.emptyContainer : undefined}
        />
      )}

      {/* Floating + Button */}
      <Pressable style={styles.fab} onPress={() => router.push("/compose")}>
        <Ionicons name="add" size={28} color={colors.accentText} />
      </Pressable>

      {/* Side Menu */}
      <SideMenu visible={drawerVisible} onClose={() => setDrawerVisible(false)} />
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
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  profileButton: {
    width: 40,
    height: 40,
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    flex: 1,
    alignItems: "center",
  },
  toggleContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  toggleButtonActive: {
    borderBottomColor: colors.accent,
  },
  toggleText: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.textDim,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  toggleTextActive: {
    color: colors.text,
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sortChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
  },
  sortChipActive: {
    backgroundColor: colors.accent,
  },
  sortChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textMuted,
  },
  sortChipTextActive: {
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
  separator: {
    height: 0,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.accent,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  ctaButton: {
    marginTop: 20,
    paddingVertical: 13,
    paddingHorizontal: 24,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
  },
  ctaButtonText: {
    fontFamily: fonts.heading,
    color: colors.accentText,
    fontSize: 15,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
