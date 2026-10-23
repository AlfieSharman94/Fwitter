import { useState } from "react";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../api/client";
import { useMe } from "../auth/me";
import type { FeedPost, FeedPostBase, FeedPostQuoting } from "../feed/feedTypes";
import { toggleBookmark, toggleLike, toggleRepost, type PatchPost } from "../feed/engagement";
import { publishAuthorBlocked, publishPostRemoved } from "../feed/optimisticFeed";
import { PostText } from "./PostText";
import { PollView } from "./PollView";
import { MediaGrid } from "./MediaGrid";
import { ReportSheet, type ReportTarget } from "./ReportSheet";
import { colors, fonts, radii } from "../theme/theme";

type Props = {
  post: FeedPost;
  // Applies like/bookmark/repost changes to the list that owns this post.
  onPatch: PatchPost;
  // Tapping the card opens the post. Off for the main post on its own screen.
  pressable?: boolean;
  // Overrides what the reply action does (default: open the post).
  onReplyPress?: () => void;
  // When set, a trash icon replaces the overflow dots (used on your own profile).
  onDelete?: () => void;
};

export function PostCard({ post, onPatch, pressable = true, onReplyPress, onDelete }: Props) {
  const router = useRouter();
  // A plain repost is a wrapper row: show the original and credit the reposter above it.
  // Every action below targets `shown`, never the wrapper.
  const shown: FeedPostQuoting = post.repost_of ?? post;
  const repostedBy = post.repost_of ? post.users : null;
  const teams = shown.post_teams.map((x) => x.teams.name);
  const topics = shown.post_topics.map((x) => x.topics.name);
  const timeAgo = getTimeAgo(new Date(shown.created_at));

  const openPost = () => router.push(`/posts/${shown.id}`);
  const openAuthor = () => router.push(`/users/${shown.author_id}`);
  const replyAction = onReplyPress ?? (pressable ? openPost : undefined);

  const onRepostPress = () => {
    const undo = shown.reposted_by_me;
    Alert.alert(undo ? "Undo repost?" : "Repost", undefined, [
      { text: undo ? "Undo repost" : "Repost", onPress: () => toggleRepost(shown, onPatch) },
      { text: "Quote", onPress: () => router.push({ pathname: "/compose", params: { quote: shown.id } }) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // The "…" menu: delete your own post, or report / block for someone else's.
  const me = useMe();
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const isMine = !!me && shown.author_id === me.id;

  const deletePost = () => {
    Alert.alert("Delete post", "This can’t be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/posts/${shown.id}`, { method: "DELETE" });
            publishPostRemoved(shown.id);
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Failed to delete post");
          }
        },
      },
    ]);
  };

  const blockAuthor = () => {
    Alert.alert(
      `Block @${shown.users.username}?`,
      "You won’t see each other’s posts, and any follows between you are removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              await apiFetch(`/users/${shown.author_id}/block`, { method: "POST" });
              publishAuthorBlocked(shown.author_id);
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Failed to block");
            }
          },
        },
      ]
    );
  };

  const onMenuPress = () => {
    if (isMine) {
      deletePost();
      return;
    }
    Alert.alert(`@${shown.users.username}`, undefined, [
      { text: "Report post", onPress: () => setReportTarget({ postId: shown.id, label: "post" }) },
      { text: `Block @${shown.users.username}`, style: "destructive", onPress: blockAuthor },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <Pressable style={styles.postCard} onPress={pressable ? openPost : undefined}>
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
      {shown.hidden_at && (
        <View style={styles.hiddenBanner}>
          <Ionicons name="eye-off-outline" size={14} color={colors.warn} />
          <Text style={styles.hiddenBannerText}>Hidden while we review reports. Only you can see this.</Text>
        </View>
      )}
      {repostedBy && (
        <Pressable style={styles.repostHeader} onPress={() => router.push(`/users/${post.author_id}`)} hitSlop={6}>
          <Ionicons name="repeat" size={14} color={colors.textDim} />
          <Text style={styles.repostHeaderText}>{repostedBy.display_name} reposted</Text>
        </Pressable>
      )}

      <View style={styles.postContentWrapper}>
        <Pressable onPress={openAuthor} style={styles.avatarContainer}>
          {shown.users.profile_image_url ? (
            <Image source={{ uri: shown.users.profile_image_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {shown.users.display_name?.charAt(0)?.toUpperCase() || "?"}
              </Text>
            </View>
          )}
        </Pressable>

        <View style={styles.postMain}>
          <View style={styles.postHeader}>
            <Pressable onPress={openAuthor} style={styles.postHeaderLeft}>
              <Text style={styles.postAuthor}>{shown.users.display_name}</Text>
              {shown.users.verified_at && <Ionicons name="checkmark-circle" size={14} color={colors.accent2} />}
              <Text style={styles.postUsername}>@{shown.users.username}</Text>
              <Text style={styles.postTime}>· {timeAgo}</Text>
            </Pressable>
            {onDelete ? (
              <Pressable onPress={onDelete} hitSlop={10}>
                <Ionicons name="trash-outline" size={18} color={colors.textDim} />
              </Pressable>
            ) : (
              <Pressable onPress={onMenuPress} hitSlop={10}>
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.textDim} />
              </Pressable>
            )}
          </View>

          <PostText
            content={shown.content}
            mentions={shown.mentions}
            hashtags={shown.hashtags}
            style={styles.postContent}
          />

          {shown.media.length > 0 && <MediaGrid media={shown.media} />}

          {shown.poll && <PollView post={shown} onPatch={onPatch} />}

          {shown.quoted_post && <QuotedPost post={shown.quoted_post} />}

          {shown.match && (
            <Pressable style={styles.matchChip} onPress={() => router.push(`/matches/${shown.match!.id}`)} hitSlop={4}>
              <Ionicons name="football" size={13} color={colors.accent} />
              <Text style={styles.matchChipText} numberOfLines={1}>
                {shown.match.home_name} v {shown.match.away_name}
              </Text>
            </Pressable>
          )}

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

          <View style={styles.actions}>
            <Pressable style={styles.action} onPress={replyAction} hitSlop={8}>
              <Ionicons name="chatbubble-outline" size={17} color={colors.textDim} />
              {shown.reply_count > 0 && <Text style={styles.actionCount}>{shown.reply_count}</Text>}
            </Pressable>
            <Pressable style={styles.action} onPress={onRepostPress} hitSlop={8}>
              <Ionicons name="repeat" size={19} color={shown.reposted_by_me ? colors.accent : colors.textDim} />
              {/* Counts are null unless you're the author: others only see the icons. */}
              {shown.repost_count !== null && shown.repost_count > 0 && (
                <Text style={[styles.actionCount, shown.reposted_by_me && styles.actionCountReposted]}>
                  {shown.repost_count}
                </Text>
              )}
            </Pressable>
            <Pressable style={styles.action} onPress={() => toggleLike(shown, onPatch)} hitSlop={8}>
              <Ionicons
                name={shown.liked_by_me ? "heart" : "heart-outline"}
                size={18}
                color={shown.liked_by_me ? colors.like : colors.textDim}
              />
              {shown.like_count !== null && shown.like_count > 0 && (
                <Text style={[styles.actionCount, shown.liked_by_me && styles.actionCountLiked]}>
                  {shown.like_count}
                </Text>
              )}
            </Pressable>
            <Pressable style={[styles.action, styles.actionEnd]} onPress={() => toggleBookmark(shown, onPatch)} hitSlop={8}>
              <Ionicons
                name={shown.bookmarked_by_me ? "bookmark" : "bookmark-outline"}
                size={17}
                color={shown.bookmarked_by_me ? colors.accent2 : colors.textDim}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

// The embedded original inside a quote post. Also used by the composer as a preview.
export function QuotedPost({ post }: { post: FeedPostBase }) {
  const router = useRouter();
  return (
    <Pressable style={styles.quote} onPress={() => router.push(`/posts/${post.id}`)}>
      <View style={styles.quoteHeader}>
        <Text style={styles.quoteAuthor} numberOfLines={1}>
          {post.users.display_name}
        </Text>
        {post.users.verified_at && <Ionicons name="checkmark-circle" size={13} color={colors.accent2} />}
        <Text style={styles.quoteMeta} numberOfLines={1}>
          @{post.users.username} · {getTimeAgo(new Date(post.created_at))}
        </Text>
      </View>
      {!!post.content && (
        <PostText
          content={post.content}
          mentions={post.mentions}
          hashtags={post.hashtags}
          style={styles.quoteContent}
          numberOfLines={6}
        />
      )}
      {post.media.length > 0 && (
        <Image source={{ uri: post.media[0].url }} style={styles.quoteImage} resizeMode="cover" />
      )}
    </Pressable>
  );
}

export function getTimeAgo(date: Date): string {
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
  postCard: {
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowDivider,
  },
  hiddenBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: "rgba(255, 176, 32, 0.12)",
  },
  hiddenBannerText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.warn,
  },
  repostHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 10,
    paddingLeft: 16 + 44 + 11, // line up with the post body, past the avatar column
    paddingRight: 16,
    marginBottom: -6,
  },
  repostHeaderText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textDim,
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
  quote: {
    marginTop: 10,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    gap: 4,
  },
  quoteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  quoteAuthor: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
  },
  quoteMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    flexShrink: 1,
  },
  quoteContent: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textBody,
  },
  quoteImage: {
    width: "100%",
    height: 140,
    borderRadius: radii.sm,
    marginTop: 6,
    backgroundColor: colors.surface3,
  },
  matchChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  matchChipText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textBody,
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
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginTop: 10,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 40,
  },
  actionCount: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: colors.textDim,
  },
  actionCountLiked: {
    color: colors.like,
  },
  actionCountReposted: {
    color: colors.accent,
  },
  actionEnd: {
    marginLeft: "auto",
    minWidth: 0,
  },
});
