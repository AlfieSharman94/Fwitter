import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { useRouter } from "expo-router";
import { colors, fonts } from "../theme/theme";

type Mention = { id: string; username: string };

type Props = {
  content: string;
  mentions: Mention[];
  hashtags: string[];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

type Part =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; userId: string }
  | { kind: "hashtag"; text: string; tag: string };

// Post body with @mentions and #hashtags as links. Only entities the server
// resolved become links; an unknown @name or #tag stays plain text.
export function PostText({ content, mentions, hashtags, style, numberOfLines }: Props) {
  const router = useRouter();
  const parts = tokenize(content, mentions, hashtags);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => {
        if (part.kind === "text") return <Text key={i}>{part.text}</Text>;
        const open =
          part.kind === "mention"
            ? () => router.push(`/users/${part.userId}`)
            : () => router.push(`/hashtags/${part.tag}`);
        return (
          <Text key={i} style={styles.link} onPress={open}>
            {part.text}
          </Text>
        );
      })}
    </Text>
  );
}

const TOKEN = /[@#][A-Za-z0-9_]+/g;

function tokenize(content: string, mentions: Mention[], hashtags: string[]): Part[] {
  const parts: Part[] = [];
  let last = 0;
  const re = new RegExp(TOKEN.source, "g");
  let m: RegExpExecArray | null;

  while ((m = re.exec(content))) {
    const start = m.index;
    const before = start === 0 ? "" : content[start - 1];
    // Same word-start rule as the server: "joe@example.com" and "a#b" are not entities.
    if (before && /[A-Za-z0-9_@#]/.test(before)) continue;

    const body = m[0].slice(1);
    let linked: Part | null = null;
    if (m[0][0] === "@") {
      const user = mentions.find((u) => u.username.toLowerCase() === body.toLowerCase());
      if (user) linked = { kind: "mention", text: m[0], userId: user.id };
    } else {
      const tag = body.toLowerCase();
      if (hashtags.includes(tag)) linked = { kind: "hashtag", text: m[0], tag };
    }
    if (!linked) continue;

    if (start > last) parts.push({ kind: "text", text: content.slice(last, start) });
    parts.push(linked);
    last = start + m[0].length;
  }

  if (last < content.length) parts.push({ kind: "text", text: content.slice(last) });
  return parts;
}

const styles = StyleSheet.create({
  link: {
    color: colors.accent2,
    fontFamily: fonts.bodyMedium,
  },
});
