import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { FeedPost, FeedPostBase, FeedPostQuoting } from "../feed/feedTypes";
import { toggleBookmark, toggleLike, toggleRepost, type PatchPost } from "../feed/engagement";
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

  return (
    <Pressable style={styles.postCard} onPress={pressable ? openPost : undefined}>
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
              <Ionicons name="checkmark-circle" size={14} color={colors.accent2} />
              <Text style={styles.postUsername}>@{shown.users.username}</Text>
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

          <Text style={styles.postContent}>{shown.content}</Text>

          {shown.quoted_post && <QuotedPost post={shown.quoted_post} />}

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
        <Text style={styles.quoteMeta} numberOfLines={1}>
          @{post.users.username} · {getTimeAgo(new Date(post.created_at))}
        </Text>
      </View>
      <Text style={styles.quoteContent} numberOfLines={6}>
        {post.content}
      </Text>
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
