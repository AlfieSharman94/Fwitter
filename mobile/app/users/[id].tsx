import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Image, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../src/api/client";
import type { FeedPost } from "../../src/feed/feedTypes";
import { PostCard } from "../../src/components/PostCard";
import { ReportSheet, type ReportTarget } from "../../src/components/ReportSheet";
import { patchPostList, type PatchPost } from "../../src/feed/engagement";
import { publishAuthorBlocked, useFeedEvents } from "../../src/feed/optimisticFeed";
import { colors, fonts, radii } from "../../src/theme/theme";

type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isFollowing: boolean;
  isSelf: boolean;
  isBlocked: boolean;
  hasBlockedMe: boolean;
  isVerified: boolean;
};

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const userId = params.id;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  useFeedEvents(setPosts);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setError("User ID required");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/users/${userId}`);
      setProfile(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadPosts = useCallback(async () => {
    if (!userId) return;
    setPostsLoading(true);
    try {
      const data = await apiFetch(`/users/${userId}/posts?limit=50`);
      setPosts(data.posts ?? []);
    } catch {
      // Non-fatal: leave the list empty if this fails.
    } finally {
      setPostsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProfile();
    loadPosts();
  }, [loadProfile, loadPosts]);

  // Refresh when screen regains focus (e.g., after follow/unfollow or posting)
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadProfile();
        loadPosts();
      }
    }, [userId, loadProfile, loadPosts])
  );

  const handleFollow = async () => {
    if (!profile || profile.isSelf) return;

    const previousState = profile.isFollowing;
    setFollowError(null);
    setFollowLoading(true);

    // Optimistic update
    setProfile((prev) => prev ? { ...prev, isFollowing: true, followersCount: prev.followersCount + 1 } : null);

    try {
      const result = await apiFetch(`/users/${userId}/follow`, { method: "POST" });
      setProfile((prev) => prev ? {
        ...prev,
        isFollowing: result.isFollowing,
        followersCount: result.followersCount,
        followingCount: result.followingCount,
      } : null);
    } catch (e: any) {
      setProfile((prev) => prev ? { ...prev, isFollowing: previousState, followersCount: prev.followersCount - 1 } : null);
      setFollowError(e?.message ?? "Failed to follow user");
      Alert.alert("Error", e?.message ?? "Failed to follow user");
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!profile || profile.isSelf) return;

    const previousState = profile.isFollowing;
    setFollowError(null);
    setFollowLoading(true);

    // Optimistic update
    setProfile((prev) => prev ? { ...prev, isFollowing: false, followersCount: Math.max(0, prev.followersCount - 1) } : null);

    try {
      const result = await apiFetch(`/users/${userId}/follow`, { method: "DELETE" });
      setProfile((prev) => prev ? {
        ...prev,
        isFollowing: result.isFollowing,
        followersCount: result.followersCount,
        followingCount: result.followingCount,
      } : null);
    } catch (e: any) {
      setProfile((prev) => prev ? { ...prev, isFollowing: previousState, followersCount: prev.followersCount + 1 } : null);
      setFollowError(e?.message ?? "Failed to unfollow user");
      Alert.alert("Error", e?.message ?? "Failed to unfollow user");
    } finally {
      setFollowLoading(false);
    }
  };

  const patchPost: PatchPost = (id, patch) => {
    setPosts((prev) => patchPostList(prev, id, patch));
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert("Delete post", "This can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/posts/${postId}`, { method: "DELETE" });
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            setProfile((prev) => (prev ? { ...prev, postsCount: Math.max(0, prev.postsCount - 1) } : prev));
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to delete post");
          }
        },
      },
    ]);
  };

  const toggleBlock = async () => {
    if (!profile) return;
    try {
      const res = await apiFetch(`/users/${profile.id}/block`, { method: profile.isBlocked ? "DELETE" : "POST" });
      if (res.blocked) publishAuthorBlocked(profile.id);
      setProfile((prev) => (prev ? { ...prev, isBlocked: res.blocked, isFollowing: false } : prev));
      setPosts([]);
      if (!res.blocked) loadPosts();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to update block");
    }
  };

  const handleMenu = () => {
    if (!profile || profile.isSelf) return;
    Alert.alert(`@${profile.username}`, undefined, [
      { text: "Report user", onPress: () => setReportTarget({ userId: profile.id, label: `@${profile.username}` }) },
      profile.isBlocked
        ? { text: "Unblock", onPress: toggleBlock }
        : {
            text: "Block",
            style: "destructive",
            onPress: () =>
              Alert.alert(
                `Block @${profile.username}?`,
                "You won’t see each other’s posts, and any follows between you are removed.",
                [
                  { text: "Cancel", style: "cancel" },
                  { text: "Block", style: "destructive", onPress: toggleBlock },
                ]
              ),
          },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>Profile</Text>
      {profile && !profile.isSelf ? (
        <Pressable style={styles.backButton} onPress={handleMenu}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </Pressable>
      ) : (
        <View style={{ width: 40 }} />
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {renderHeader()}
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {renderHeader()}
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error ?? "User not found"}</Text>
          <Pressable onPress={loadProfile} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView style={styles.scrollView}>
        {renderHeader()}

        <View style={styles.profileSection}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>{profile.displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <View style={styles.nameRow}>
            <Text style={styles.displayName}>{profile.displayName}</Text>
            {profile.isVerified && <Ionicons name="checkmark-circle" size={22} color={colors.accent2} />}
          </View>
          <Text style={styles.username}>@{profile.username}</Text>

          {!profile.isSelf && profile.isBlocked && (
            <Pressable style={[styles.followButton, styles.followingButton]} onPress={toggleBlock}>
              <Text style={[styles.followButtonText, styles.followingButtonText]}>Unblock</Text>
            </Pressable>
          )}
          {!profile.isSelf && !profile.isBlocked && profile.hasBlockedMe && (
            <Text style={styles.blockedNote}>You can’t follow or see posts from this account.</Text>
          )}
          {!profile.isSelf && !profile.isBlocked && !profile.hasBlockedMe && (
            <Pressable
              style={[
                styles.followButton,
                profile.isFollowing && styles.followingButton,
                followLoading && styles.followButtonDisabled,
              ]}
              onPress={profile.isFollowing ? handleUnfollow : handleFollow}
              disabled={followLoading}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={profile.isFollowing ? colors.text : colors.accentText} />
              ) : (
                <Text style={[styles.followButtonText, profile.isFollowing && styles.followingButtonText]}>
                  {profile.isFollowing ? "Following" : "Follow"}
                </Text>
              )}
            </Pressable>
          )}

          {followError && <Text style={styles.followErrorText}>{followError}</Text>}
        </View>

        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{profile.postsCount}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
          <Pressable style={styles.statItem} onPress={() => router.push(`/users/${userId}/followers`)}>
            <Text style={styles.statValue}>{profile.followersCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </Pressable>
          <Pressable style={styles.statItem} onPress={() => router.push(`/users/${userId}/following`)}>
            <Text style={styles.statValue}>{profile.followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </Pressable>
        </View>

        {/* Posts */}
        <View style={styles.postsSection}>
          <Text style={styles.postsHeader}>Posts</Text>
          {profile.isBlocked || profile.hasBlockedMe ? (
            <Text style={styles.postsEmpty}>
              {profile.isBlocked ? `You’ve blocked @${profile.username}.` : "Posts are hidden."}
            </Text>
          ) : postsLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
          ) : posts.length === 0 ? (
            <Text style={styles.postsEmpty}>
              {profile.isSelf ? "You haven’t posted yet." : "No posts yet."}
            </Text>
          ) : (
            posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onPatch={patchPost}
                onDelete={profile.isSelf ? () => handleDeletePost(p.id) : undefined}
              />
            ))
          )}
        </View>
      </ScrollView>
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
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
  profileSection: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 24,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    backgroundColor: colors.surface3,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontFamily: fonts.display,
    fontSize: 40,
    color: colors.textBody,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  displayName: {
    fontFamily: fonts.display,
    fontSize: 26,
    color: colors.text,
    textTransform: "uppercase",
  },
  username: {
    fontSize: 15,
    color: colors.textDim,
    marginBottom: 20,
    fontFamily: fonts.body,
  },
  followButton: {
    paddingHorizontal: 32,
    paddingVertical: 11,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    minWidth: 140,
    alignItems: "center",
  },
  followingButton: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followButtonDisabled: {
    opacity: 0.6,
  },
  followButtonText: {
    color: colors.accentText,
    fontFamily: fonts.heading,
    fontSize: 15,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  followingButtonText: {
    color: colors.text,
  },
  followErrorText: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 8,
    fontFamily: fonts.body,
  },
  blockedNote: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
    textAlign: "center",
  },
  statsSection: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textDim,
    textTransform: "uppercase",
    fontFamily: fonts.heading,
    letterSpacing: 0.3,
  },
  postsSection: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  postsHeader: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  postsEmpty: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.textDim,
    textAlign: "center",
    marginTop: 24,
  },
});
