import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { apiFetch } from "../../src/api/client";
import { SideMenu } from "../../src/components/SideMenu";
import { Ionicons } from "@expo/vector-icons";
import type { FeedPost } from "../../src/feed/feedTypes";
import { onNewPost } from "../../src/feed/optimisticFeed";
import { colors, fonts, radii } from "../../src/theme/theme";

type FeedType = "12th-man" | "squad";

export default function HomeScreen() {
  const router = useRouter();
  const [feedType, setFeedType] = useState<FeedType>("12th-man");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const hasLoadedRef = useRef(false);
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

        const endpoint = feedType === "12th-man" ? "/feed/12th-man" : "/feed/squad";
        const url = cursor
          ? `${endpoint}?limit=20&cursor=${encodeURIComponent(cursor)}`
          : `${endpoint}?limit=20`;

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
          // Mark as loaded after first fetch completes (success or error)
          hasLoadedRef.current = true;
        } else {
          setLoadingMore(false);
        }
      }
    },
    [feedType]
  );

  useEffect(() => {
    loadFeed();
  }, [feedType, loadFeed]);

  // Instantly show the current user's own new post (published by the composer)
  // without waiting for a refetch. Dedup by id so a later refetch can't double it.
  useEffect(() => {
    const unsubscribe = onNewPost((post) => {
      setPosts((prev) => (prev.some((p) => p.id === post.id) ? prev : [post, ...prev]));
    });
    return unsubscribe;
  }, []);

  // Refresh when screen comes into focus (e.g., after posting)
  useFocusEffect(
    useCallback(() => {
      // Only refresh if we've loaded before (avoid refresh on initial mount) and API is available
      if (hasLoadedRef.current && !loading && !refreshing && !apiUnavailableRef.current) {
        loadFeed();
      }
    }, [loading, refreshing, loadFeed])
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

  const handleFeedChange = (type: FeedType) => {
    setFeedType(type);
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
          renderItem={({ item }) => <PostCard post={item} />}
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

function PostCard({ post }: { post: FeedPost }) {
  const router = useRouter();
  const teams = post.post_teams.map((x) => x.teams.name);
  const topics = post.post_topics.map((x) => x.topics.name);
  const timeAgo = getTimeAgo(new Date(post.created_at));

  const handleAuthorPress = () => {
    router.push(`/users/${post.author_id}`);
  };

  return (
    <View style={styles.postCard}>
      <View style={styles.postContentWrapper}>
        <Pressable onPress={handleAuthorPress} style={styles.avatarContainer}>
          {post.users.profile_image_url ? (
            <Image source={{ uri: post.users.profile_image_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {post.users.display_name?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
          )}
        </Pressable>

        <View style={styles.postMain}>
          <View style={styles.postHeader}>
            <Pressable onPress={handleAuthorPress} style={styles.postHeaderLeft}>
              <Text style={styles.postAuthor}>{post.users.display_name}</Text>
              <Ionicons name="checkmark-circle" size={14} color={colors.accent2} />
              <Text style={styles.postUsername}>@{post.users.username}</Text>
              <Text style={styles.postTime}>· {timeAgo}</Text>
            </Pressable>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.textDim} />
          </View>

          <Text style={styles.postContent}>{post.content}</Text>

          {(teams.length > 0 || topics.length > 0) && (
            <View style={styles.postTags}>
              {teams.length > 0 && (
                <Text style={styles.tagText}>
                  ⚽ {teams.slice(0, 2).join(", ")}
                  {teams.length > 2 && ` +${teams.length - 2}`}
                </Text>
              )}
              {topics.length > 0 && (
                <Text style={styles.tagText}>
                  {teams.length > 0 ? " · " : ""}
                  🏷️ {topics.slice(0, 2).join(", ")}
                  {topics.length > 2 && ` +${topics.length - 2}`}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
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
  postCard: {
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowDivider,
  },
  postContentWrapper: {
    flexDirection: "row",
    gap: 11,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  avatarContainer: {
    width: 44,
    height: 44,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surface3,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontFamily: fonts.heading,
    fontSize: 16,
    color: colors.textBody,
  },
  postMain: {
    flex: 1,
    gap: 4,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  postHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
    flex: 1,
  },
  postAuthor: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.text,
  },
  postUsername: {
    fontSize: 14,
    color: colors.textDim,
    fontFamily: fonts.body,
  },
  postTime: {
    fontSize: 14,
    color: colors.textDim,
    fontFamily: fonts.body,
  },
  postContent: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textBody,
    marginTop: 2,
  },
  postTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  tagText: {
    fontSize: 13,
    color: colors.textDim,
    fontFamily: fonts.body,
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
