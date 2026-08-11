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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../src/api/client";
import { searchTeams, searchTopics, Team, Topic } from "../src/api/catalog";
import { publishNewPost } from "../src/feed/optimisticFeed";
import type { FeedPost } from "../src/feed/feedTypes";
import { colors, fonts, radii } from "../src/theme/theme";

const MAX_LENGTH = 500;
const MAX_TEAMS = 10;
const MAX_TOPICS = 20;

type SelfProfile = { id: string; username: string; display_name: string };

export default function ComposeScreen() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<SelfProfile | null>(null);

  const [teamQuery, setTeamQuery] = useState("");
  const [topicQuery, setTopicQuery] = useState("");
  const [teamResults, setTeamResults] = useState<Team[]>([]);
  const [topicResults, setTopicResults] = useState<Topic[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Topic[]>([]);

  // Load full catalog + the current user's profile (needed to build the optimistic post).
  useEffect(() => {
    (async () => {
      try {
        const [teams, topics, profile] = await Promise.all([
          searchTeams(""),
          searchTopics(""),
          apiFetch("/users/me/profile"),
        ]);
        setTeamResults(teams);
        setTopicResults(topics);
        if (profile?.user) {
          setMe({
            id: profile.user.id,
            username: profile.user.username,
            display_name: profile.user.display_name,
          });
        }
      } catch {
        // Non-fatal: pickers just start empty; the search boxes still work.
      }
    })();
  }, []);

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
  const canSubmit = content.trim().length > 0 && !overLimit && hasTag && !busy;
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

    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch("/posts", {
        method: "POST",
        body: JSON.stringify({
          content: trimmed,
          teamIds: selectedTeams.map((t) => t.id),
          topicIds: selectedTopics.map((t) => t.id),
        }),
      });

      // The create response is only { id, created_at }; build the full FeedPost
      // client-side from what we already have, then hand it to the feed.
      if (me && res?.post) {
        const optimistic: FeedPost = {
          id: res.post.id,
          content: trimmed,
          created_at: res.post.created_at,
          author_id: me.id,
          users: {
            username: me.username,
            display_name: me.display_name,
            profile_image_url: null,
          },
          post_teams: selectedTeams.map((t) => ({ teams: { id: t.id, name: t.name } })),
          post_topics: selectedTopics.map((t) => ({ topics: { id: t.id, name: t.name } })),
        };
        publishNewPost(optimistic);
      }

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
          <Text style={styles.headerTitle}>New Post</Text>
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
