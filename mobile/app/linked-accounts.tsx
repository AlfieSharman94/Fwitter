import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { apiFetch } from "../src/api/client";
import { fetchLinks, friendlyLinkError, shareLabel, type Link } from "../src/links/links";
import { colors, fonts, radii } from "../src/theme/theme";

export default function LinkedAccountsScreen() {
  const router = useRouter();
  const [links, setLinks] = useState<Link[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLinks(await fetchLinks());
    } catch (e: any) {
      setLinks((prev) => prev ?? []);
      Alert.alert("Couldn’t load linked accounts", friendlyLinkError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const run = async (id: string, path: string, init: RequestInit) => {
    setBusy(id);
    try {
      await apiFetch(path, init);
      await load();
    } catch (e: any) {
      Alert.alert("Something went wrong", friendlyLinkError(e));
    } finally {
      setBusy(null);
    }
  };

  const unlink = (l: Link) => {
    const pending = l.status === "PENDING";
    const title = pending ? (l.role === "viewer" ? "Decline this request?" : "Cancel this request?") : `Unlink from @${l.other.username}?`;
    Alert.alert(title, pending ? undefined : "You’ll stop sharing activity between your accounts.", [
      { text: "Keep", style: "cancel" },
      { text: pending ? "Yes" : "Unlink", style: "destructive", onPress: () => run(l.id, `/links/${l.id}`, { method: "DELETE" }) },
    ]);
  };

  const sharing = links?.filter((l) => l.role === "sharer") ?? [];
  const viewing = links?.filter((l) => l.role === "viewer") ?? [];

  const renderLink = (l: Link) => {
    const sharesText = l.shares.map(shareLabel).join(", ");
    const waitingChange = l.requestedShares.length > 0;
    return (
      <View key={l.id} style={styles.card}>
        <View style={styles.personRow}>
          {l.other.avatarUrl ? (
            <Image source={{ uri: l.other.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{l.other.displayName.charAt(0).toUpperCase() || "?"}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{l.other.displayName}</Text>
            <Text style={styles.username}>@{l.other.username}</Text>
          </View>
          {l.status === "PENDING" && <Text style={styles.pill}>Pending</Text>}
        </View>

        <Text style={styles.detail}>
          {l.role === "sharer" ? "You share: " : "They share: "}
          <Text style={styles.detailValue}>{sharesText}</Text>
        </Text>
        {waitingChange && (
          <Text style={styles.notice}>
            {l.role === "sharer"
              ? `Waiting for @${l.other.username} to approve sharing only: ${l.requestedShares.map(shareLabel).join(", ")}`
              : `@${l.other.username} asked to share only: ${l.requestedShares.map(shareLabel).join(", ")}`}
          </Text>
        )}

        {busy === l.id ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} />
        ) : (
          <View style={styles.actions}>
            {l.role === "viewer" && l.status === "PENDING" && (
              <Pressable style={[styles.button, styles.primary]} onPress={() => run(l.id, `/links/${l.id}/accept`, { method: "POST" })}>
                <Text style={styles.primaryText}>Accept</Text>
              </Pressable>
            )}
            {l.role === "viewer" && l.status === "ACTIVE" && (
              <Pressable
                style={[styles.button, styles.primary]}
                onPress={() => router.push({ pathname: "/linked/[id]", params: { id: l.id, username: l.other.username } })}
              >
                <Text style={styles.primaryText}>See activity</Text>
              </Pressable>
            )}
            {l.role === "viewer" && waitingChange && (
              <>
                <Pressable
                  style={[styles.button, styles.secondary]}
                  onPress={() => run(l.id, `/links/${l.id}/change`, { method: "POST", body: JSON.stringify({ yes: true }) })}
                >
                  <Text style={styles.secondaryText}>Approve change</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.secondary]}
                  onPress={() => run(l.id, `/links/${l.id}/change`, { method: "POST", body: JSON.stringify({ yes: false }) })}
                >
                  <Text style={styles.secondaryText}>Keep as is</Text>
                </Pressable>
              </>
            )}
            {l.role === "sharer" && (
              <Pressable
                style={[styles.button, styles.secondary]}
                onPress={() =>
                  router.push({
                    pathname: "/link-request",
                    params: { linkId: l.id, username: l.other.username, shares: l.shares.join(","), active: l.status === "ACTIVE" ? "1" : "" },
                  })
                }
              >
                <Text style={styles.secondaryText}>Change what I share</Text>
              </Pressable>
            )}
            {l.canUnlink && (
              <Pressable style={[styles.button, styles.danger]} onPress={() => unlink(l)}>
                <Text style={styles.dangerText}>
                  {l.status === "PENDING" ? (l.role === "viewer" ? "Decline" : "Cancel request") : "Unlink"}
                </Text>
              </Pressable>
            )}
          </View>
        )}
        {!l.canUnlink && <Text style={styles.hint}>Until you’re 16, only @{l.other.username} can unlink.</Text>}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Linked accounts</Text>
        <View style={{ width: 40 }} />
      </View>

      {links === null ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.intro}>
            Linking lets a parent, guardian or other adult you trust see the activity you choose. To link, open their profile, tap
            the menu and choose “Link my account”.
          </Text>

          <Text style={styles.sectionLabel}>You share with</Text>
          {sharing.length ? sharing.map(renderLink) : <Text style={styles.empty}>No one yet.</Text>}

          <Text style={styles.sectionLabel}>Shared with you</Text>
          {viewing.length ? viewing.map(renderLink) : <Text style={styles.empty}>No one yet.</Text>}
        </ScrollView>
      )}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  intro: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  sectionLabel: { fontFamily: fonts.heading, fontSize: 14, color: colors.textDim, textTransform: "uppercase", marginTop: 12 },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.textFaint },
  card: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.lg,
    padding: 14,
    gap: 8,
  },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.heading, fontSize: 16, color: colors.accentText },
  name: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.text },
  username: { fontFamily: fonts.body, fontSize: 13, color: colors.textDim },
  pill: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    color: colors.warn,
    borderWidth: 1,
    borderColor: colors.warn,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  detail: { fontFamily: fonts.body, fontSize: 14, color: colors.textMuted },
  detailValue: { fontFamily: fonts.bodyMedium, color: colors.text },
  notice: { fontFamily: fonts.body, fontSize: 13, color: colors.warn },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  button: { paddingHorizontal: 14, height: 38, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: colors.accent },
  primaryText: { fontFamily: fonts.heading, fontSize: 14, color: colors.accentText },
  secondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface3 },
  secondaryText: { fontFamily: fonts.heading, fontSize: 14, color: colors.text },
  danger: { borderWidth: 1, borderColor: colors.danger },
  dangerText: { fontFamily: fonts.heading, fontSize: 14, color: colors.danger },
});
