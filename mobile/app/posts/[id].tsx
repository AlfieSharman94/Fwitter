import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../src/api/client";
import { PostCard } from "../../src/components/PostCard";
import type { FeedPost } from "../../src/feed/feedTypes";
import { patchPostList, type PatchPost } from "../../src/feed/engagement";
import { colors, fonts, radii } from "../../src/theme/theme";

const MAX_LENGTH = 500;

type Parent = { id: string; username: string } | null;

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [post, setPost] = useState<FeedPost | null>(null);
  const [parent, setParent] = useState<Parent>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [replies, setReplies] = useState<FeedPost[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const loadPost = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await apiFetch(`/posts/${id}`);
      setPost(data.post);
      setParent(data.parent ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load post");
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadReplies = useCallback(
    async (cursor: string | null = null) => {
      if (!id) return;
      if (cursor) setLoadingMore(true);
      else setRepliesLoading(true);
      try {
        const url = cursor
          ? `/posts/${id}/replies?limit=20&cursor=${encodeURIComponent(cursor)}`
          : `/posts/${id}/replies?limit=20`;
        const data = await apiFetch(url);
        const page: FeedPost[] = data.replies ?? [];
        setReplies((prev) => (cursor ? [...prev, ...page] : page));
        setNextCursor(data.nextCursor ?? null);
      } catch {
        // Non-fatal: the post still shows and the list keeps whatever it had.
      } finally {
        if (cursor) setLoadingMore(false);
        else setRepliesLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadPost();
    loadReplies();
  }, [loadPost, loadReplies]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([loadPost(), loadReplies()]).finally(() => setRefreshing(false));
  }, [loadPost, loadReplies]);

  const handleLoadMore = () => {
    if (nextCursor && !loadingMore && !repliesLoading) loadReplies(nextCursor);
  };

  // The post and its replies live in separate state; a patch may target either.
  const patchPost: PatchPost = (postId, patch) => {
    setPost((prev) => (prev ? patchPostList([prev], postId, patch)[0] : prev));
    setReplies((prev) => patchPostList(prev, postId, patch));
  };

  const canSend = reply.trim().length > 0 && reply.length <= MAX_LENGTH && !sending;

  const sendReply = async () => {
    const content = reply.trim();
    if (!canSend || !id) return;
    setSending(true);
    try {
      const res = await apiFetch("/posts", {
        method: "POST",
        body: JSON.stringify({ content, parentPostId: id }),
      });
      // The API returns the reply in feed shape, so it can go straight into the list.
      setReplies((prev) => [res.post, ...prev]);
      setPost((prev) => (prev ? { ...prev, reply_count: prev.reply_count + 1 } : prev));
      setReply("");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to post reply");
    } finally {
      setSending(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Text style={styles.headerTitle}>Post</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {header}
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !post) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {header}
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error ?? "Post not found"}</Text>
          <Pressable onPress={loadPost} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {header}
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          data={replies}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => <PostCard post={item} onPatch={patchPost} />}
          ListHeaderComponent={
            <View>
              {parent && (
                <Pressable style={styles.replyingTo} onPress={() => router.push(`/posts/${parent.id}`)}>
                  <Text style={styles.replyingToText}>
                    Replying to <Text style={styles.replyingToName}>@{parent.username}</Text>
                  </Text>
                </Pressable>
              )}
              <PostCard
                post={post}
                onPatch={patchPost}
                pressable={false}
                onReplyPress={() => inputRef.current?.focus()}
              />
              <Text style={styles.sectionLabel}>Replies</Text>
            </View>
          }
          ListEmptyComponent={
            repliesLoading ? (
              <ActivityIndicator style={styles.listLoader} color={colors.accent} />
            ) : (
              <Text style={styles.empty}>No replies yet. Start the conversation.</Text>
            )
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.listLoader} size="small" color={colors.accent} /> : null
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
        />

        <View style={styles.composer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Post your reply"
            placeholderTextColor={colors.placeholder}
            value={reply}
            onChangeText={setReply}
            multiline
            maxLength={MAX_LENGTH}
          />
          <Pressable
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={sendReply}
            disabled={!canSend}
          >
            {sending ? (
              <ActivityIndicator size="small" color={colors.accentText} />
            ) : (
              <Ionicons name="arrow-up" size={20} color={canSend ? colors.accentText : colors.textFaint} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  replyingTo: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  replyingToText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
  },
  replyingToName: {
    color: colors.accent2,
    fontFamily: fonts.bodyMedium,
  },
  sectionLabel: {
    fontFamily: fonts.heading,
    fontSize: 14,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
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
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.bg,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: colors.surface2,
  },
});
