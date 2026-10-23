import { Pressable, StyleSheet, Text, View } from "react-native";
import type { FeedPostBase } from "../feed/feedTypes";
import { votePoll, type PatchPost } from "../feed/engagement";
import { colors, fonts, radii } from "../theme/theme";

// Options as buttons until you vote (or the poll ends); result bars after.
// `votes` being null is the server telling us results are still hidden.
export function PollView({ post, onPatch }: { post: FeedPostBase; onPatch: PatchPost }) {
  const poll = post.poll;
  if (!poll) return null;

  const ended = new Date(poll.ends_at).getTime() <= Date.now();
  const revealed = poll.total_votes !== null;
  const total = poll.total_votes ?? 0;
  const locked = ended || poll.my_option_id !== null;

  return (
    <View style={styles.poll}>
      {poll.options.map((option) => {
        const mine = option.id === poll.my_option_id;

        if (revealed) {
          const pct = total > 0 ? Math.round(((option.votes ?? 0) / total) * 100) : 0;
          return (
            <View key={option.id} style={styles.result}>
              <View style={[styles.resultFill, mine && styles.resultFillMine, { width: `${pct}%` }]} />
              <View style={styles.resultRow}>
                <Text style={[styles.resultText, mine && styles.resultTextMine]} numberOfLines={1}>
                  {option.text}
                  {mine ? "  ✓" : ""}
                </Text>
                <Text style={styles.resultPct}>{pct}%</Text>
              </View>
            </View>
          );
        }

        return (
          <Pressable
            key={option.id}
            style={[styles.option, mine && styles.optionMine]}
            onPress={() => votePoll(post, option.id, onPatch)}
            disabled={locked}
          >
            <Text style={[styles.optionText, mine && styles.optionTextMine]} numberOfLines={1}>
              {option.text}
            </Text>
          </Pressable>
        );
      })}
      <Text style={styles.footer}>
        {revealed ? `${total} ${total === 1 ? "vote" : "votes"} · ` : ""}
        {ended ? "Final results" : `${timeLeft(poll.ends_at)} left`}
      </Text>
    </View>
  );
}

function timeLeft(endsAt: string) {
  const ms = new Date(endsAt).getTime() - Date.now();
  const mins = Math.max(1, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

const styles = StyleSheet.create({
  poll: {
    marginTop: 10,
    gap: 6,
  },
  option: {
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  optionMine: {
    backgroundColor: colors.accent,
  },
  optionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.accent,
  },
  optionTextMine: {
    color: colors.accentText,
  },
  result: {
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface3,
    overflow: "hidden",
    justifyContent: "center",
  },
  resultFill: {
    ...StyleSheet.absoluteFillObject,
    right: undefined,
    backgroundColor: colors.border,
    borderRadius: radii.md,
  },
  resultFillMine: {
    backgroundColor: "rgba(0, 200, 83, 0.35)",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    gap: 10,
  },
  resultText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textBody,
  },
  resultTextMine: {
    fontFamily: fonts.bodyBold,
    color: colors.text,
  },
  resultPct: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.text,
  },
  footer: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textDim,
    marginTop: 2,
  },
});
