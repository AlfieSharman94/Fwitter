import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../src/api/client";
import { getTimeAgo } from "../../src/components/PostCard";
import { refreshDmUnread, type Conversation } from "../../src/dm/unread";
import { colors, fonts, radii } from "../../src/theme/theme";

const POLL_MS = 15_000;

export default function MessagesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch("/dm/conversations");
      setItems(data.conversations ?? []);
      setError(null);
      refreshDmUnread();
    } catch (e: any) {
      if (!silent) setError(e?.message ?? "Failed to load messages");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
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
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/dm/${item.id}`)}>
              {item.other.profile_image_url ? (
                <Image source={{ uri: item.other.profile_image_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{item.other.display_name?.charAt(0)?.toUpperCase() || "?"}</Text>
                </View>
              )}
              <View style={styles.body}>
                <View style={styles.topLine}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, item.unread > 0 && styles.nameUnread]} numberOfLines={1}>
                      {item.other.display_name}
                    </Text>
                    {item.other.verified_at && <Ionicons name="checkmark-circle" size={14} color={colors.accent2} />}
                  </View>
                  {item.last_message_at && <Text style={styles.time}>{getTimeAgo(new Date(item.last_message_at))}</Text>}
                </View>
                <View style={styles.previewRow}>
                  <Text style={[styles.preview, item.unread > 0 && styles.previewUnread]} numberOfLines={1}>
                    {item.last_message_preview ?? ""}
                  </Text>
                  {item.unread > 0 && <View style={styles.unreadDot} />}
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={34} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptyBody}>
                You can message people who follow you back. Open someone’s profile and tap Message.
              </Text>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          contentContainerStyle={items.length === 0 ? styles.emptyContainer : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, textTransform: "uppercase" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  errorText: { color: colors.danger, fontSize: 16, textAlign: "center", marginBottom: 16, fontFamily: fonts.body },
  retryButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.accent, borderRadius: radii.sm },
  retryText: { color: colors.accentText, fontFamily: fonts.bodyBold },
  row: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.rowDivider },
  avatar: { width: 48, height: 48, borderRadius: 14 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surface3, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.heading, fontSize: 18, color: colors.textBody },
  body: { flex: 1, justifyContent: "center", gap: 4 },
  topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 },
  name: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.textBody, flexShrink: 1 },
  nameUnread: { fontFamily: fonts.bodyBold, color: colors.text },
  time: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  preview: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.textDim },
  previewUnread: { color: colors.textBody, fontFamily: fonts.bodyMedium },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  emptyContainer: { flexGrow: 1 },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyIcon: { width: 84, height: 84, borderRadius: 24, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSubtle, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.text, textTransform: "uppercase", marginTop: 18 },
  emptyBody: { fontFamily: fonts.body, fontSize: 15, color: colors.textMuted, textAlign: "center", lineHeight: 22, marginTop: 10, maxWidth: 290 },
});
