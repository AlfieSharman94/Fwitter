import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../../src/api/client";
import { useMe } from "../../src/auth/me";
import { ReportSheet, type ReportTarget } from "../../src/components/ReportSheet";
import { publishAuthorBlocked } from "../../src/feed/optimisticFeed";
import { dmReasonText, friendlyDmError, refreshDmUnread, type Conversation, type Message } from "../../src/dm/unread";
import { colors, fonts, radii } from "../../src/theme/theme";

const POLL_MS = 4_000;
const MAX_LENGTH = 1000;

export default function ConversationScreen() {
  const router = useRouter();
  const me = useMe();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  // Newest first; the list is inverted so the newest sits at the bottom.
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(
    async (cursor: string | null = null, silent = false) => {
      if (!id) return;
      if (cursor) setLoadingMore(true);
      else if (!silent) setLoading(true);
      try {
        const base = `/dm/conversations/${id}/messages?limit=30`;
        const data = await apiFetch(cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base);
        const page: Message[] = data.messages ?? [];
        setConversation(data.conversation);
        setMessages((prev) => {
          if (cursor) return [...prev, ...page];
          if (!silent) return page;
          const known = new Set(prev.map((m) => m.id));
          const fresh = page.filter((m) => !known.has(m.id));
          return fresh.length ? [...fresh, ...prev] : prev;
        });
        if (!silent) setNextCursor(data.nextCursor ?? null);
        setError(null);
        if (!cursor) refreshDmUnread();
      } catch (e: any) {
        if (!cursor && !silent) setError(e?.message ?? "Failed to load conversation");
      } finally {
        if (cursor) setLoadingMore(false);
        else if (!silent) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    load();
    const interval = setInterval(() => load(null, true), POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const send = async () => {
    const content = draft.trim();
    if (!content || sending || !id) return;
    setSending(true);
    try {
      const data = await apiFetch(`/dm/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setMessages((prev) => [data.message, ...prev]);
      setDraft("");
    } catch (e: any) {
      Alert.alert("Couldn’t send", friendlyDmError(e, "Failed to send message"));
    } finally {
      setSending(false);
    }
  };

  const other = conversation?.other;

  const menu = () => {
    if (!other) return;
    Alert.alert(`@${other.username}`, undefined, [
      { text: "Report conversation", onPress: () => setReportTarget({ conversationId: id, label: "conversation" }) },
      {
        text: `Block @${other.username}`,
        style: "destructive",
        onPress: () =>
          Alert.alert(`Block @${other.username}?`, "You won’t see each other’s posts or be able to message.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Block",
              style: "destructive",
              onPress: async () => {
                try {
                  await apiFetch(`/users/${other.id}/block`, { method: "POST" });
                  publishAuthorBlocked(other.id);
                  router.back();
                } catch (e: any) {
                  Alert.alert("Error", e?.message ?? "Failed to block");
                }
              },
            },
          ]),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const header = (
    <View style={styles.header}>
      <Pressable style={styles.iconButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      <Pressable style={styles.headerCentre} onPress={() => other && router.push(`/users/${other.id}`)} disabled={!other}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {other?.display_name ?? "Conversation"}
        </Text>
        {other?.verified_at && <Ionicons name="checkmark-circle" size={14} color={colors.accent2} />}
      </Pressable>
      <Pressable style={styles.iconButton} onPress={menu} disabled={!other}>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
      </Pressable>
    </View>
  );

  if (loading && !conversation) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {header}
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        {header}
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error ?? "Conversation not found"}</Text>
          <Pressable onPress={() => load()} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const canSend = draft.trim().length > 0 && draft.length <= MAX_LENGTH && !sending;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {header}
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => {
            const mine = !!me && item.sender_id === me.id;
            return (
              <View style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.content}</Text>
                  <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.listContent}
          onEndReached={nextCursor && !loadingMore ? () => load(nextCursor) : undefined}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} size="small" color={colors.accent} /> : null}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>Say hello to {other?.display_name ?? "them"}.</Text>
            </View>
          }
          keyboardShouldPersistTaps="handled"
        />

        {conversation.can_message ? (
          <View style={styles.composer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Message"
              placeholderTextColor={colors.placeholder}
              value={draft}
              onChangeText={setDraft}
              autoCorrect
              spellCheck
              keyboardType="default"
              multiline
              maxLength={MAX_LENGTH}
            />
            <Pressable style={[styles.sendButton, !canSend && styles.sendButtonDisabled]} onPress={send} disabled={!canSend}>
              {sending ? (
                <ActivityIndicator size="small" color={colors.accentText} />
              ) : (
                <Ionicons name="arrow-up" size={20} color={canSend ? colors.accentText : colors.textFaint} />
              )}
            </Pressable>
          </View>
        ) : (
          <View style={styles.locked}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.textDim} />
            <Text style={styles.lockedText}>{dmReasonText(conversation.reason)}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  iconButton: { width: 40, height: 40, borderRadius: radii.md, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  headerCentre: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  headerTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.text, textTransform: "uppercase", flexShrink: 1 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  errorText: { color: colors.danger, fontSize: 16, textAlign: "center", marginBottom: 16, fontFamily: fonts.body },
  retryButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: colors.accent, borderRadius: radii.sm },
  retryText: { color: colors.accentText, fontFamily: fonts.bodyBold },
  listContent: { paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  bubbleRow: { flexDirection: "row", justifyContent: "flex-start" },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubble: { maxWidth: "80%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16, gap: 3 },
  bubbleTheirs: { backgroundColor: colors.surface2, borderBottomLeftRadius: 5 },
  bubbleMine: { backgroundColor: colors.accent, borderBottomRightRadius: 5 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.textBody },
  bubbleTextMine: { color: colors.accentText },
  bubbleTime: { fontFamily: fonts.body, fontSize: 11, color: colors.textDim, alignSelf: "flex-end" },
  bubbleTimeMine: { color: "rgba(6,33,15,0.65)" },
  emptyWrap: { transform: [{ scaleY: -1 }], paddingVertical: 32, alignItems: "center" },
  empty: { fontFamily: fonts.body, fontSize: 15, color: colors.textDim },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.bg },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 11, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, fontFamily: fonts.body, fontSize: 15 },
  sendButton: { width: 44, height: 44, borderRadius: radii.lg, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { backgroundColor: colors.surface2 },
  locked: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: colors.divider },
  lockedText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.textDim, lineHeight: 18 },
});
