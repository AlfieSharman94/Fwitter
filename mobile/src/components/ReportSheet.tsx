import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "../api/client";
import { colors, fonts, radii } from "../theme/theme";

export type ReportTarget = { postId?: string; userId?: string; label: string };

const REASONS = [
  { key: "SPAM", label: "Spam" },
  { key: "HARASSMENT", label: "Bullying or harassment" },
  { key: "HATE", label: "Hate or abuse" },
  { key: "SEXUAL", label: "Sexual content" },
  { key: "VIOLENCE", label: "Violence or threats" },
  { key: "SELF_HARM", label: "Self-harm" },
  { key: "UNDERAGE", label: "Someone under 13" },
  { key: "OTHER", label: "Something else" },
] as const;

// Bottom sheet of report reasons. One tap sends the report; the server ignores a
// second report of the same thing from the same person.
export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const [sending, setSending] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setDone(false);
    setError(null);
    setSending(null);
    onClose();
  };

  const send = async (reason: string) => {
    if (!target || sending) return;
    setSending(reason);
    setError(null);
    try {
      await apiFetch("/reports", {
        method: "POST",
        body: JSON.stringify({ postId: target.postId, userId: target.userId, reason }),
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? "Couldn’t send the report. Try again.");
    } finally {
      setSending(null);
    }
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {done ? (
          <>
            <Text style={styles.title}>Thanks for letting us know</Text>
            <Text style={styles.body}>We’ll take a look. You can also block people to stop seeing them altogether.</Text>
            <Pressable style={styles.doneButton} onPress={close}>
              <Text style={styles.doneButtonText}>Done</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Report {target?.label}</Text>
            <Text style={styles.body}>What’s wrong with it?</Text>
            {REASONS.map((r) => (
              <Pressable key={r.key} style={styles.reason} onPress={() => send(r.key)} disabled={!!sending}>
                <Text style={styles.reasonText}>{r.label}</Text>
                {sending === r.key && <ActivityIndicator size="small" color={colors.accent} />}
              </Pressable>
            ))}
            {error && <Text style={styles.error}>{error}</Text>}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    textTransform: "uppercase",
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 10,
    lineHeight: 20,
  },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  reasonText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    color: colors.textBody,
  },
  error: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.danger,
    marginTop: 10,
  },
  doneButton: {
    marginTop: 12,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonText: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: colors.accentText,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
