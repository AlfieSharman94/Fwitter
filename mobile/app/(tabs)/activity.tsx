import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../src/api/client";
import { getTimeAgo } from "../../src/components/PostCard";
import { ConsentRequests } from "../../src/components/ConsentRequests";
import { LinkedShortcuts } from "../../src/components/LinkedShortcuts";
import { setUnread } from "../../src/notifications/unread";
import { colors, fonts, radii } from "../../src/theme/theme";

type ActivityType = "REPLY" | "MENTION" | "QUOTE" | "LIKE" | "REPOST" | "FOLLOW" | "WARNING" | "LINK";

type ActivityItem = {
  id: string;
  type: ActivityType;
  created_at: string;
  read_at: string | null;
  note: string | null;
  actor: { id: string; username: string; display_name: string; profile_image_url: string | null };
  post: { id: string; content: string; parent_post_id: string | null } | null;
};

const COPY: Record<ActivityType, string> = {
  REPLY: "replied to your post",
  MENTION: "mentioned you",
  QUOTE: "quoted your post",
  LIKE: "liked your post",
  REPOST: "reposted your post",
  FOLLOW: "followed you",
  WARNING: "sent you a warning",
  LINK: "updated a linked account",
};

const ICON: Record<ActivityType, { name: React.ComponentProps<typeof Ionicons>["name"]; color: string }> = {
  REPLY: { name: "chatbubble", color: colors.accent2 },
  MENTION: { name: "at", color: colors.accent2 },
  QUOTE: { name: "chatbox-ellipses", color: colors.accent2 },
  LIKE: { name: "football", color: colors.like },
  REPOST: { name: "repeat", color: colors.accent },
  FOLLOW: { name: "person-add", color: colors.accent },
  WARNING: { name: "alert-circle", color: colors.warn },
  LINK: { name: "link", color: colors.accent2 },
};

export default function ActivityScreen() {
  const router = useRouter();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null = null) => {
    if (cursor) setLoadingMore(true);
    else {
      setLoading(true);
      setError(null);
    }
    try {
      const base = "/notifications?limit=30";
      const data = await apiFetch(cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base);
      const page: ActivityItem[] = data.notifications ?? [];
      setItems((prev) => (cursor ? [...prev, ...page] : page));
      setNextCursor(data.nextCursor ?? null);
    } catch (e: any) {
      if (!cursor) setError(e?.message ?? "Failed to load activity");
    } finally {
      if (cursor) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  // Opening the tab marks everything read. Rows loaded as unread keep their
  // highlight for this visit, so you can see what's new.
  const markRead = useCallback(async () => {
    try {
      await apiFetch("/notifications/read", { method: "POST" });
      setUnread(0);
    } catch {
      // Badge will catch up on the next refresh.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load().then(markRead);
    }, [load, markRead])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load()
      .then(markRead)
      .finally(() => setRefreshing(false));
  }, [load, markRead]);

  const open = (item: ActivityItem) => {
    if (item.type === "WARNING") return; // nothing to open; the note is the message
    if (item.type === "LINK") return router.push("/linked-accounts");
    if (item.post) router.push(`/posts/${item.post.id}`);
    else router.push(`/users/${item.actor.id}`);
  };

  const renderItem = ({ item }: { item: ActivityItem }) => {
    const icon = ICON[item.type];
    // Warnings come from the moderation team, never attributed to a person.
    const isWarning = item.type === "WARNING";
    const actorName = isWarning ? "Fwitter moderation" : item.actor.display_name;
    const snippet = isWarning ? item.note : item.type === "LINK" ? null : item.post?.content;
    return (
      <Pressable style={[styles.row, !item.read_at && styles.rowUnread]} onPress={() => open(item)}>
        <View style={styles.iconColumn}>
          <Ionicons name={icon.name} size={20} color={icon.color} />
        </View>
        <View style={styles.body}>
          <View style={styles.actorRow}>
            <Pressable onPress={isWarning ? undefined : () => open(item.type === "LINK" ? item : { ...item, post: null })} hitSlop={6}>
              {isWarning ? (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.warn} />
                </View>
              ) : item.actor.profile_image_url ? (
                <Image source={{ uri: item.actor.profile_image_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{item.actor.display_name?.charAt(0)?.toUpperCase() || "?"}</Text>
                </View>
              )}
            </Pressable>
            <Text style={styles.time}>{getTimeAgo(new Date(item.created_at))}</Text>
          </View>
          <Text style={styles.text}>
            <Text style={styles.actorName}>{actorName}</Text> {item.type === "LINK" && item.note ? item.note : COPY[item.type]}
          </Text>
          {!!snippet && (
            <Text style={styles.snippet} numberOfLines={isWarning ? 6 : 2}>
              {snippet}
            </Text>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Activity</Text>
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => load()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <>
              <ConsentRequests />
              <LinkedShortcuts />
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="notifications-outline" size={34} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>Nothing yet</Text>
              <Text style={styles.emptyBody}>Replies, mentions, likes, reposts and new followers will show up here.</Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          onEndReached={nextCursor && !loadingMore && !loading ? () => load(nextCursor) : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footerLoader} size="small" color={colors.accent} /> : null
          }
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
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
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.text,
    textTransform: "uppercase",
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
  row: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowDivider,
  },
  rowUnread: {
    backgroundColor: colors.surface2,
  },
  iconColumn: {
    width: 28,
    alignItems: "center",
    paddingTop: 4,
  },
  body: {
    flex: 1,
    gap: 4,
  },
  actorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 9,
  },
  avatarPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.surface3,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.textBody,
  },
  time: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
  },
  text: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textBody,
  },
  actorName: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  snippet: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textDim,
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
  footerLoader: {
    paddingVertical: 16,
  },
});
