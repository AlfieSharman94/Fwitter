import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { FeedPost } from "../feed/feedTypes";
import { colors, fonts } from "../theme/theme";

type Props = {
  post: FeedPost;
  // Tapping the card opens the post. Off for the main post on its own screen.
  pressable?: boolean;
  // Overrides what the reply action does (default: open the post).
  onReplyPress?: () => void;
  // When set, a trash icon replaces the overflow dots (used on your own profile).
  onDelete?: () => void;
};

export function PostCard({ post, pressable = true, onReplyPress, onDelete }: Props) {
  const router = useRouter();
  const teams = post.post_teams.map((x) => x.teams.name);
  const topics = post.post_topics.map((x) => x.topics.name);
  const timeAgo = getTimeAgo(new Date(post.created_at));

  const openPost = () => router.push(`/posts/${post.id}`);
  const openAuthor = () => router.push(`/users/${post.author_id}`);
  const replyAction = onReplyPress ?? (pressable ? openPost : undefined);

  return (
    <Pressable style={styles.postCard} onPress={pressable ? openPost : undefined}>
      <View style={styles.postContentWrapper}>
        <Pressable onPress={openAuthor} style={styles.avatarContainer}>
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
            <Pressable onPress={openAuthor} style={styles.postHeaderLeft}>
              <Text style={styles.postAuthor}>{post.users.display_name}</Text>
              <Ionicons name="checkmark-circle" size={14} color={colors.accent2} />
              <Text style={styles.postUsername}>@{post.users.username}</Text>
              <Text style={styles.postTime}>· {timeAgo}</Text>
            </Pressable>
            {onDelete ? (
              <Pressable onPress={onDelete} hitSlop={10}>
                <Ionicons name="trash-outline" size={18} color={colors.textDim} />
              </Pressable>
            ) : (
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textDim} />
            )}
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

          <View style={styles.actions}>
            <Pressable style={styles.action} onPress={replyAction} hitSlop={8}>
              <Ionicons name="chatbubble-outline" size={17} color={colors.textDim} />
              {post.reply_count > 0 && <Text style={styles.actionCount}>{post.reply_count}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Pressable>
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
});
