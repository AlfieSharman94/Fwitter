import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../api/client";
import { followErrorMessage } from "../lib/followErrors";
import { colors, fonts, radii } from "../theme/theme";

type ConnectionUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isFollowing: boolean;
};

type Props = {
  userId: string;
  type: "followers" | "following";
};

export function UserConnectionsList({ userId, type }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState<ConnectionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const title = type === "followers" ? "Followers" : "Following";
  const emptyText = type === "followers" ? "No followers yet" : "Not following anyone yet";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Backend caps at 50 and has no cursor/offset paging, so fetch the max in one call.
      const data = await apiFetch(`/users/${userId}/${type}?limit=50`);
      setUsers(data.users ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => {
    load();
  }, [load]);

  // Optimistic in-place update + rollback on error — same pattern as explore.tsx.
  const handleFollow = async (targetId: string) => {
    if (pendingIds.has(targetId)) return; // ignore taps while a request is in flight
    const previousState = users.find((u) => u.id === targetId)?.isFollowing ?? false;
    setPendingIds((prev) => new Set(prev).add(targetId));
    setUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, isFollowing: true } : u)));
    try {
      await apiFetch(`/users/${targetId}/follow`, { method: "POST" });
    } catch (e: any) {
      setUsers((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, isFollowing: previousState } : u)),
      );
      Alert.alert("Error", followErrorMessage(e, "Failed to follow user"));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  const handleUnfollow = async (targetId: string) => {
    if (pendingIds.has(targetId)) return; // ignore taps while a request is in flight
    const previousState = users.find((u) => u.id === targetId)?.isFollowing ?? false;
    setPendingIds((prev) => new Set(prev).add(targetId));
    setUsers((prev) => prev.map((u) => (u.id === targetId ? { ...u, isFollowing: false } : u)));
    try {
      await apiFetch(`/users/${targetId}/follow`, { method: "DELETE" });
    } catch (e: any) {
      setUsers((prev) =>
        prev.map((u) => (u.id === targetId ? { ...u, isFollowing: previousState } : u)),
      );
      Alert.alert("Error", followErrorMessage(e, "Failed to unfollow user"));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(targetId);
        return next;
      });
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.userCard} onPress={() => router.push(`/users/${item.id}`)}>
              <View style={styles.userInfo}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.userDetails}>
                  <Text style={styles.displayName}>{item.displayName}</Text>
                  <Text style={styles.username}>@{item.username}</Text>
                </View>
              </View>
              <Pressable
                style={[
                  styles.followButton,
                  item.isFollowing && styles.followingButton,
                  pendingIds.has(item.id) && styles.followButtonDisabled,
                ]}
                disabled={pendingIds.has(item.id)}
                onPress={(e) => {
                  e.stopPropagation();
                  if (item.isFollowing) {
                    handleUnfollow(item.id);
                  } else {
                    handleFollow(item.id);
                  }
                }}
              >
                <Text style={[styles.followButtonText, item.isFollowing && styles.followingButtonText]}>
                  {item.isFollowing ? "Following" : "Follow"}
                </Text>
              </Pressable>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Text style={styles.emptyText}>{emptyText}</Text>
            </View>
          }
          contentContainerStyle={users.length === 0 ? styles.emptyGrow : undefined}
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
  headerTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, textTransform: "uppercase" },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  errorText: { color: colors.danger, fontSize: 16, textAlign: "center", marginBottom: 16, fontFamily: fonts.body },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  retryText: { color: colors.accentText, fontFamily: fonts.bodyBold },
  emptyText: { fontSize: 16, color: colors.textMuted, fontFamily: fonts.body },
  emptyGrow: { flexGrow: 1 },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 12, marginRight: 12 },
  avatarPlaceholder: { backgroundColor: colors.surface3, justifyContent: "center", alignItems: "center" },
  avatarText: { fontFamily: fonts.heading, fontSize: 18, color: colors.textBody },
  userDetails: { flex: 1 },
  displayName: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.text },
  username: { fontSize: 14, color: colors.textDim, marginTop: 2, fontFamily: fonts.body },
  followButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  followingButton: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border },
  followButtonDisabled: { opacity: 0.5 },
  followButtonText: { color: colors.accentText, fontFamily: fonts.bodyBold, fontSize: 14 },
  followingButtonText: { color: colors.text },
  separator: { height: 1, backgroundColor: colors.rowDivider, marginLeft: 76 },
});
