import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../src/api/client";
import { friendlyLinkError, SHARE_OPTIONS, type LinkShare } from "../src/links/links";
import { colors, fonts, radii } from "../src/theme/theme";

// Asking to link (userId) or changing what an existing link shares (linkId). The person
// sharing always picks; the other side sees the choices before accepting.
export default function LinkRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; linkId?: string; username?: string; shares?: string; active?: string }>();
  const editing = !!params.linkId;
  const [shares, setShares] = useState<LinkShare[]>(
    params.shares ? (params.shares.split(",") as LinkShare[]) : ["POSTS", "REPLIES", "REPOSTS", "QUOTES", "FOLLOWS"]
  );
  const [busy, setBusy] = useState(false);

  const toggle = (key: LinkShare) =>
    setShares((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));

  const submit = async () => {
    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/links/${params.linkId}/shares`, { method: "PATCH", body: JSON.stringify({ shares }) });
      } else {
        await apiFetch("/links", { method: "POST", body: JSON.stringify({ viewerId: params.userId, shares }) });
        Alert.alert("Request sent", `@${params.username} needs to accept before they see anything.`);
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Couldn’t save", friendlyLinkError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{editing ? "What you share" : "Link my account"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          {editing
            ? `Choose what @${params.username} can see.${params.active ? " If you’re under 16 and turn something off, they need to approve it first." : ""}`
            : `@${params.username} will see the things you turn on here, in their Activity tab. You can change this later in Settings.`}
        </Text>

        <View style={styles.card}>
          {SHARE_OPTIONS.map((o, i) => (
            <View key={o.key} style={[styles.row, i === SHARE_OPTIONS.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{o.label}</Text>
                <Text style={styles.hint}>{o.hint}</Text>
              </View>
              <Switch
                value={shares.includes(o.key)}
                onValueChange={() => toggle(o.key)}
                trackColor={{ true: colors.accent, false: colors.border }}
              />
            </View>
          ))}
        </View>

        <Pressable
          style={[styles.submit, (!shares.length || busy) && styles.disabled]}
          onPress={submit}
          disabled={!shares.length || busy}
        >
          {busy ? <ActivityIndicator color={colors.accentText} /> : <Text style={styles.submitText}>{editing ? "Save" : "Send request"}</Text>}
        </Pressable>
        {!shares.length && <Text style={styles.hint}>Turn on at least one thing to share.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
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
  headerTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, textTransform: "uppercase" },
  content: { padding: 16, gap: 14 },
  intro: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  card: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radii.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.rowDivider,
  },
  label: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 2 },
  submit: { height: 50, borderRadius: radii.md, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.5 },
  submitText: { fontFamily: fonts.heading, fontSize: 16, color: colors.accentText },
});
