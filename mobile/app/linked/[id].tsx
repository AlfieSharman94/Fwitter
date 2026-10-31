import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../src/api/client";
import { getTimeAgo } from "../../src/components/PostCard";
import { colors, fonts, radii } from "../../src/theme/theme";

type Item = {
  kind: "POST" | "REPLY" | "QUOTE" | "REPOST" | "FOLLOW" | "MESSAGE";
  id: string;
  createdAt: string;
  text: string | null;
  postId: string | null;
  other: { id: string; username: string } | null;
};

const ICON: Record<Item["kind"], React.ComponentProps<typeof Ionicons>["name"]> = {
  POST: "create-outline",
  REPLY: "chatbubble-outline",
  QUOTE: "chatbox-ellipses-outline",
  REPOST: "repeat",
  FOLLOW: "person-add-outline",
  MESSAGE: "mail-outline",
};

function describe(item: Item): string {
  const who = item.other ? `@${item.other.username}` : "someone";
  switch (item.kind) {
    case "POST":
      return "Posted";
    case "REPLY":
      return `Replied to ${who}`;
    case "QUOTE":
      return `Quoted ${who}`;
    case "REPOST":
      return `Reposted ${who}`;
    case "FOLLOW":
      return `Followed ${who}`;
    case "MESSAGE":
      return `Messaged ${who}`;
  }
}

// What a linked account chose to share, for the adult it is linked to.
export default function LinkedActivityScreen() {
  const router = useRouter();
  const { id, username } = useLocalSearchParams<{ id: string; username?: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (after: string | null = null) => {
      try {
        const data = await apiFetch(`/links/${id}/activity${after ? `?cursor=${encodeURIComponent(after)}` : ""}`);
        setItems((prev) => (after ? [...prev, ...(data.items ?? [])] : data.items ?? []));
        setCursor(data.nextCursor ?? null);
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? "Couldn’t load activity");
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = ({ item }: { item: Item }) => (
    <Pressable style={styles.row} onPress={item.postId ? () => router.push(`/posts/${item.postId}`) : undefined}>
      <Ionicons name={ICON[item.kind]} size={20} color={colors.accent2} style={styles.icon} />
      <View style={{ flex: 1 }}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{describe(item)}</Text>
          <Text style={styles.time}>{getTimeAgo(new Date(item.createdAt))}</Text>
        </View>
        {!!item.text && (
          <Text style={styles.text} numberOfLines={4}>
            {item.text}
          </Text>
        )}
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{username ? `@${username}` : "Activity"}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => `${i.kind}-${i.id}`}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text style={styles.empty}>{error ?? "Nothing to show yet. New activity they share will appear here."}</Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load().finally(() => setRefreshing(false));
              }}
              tintColor={colors.accent}
            />
          }
          onEndReached={cursor ? () => load(cursor) : undefined}
          onEndReachedThreshold={0.5}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  headerTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  icon: { marginTop: 2 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  title: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text, flexShrink: 1 },
  time: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  text: { fontFamily: fonts.body, fontSize: 14, color: colors.textBody, marginTop: 4, lineHeight: 20 },
  separator: { height: 1, backgroundColor: colors.rowDivider },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textFaint, textAlign: "center", padding: 32 },
});
