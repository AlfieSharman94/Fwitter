import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { fetchLinks, type Link } from "../links/links";
import { colors, fonts } from "../theme/theme";

// Top of Activity for an adult with linked accounts: one row per person sharing with them,
// plus a nudge when a request or change is waiting.
export function LinkedShortcuts() {
  const router = useRouter();
  const [links, setLinks] = useState<Link[]>([]);

  useFocusEffect(
    useCallback(() => {
      fetchLinks()
        .then((all) => setLinks(all.filter((l) => l.role === "viewer")))
        .catch(() => {});
    }, [])
  );

  if (!links.length) return null;
  const waiting = links.filter((l) => l.status === "PENDING" || l.requestedShares.length > 0).length;

  return (
    <View style={styles.wrap}>
      {waiting > 0 && (
        <Pressable style={styles.row} onPress={() => router.push("/linked-accounts")}>
          <Ionicons name="link" size={18} color={colors.warn} />
          <Text style={[styles.text, { color: colors.warn }]}>
            {waiting === 1 ? "1 linked account needs your answer" : `${waiting} linked accounts need your answer`}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </Pressable>
      )}
      {links
        .filter((l) => l.status === "ACTIVE")
        .map((l) => (
          <Pressable
            key={l.id}
            style={styles.row}
            onPress={() => router.push({ pathname: "/linked/[id]", params: { id: l.id, username: l.other.username } })}
          >
            <Ionicons name="link" size={18} color={colors.accent2} />
            <Text style={styles.text}>See @{l.other.username}’s activity</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingVertical: 14 },
  text: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.text },
});
