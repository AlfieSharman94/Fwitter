import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../src/api/client";
import { searchTeams, searchTopics, Team, Topic } from "../src/api/catalog";
import { publishNewPost } from "../src/feed/optimisticFeed";
import type { FeedPostBase } from "../src/feed/feedTypes";
import { QuotedPost } from "../src/components/PostCard";
import { colors, fonts, radii } from "../src/theme/theme";

const MAX_LENGTH = 500;
const MAX_TEAMS = 10;
const MAX_TOPICS = 20;

export default function ComposeScreen() {
  const router = useRouter();
  // Present when opened via "Quote" on a post: the id of the post to quote.
  const { quote } = useLocalSearchParams<{ quote?: string }>();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoted, setQuoted] = useState<FeedPostBase | null>(null);

  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollDuration, setPollDuration] = useState<24 | 72 | 168>(24);

  const [teamQuery, setTeamQuery] = useState("");
  const [topicQuery, setTopicQuery] = useState("");
  const [teamResults, setTeamResults] = useState<Team[]>([]);
  const [topicResults, setTopicResults] = useState<Topic[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);

  // Load the full catalog for the pickers.
  useEffect(() => {
    (async () => {
      try {
        const [teams, topics] = await Promise.all([searchTeams(""), searchTopics("")]);
        setTeamResults(teams);
        setTopicResults(topics);
      } catch {
        // Non-fatal: pickers just start empty; the search boxes still work.
      }
    })();
  }, []);

  // Quote mode: load the post being quoted and start with its tags selected, so the
  // "at least one team or topic" rule is already met and the quote stays on topic.
  useEffect(() => {
    if (!quote) return;
    (async () => {
      try {
        const data = await apiFetch(`/posts/${quote}`);
        const target: FeedPostBase = data.post.repost_of ?? data.post;
        setQuoted(target);
        setSelectedTeams(target.post_teams.map((x) => ({ id: x.teams.id, name: x.teams.name, logo_url: null })));
        setSelectedTopics(
          target.post_topics.map((x) => ({ id: x.topics.id, name: x.topics.name, description: null, icon: null }))
        );
      } catch (e: any) {
        setError(e?.message ?? "Couldn’t load the post to quote");
      }
    })();
  }, [quote]);

  const onTeamQuery = useCallback(async (q: string) => {
    setTeamQuery(q);
    try {
      setTeamResults(await searchTeams(q));
    } catch {
      /* keep previous results on transient error */
    }
  }, []);

  const onTopicQuery = useCallback(async (q: string) => {
    setTopicQuery(q);
    try {
      setTopicResults(await searchTopics(q));
    } catch {
      /* keep previous results on transient error */
    }
  }, []);

  const toggleTeam = (team: Team) => {
    setError(null);
    setSelectedTeams((prev) => {
      if (prev.some((t) => t.id === team.id)) return prev.filter((t) => t.id !== team.id);
      if (prev.length >= MAX_TEAMS) return prev;
      return [...prev, team];
    });
  };

  const toggleTopic = (topic: Topic) => {
    setError(null);
    setSelectedTopics((prev) => {
      if (prev.some((t) => t.id === topic.id)) return prev.filter((t) => t.id !== topic.id);
      if (prev.length >= MAX_TOPICS) return prev;
      return [...prev, topic];
    });
  };

  const remaining = MAX_LENGTH - content.length;
  const hasTag = selectedTeams.length > 0 || selectedTopics.length > 0;
  const overLimit = content.length > MAX_LENGTH;
  const pollTrimmed = pollOptions.map((o) => o.trim());
  const pollValid =
    !pollEnabled ||
    (pollTrimmed.every((o) => o.length > 0) &&
      new Set(pollTrimmed.map((o) => o.toLowerCase())).size === pollTrimmed.length);
  const canSubmit = content.trim().length > 0 && !overLimit && hasTag && pollValid && !busy;
  // Counter colour: gray default -> amber at <=20 remaining -> red when over limit.
  const counterColor = remaining < 0 ? colors.danger : remaining <= 20 ? colors.warn : colors.textDim;

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed) {
      setError("Post cannot be empty");
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setError(`Post must be ${MAX_LENGTH} characters or less`);
      return;
    }
    if (!hasTag) {
      setError("Add at least one team or topic so your post stays on football.");
      return;
    }
    if (!pollValid) {
      setError("Fill in every poll option, and make them different from each other.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch("/posts", {
        method: "POST",
        body: JSON.stringify({
          content: trimmed,
          teamIds: selectedTeams.map((t) => t.id),
          topicIds: selectedTopics.map((t) => t.id),
          ...(quoted ? { quotedPostId: quoted.id } : {}),
          ...(pollEnabled ? { poll: { options: pollTrimmed, durationHours: pollDuration } } : {}),
        }),
      });

      // The API returns the post in full feed shape, so it can go straight into the feed.
      if (res?.post) publishNewPost(res.post);

      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Failed to create post");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} disabled={busy}>
            <Text style={styles.cancelButton}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{quoted ? "Quote Post" : "New Post"}</Text>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={[styles.postButton, !canSubmit && styles.postButtonDisabled]}
          >
            <Text style={[styles.postButtonText, !canSubmit && styles.postButtonTextDisabled]}>Post</Text>
          </Pressable>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            style={styles.input}
            placeholder="What’s the take?"
            placeholderTextColor={colors.placeholder}
            multiline
            value={content}
            onChangeText={setContent}
            maxLength={MAX_LENGTH}
            autoFocus
            editable={!busy}
          />

          <View style={styles.counterRow}>
            <Text style={[styles.charCount, { color: counterColor }]}>{remaining}</Text>
          </View>

          {quoted && (
            <View style={styles.quoteWrap}>
              <QuotedPost post={quoted} />
            </View>
          )}

          {/* Poll */}
          <View style={styles.pollToggleRow}>
            <Pressable onPress={() => setPollEnabled((v) => !v)} disabled={busy} style={styles.pollToggle} hitSlop={6}>
              <Ionicons name={pollEnabled ? "close-circle-outline" : "stats-chart-outline"} size={18} color={colors.accent2} />
              <Text style={styles.pollToggleText}>{pollEnabled ? "Remove poll" : "Add poll"}</Text>
            </Pressable>
          </View>
          {pollEnabled && (
            <View style={styles.pollSection}>
              {pollOptions.map((option, i) => (
                <View key={i} style={styles.pollOptionRow}>
                  <TextInput
                    style={styles.pollInput}
                    placeholder={`Option ${i + 1}`}
                    placeholderTextColor={colors.placeholder}
                    value={option}
                    onChangeText={(text) => setPollOptions((prev) => prev.map((o, j) => (j === i ? text : o)))}
                    maxLength={50}
                    editable={!busy}
                  />
                  {pollOptions.length > 2 && (
                    <Pressable onPress={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))} hitSlop={8}>
                      <Ionicons name="close" size={18} color={colors.textDim} />
                    </Pressable>
                  )}
                </View>
              ))}
              {pollOptions.length < 4 && (
                <Pressable onPress={() => setPollOptions((prev) => [...prev, ""])} style={styles.pollAdd} hitSlop={6}>
                  <Ionicons name="add" size={16} color={colors.accent} />
                  <Text style={styles.pollAddText}>Add option</Text>
                </Pressable>
              )}
              <Text style={styles.pollDurationLabel}>Poll length</Text>
              <View style={styles.resultsWrap}>
                {([24, 72, 168] as const).map((hours) => (
                  <Pressable
                    key={hours}
                    onPress={() => setPollDuration(hours)}
                    style={[styles.resultChip, pollDuration === hours && styles.resultChipSelected]}
                  >
                    <Text style={[styles.resultChipText, pollDuration === hours && styles.resultChipTextSelected]}>
                      {hours === 24 ? "1 day" : hours === 72 ? "3 days" : "7 days"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Teams */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Teams</Text>
            {selectedTeams.length > 0 && (
              <View style={styles.chipRow}>
                {selectedTeams.map((t) => (
                  <View key={t.id} style={styles.chip}>
                    <Text style={styles.chipText}>{t.name}</Text>
                    <Pressable onPress={() => toggleTeam(t)} hitSlop={8}>
                      <Ionicons name="close" size={16} color={colors.accentText} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <TextInput
              style={styles.searchInput}
              placeholder="Search teams…"
              placeholderTextColor={colors.placeholder}
              value={teamQuery}
              onChangeText={onTeamQuery}
              autoCapitalize="none"
              editable={!busy}
            />
            <View style={styles.resultsWrap}>
              {teamResults.map((t) => {
                const selected = selectedTeams.some((s) => s.id === t.id);
                return (
                  <Pressable
                    key={t.id}
                    style={[styles.resultChip, selected && styles.resultChipSelected]}
                    onPress={() => toggleTeam(t)}
                  >
                    <Text style={[styles.resultChipText, selected && styles.resultChipTextSelected]}>
                      {t.name}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={14} color={colors.accentText} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Topics */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Topics</Text>
            {selectedTopics.length > 0 && (
              <View style={styles.chipRow}>
                {selectedTopics.map((t) => (
                  <View key={t.id} style={styles.chip}>
                    <Text style={styles.chipText}>{t.name}</Text>
                    <Pressable onPress={() => toggleTopic(t)} hitSlop={8}>
                      <Ionicons name="close" size={16} color={colors.accentText} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <TextInput
              style={styles.searchInput}
              placeholder="Search topics…"
              placeholderTextColor={colors.placeholder}
              value={topicQuery}
              onChangeText={onTopicQuery}
              autoCapitalize="none"
              editable={!busy}
            />
            <View style={styles.resultsWrap}>
              {topicResults.map((t) => {
                const selected = selectedTopics.some((s) => s.id === t.id);
                return (
                  <Pressable
                    key={t.id}
                    style={[styles.resultChip, selected && styles.resultChipSelected]}
                    onPress={() => toggleTopic(t)}
                  >
                    <Text style={[styles.resultChipText, selected && styles.resultChipTextSelected]}>
                      {t.name}
                    </Text>
                    {selected && <Ionicons name="checkmark" size={14} color={colors.accentText} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {!hasTag && <Text style={styles.hintText}>Tag at least one team or topic to post.</Text>}
          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        {busy && (
          <View style={styles.busyOverlay}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  cancelButton: { fontSize: 15, color: colors.textMuted, fontFamily: fonts.bodyMedium },
  headerTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.text, textTransform: "uppercase", letterSpacing: 0.5 },
  postButton: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  postButtonDisabled: { backgroundColor: colors.surface },
  postButtonText: { fontFamily: fonts.heading, fontSize: 14, color: colors.accentText, textTransform: "uppercase" },
  postButtonTextDisabled: { color: colors.textFaint },
  content: { flex: 1 },
  input: {
    fontFamily: fonts.body,
    fontSize: 18,
    lineHeight: 24,
    paddingHorizontal: 16,
    paddingTop: 16,
    minHeight: 130,
    color: colors.text,
  },
  counterRow: { paddingHorizontal: 16, paddingBottom: 8, alignItems: "flex-end" },
  quoteWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  pollToggleRow: { paddingHorizontal: 16, paddingBottom: 12 },
  pollToggle: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  pollToggleText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.accent2 },
  pollSection: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  pollOptionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pollInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    fontFamily: fonts.body,
  },
  pollAdd: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingVertical: 2 },
  pollAddText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.accent },
  pollDurationLabel: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  charCount: { fontSize: 14, fontFamily: fonts.bodyMedium },
  section: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  sectionLabel: { fontFamily: fonts.heading, fontSize: 13, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
  },
  chipText: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.accentText },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    fontFamily: fonts.body,
    marginBottom: 10,
  },
  resultsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 4 },
  resultChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface3,
    borderRadius: radii.pill,
  },
  resultChipSelected: { backgroundColor: colors.accent },
  resultChipText: { fontSize: 14, color: colors.textBody, fontFamily: fonts.body },
  resultChipTextSelected: { color: colors.accentText, fontFamily: fonts.bodyBold },
  hintText: { fontSize: 13, color: colors.textDim, paddingHorizontal: 16, paddingTop: 16, fontFamily: fonts.body },
  errorText: { color: colors.danger, fontSize: 14, paddingHorizontal: 16, paddingTop: 12, fontFamily: fonts.body },
  busyOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,13,13,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
});
