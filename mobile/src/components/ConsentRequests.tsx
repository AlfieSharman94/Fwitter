import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { apiFetch } from "../api/client";
import { colors, fonts, radii } from "../theme/theme";

type ConsentRequest = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  dateOfBirth: string; // YYYY-MM-DD
};

function formatDob(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Shown at the top of Activity to an adult account whose email a 13 to 15 year old gave as
// their parent or guardian's. The same decision as the emailed link, from inside the app.
export function ConsentRequests() {
  const [requests, setRequests] = useState<ConsentRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  // "Link @child to my account", ticked by default; ids in here are unticked.
  const [noLink, setNoLink] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await apiFetch("/users/me/consent-requests");
      setRequests(data.requests ?? []);
    } catch {
      // Leave what we had; the next visit retries.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const act = async (r: ConsentRequest, action: "approve" | "decline") => {
    setBusy(r.userId);
    try {
      await apiFetch(`/users/me/consent-requests/${r.userId}/${action}`, {
        method: "POST",
        ...(action === "approve" ? { body: JSON.stringify({ link: !noLink.has(r.userId) }) } : {}),
      });
      setRequests((prev) => prev.filter((x) => x.userId !== r.userId));
      Alert.alert(
        action === "approve" ? "Approved" : "Account deleted",
        action === "approve"
          ? `@${r.username} can now use Fwitter.${noLink.has(r.userId) ? "" : " You can see their activity from the top of Activity."}`
          : `@${r.username}'s account and everything they posted have been removed.`
      );
    } catch (e: any) {
      Alert.alert("Something went wrong", e?.message ?? "Nothing was changed. Please try again.");
      load();
    } finally {
      setBusy(null);
    }
  };

  const decline = (r: ConsentRequest) =>
    Alert.alert(
      "Delete this account?",
      `This permanently deletes @${r.username}'s account and everything they have posted.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: () => act(r, "decline") },
      ]
    );

  if (!requests.length) return null;

  return (
    <View style={styles.wrap}>
      {requests.map((r) => (
        <View key={r.userId} style={styles.card}>
          <Text style={styles.title}>@{r.username} wants to join Fwitter</Text>
          <Text style={styles.body}>
            They gave your email as their parent or guardian's. Please check their details are right.
          </Text>
          <View style={styles.details}>
            <Text style={styles.detail}>
              Name: <Text style={styles.detailValue}>{r.displayName}</Text>
            </Text>
            <Text style={styles.detail}>
              Date of birth: <Text style={styles.detailValue}>{formatDob(r.dateOfBirth)}</Text>
            </Text>
          </View>
          <View style={styles.linkRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkLabel}>Link @{r.username} to my account</Text>
              <Text style={styles.linkHint}>See their posts, replies, reposts, quotes and new follows. They can see you’re linked.</Text>
            </View>
            <Switch
              value={!noLink.has(r.userId)}
              onValueChange={(on) =>
                setNoLink((prev) => {
                  const next = new Set(prev);
                  if (on) next.delete(r.userId);
                  else next.add(r.userId);
                  return next;
                })
              }
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>
          {busy === r.userId ? (
            <ActivityIndicator color={colors.accent} style={styles.spinner} />
          ) : (
            <View style={styles.actions}>
              <Pressable style={[styles.button, styles.approve]} onPress={() => act(r, "approve")} disabled={!!busy}>
                <Text style={styles.approveText}>Approve</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.decline]} onPress={() => decline(r)} disabled={!!busy}>
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  card: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    padding: 16,
    gap: 10,
  },
  title: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  details: { gap: 4 },
  detail: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  detailValue: { fontFamily: fonts.bodyBold, color: colors.text },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  linkLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  linkHint: { fontFamily: fonts.body, fontSize: 12, color: colors.textDim, marginTop: 2 },
  button: { flex: 1, height: 44, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  approve: { backgroundColor: colors.accent },
  approveText: { fontFamily: fonts.heading, fontSize: 15, color: colors.accentText },
  decline: { borderWidth: 2, borderColor: colors.danger },
  declineText: { fontFamily: fonts.heading, fontSize: 15, color: colors.danger },
  spinner: { marginVertical: 12 },
});
