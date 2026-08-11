import React, { useState, useCallback } from "react";
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../src/api/client";
import { followErrorMessage } from "../../src/lib/followErrors";
import { colors, fonts, radii } from "../../src/theme/theme";

type SearchUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isFollowing: boolean;
};

export default function ExploreScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setError("Search query must be at least 2 characters");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/search/users?q=${encodeURIComponent(trimmed)}&limit=20`);
      setUsers(data.users ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to search users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleFollow = async (userId: string) => {
    if (pendingIds.has(userId)) return; // ignore taps while a request is in flight
    const previousState = users.find((u) => u.id === userId)?.isFollowing ?? false;
    setPendingIds((prev) => new Set(prev).add(userId));
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isFollowing: true } : u)));

    try {
      await apiFetch(`/users/${userId}/follow`, { method: "POST" });
    } catch (e: any) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isFollowing: previousState } : u)),
      );
      setError(followErrorMessage(e, "Failed to follow user"));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleUnfollow = async (userId: string) => {
    if (pendingIds.has(userId)) return; // ignore taps while a request is in flight
    const previousState = users.find((u) => u.id === userId)?.isFollowing ?? false;
    setPendingIds((prev) => new Set(prev).add(userId));
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isFollowing: false } : u)));

    try {
      await apiFetch(`/users/${userId}/follow`, { method: "DELETE" });
    } catch (e: any) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isFollowing: previousState } : u)),
      );
      setError(followErrorMessage(e, "Failed to unfollow user"));
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handleUserPress = (userId: string) => {
    router.push(`/users/${userId}`);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Explore</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchField}>
          <Ionicons name="search" size={18} color={colors.textDim} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users…"
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Pressable
          onPress={handleSearch}
          disabled={loading || query.trim().length < 2}
          style={[styles.searchButton, (loading || query.trim().length < 2) && styles.searchButtonDisabled]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.accentText} />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </Pressable>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {users.length > 0 && (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.userCard} onPress={() => handleUserPress(item.id)}>
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
        />
      )}

      {!loading && users.length === 0 && query.trim().length >= 2 && !error && (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No users found</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerBar: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    textTransform: "uppercase",
  },
  searchContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  searchField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontFamily: fonts.body,
  },
  searchButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    borderRadius: radii.pill,
    justifyContent: "center",
  },
  searchButtonDisabled: {
    backgroundColor: colors.surface,
  },
  searchButtonText: {
    color: colors.accentText,
    fontFamily: fonts.heading,
    textTransform: "uppercase",
    fontSize: 14,
  },
  errorText: {
    color: colors.danger,
    paddingHorizontal: 16,
    paddingTop: 10,
    fontSize: 14,
    fontFamily: fonts.body,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surface3,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.textBody,
  },
  userDetails: {
    flex: 1,
  },
  displayName: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.text,
  },
  username: {
    fontSize: 14,
    color: colors.textDim,
    marginTop: 2,
    fontFamily: fonts.body,
  },
  followButton: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  followingButton: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followButtonDisabled: {
    opacity: 0.5,
  },
  followButtonText: {
    color: colors.accentText,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
  },
  followingButtonText: {
    color: colors.text,
  },
  separator: {
    height: 1,
    backgroundColor: colors.rowDivider,
    marginLeft: 76,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textMuted,
    fontFamily: fonts.body,
  },
});
