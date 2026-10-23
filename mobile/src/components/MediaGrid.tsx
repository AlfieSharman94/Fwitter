import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii } from "../theme/theme";

export type MediaItem = { id: string; url: string; width: number | null; height: number | null };

// One to four images: a single image keeps its own shape (within limits), two sit side
// by side, three or four form a 2x2 grid. Tapping opens a full-screen viewer.
export function MediaGrid({ media }: { media: MediaItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const items = media.slice(0, 4);
  if (!items.length) return null;

  const single = items.length === 1;
  const ratio = single && items[0].width && items[0].height ? clamp(items[0].width / items[0].height, 0.7, 1.6) : 1;

  return (
    <>
      <View style={[styles.grid, single ? { aspectRatio: ratio } : styles.gridMulti]}>
        {items.map((m, i) => (
          <Pressable
            key={m.id}
            onPress={() => setOpen(i)}
            style={[styles.cell, single ? styles.cellSingle : items.length === 2 ? styles.cellHalfTall : styles.cellQuarter]}
          >
            <Image source={{ uri: m.url }} style={styles.image} resizeMode="cover" />
          </Pressable>
        ))}
      </View>

      <Modal visible={open !== null} transparent animationType="fade" onRequestClose={() => setOpen(null)}>
        <Viewer items={items} index={open ?? 0} onClose={() => setOpen(null)} onIndex={setOpen} />
      </Modal>
    </>
  );
}

function Viewer({
  items, index, onClose, onIndex,
}: { items: MediaItem[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const { width } = useWindowDimensions();
  const item = items[index];
  return (
    <View style={styles.viewer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Image source={{ uri: item.url }} style={{ width, height: "80%" }} resizeMode="contain" />
      <Pressable style={styles.close} onPress={onClose} hitSlop={10}>
        <Ionicons name="close" size={26} color={colors.text} />
      </Pressable>
      {items.length > 1 && (
        <View style={styles.pager}>
          <Pressable onPress={() => onIndex((index + items.length - 1) % items.length)} hitSlop={10}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <Text style={styles.pagerText}>
            {index + 1} / {items.length}
          </Text>
          <Pressable onPress={() => onIndex((index + 1) % items.length)} hitSlop={10}>
            <Ionicons name="chevron-forward" size={28} color={colors.text} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

const styles = StyleSheet.create({
  grid: {
    marginTop: 10,
    borderRadius: radii.md,
    overflow: "hidden",
    backgroundColor: colors.surface3,
    width: "100%",
  },
  gridMulti: {
    flexDirection: "row",
    flexWrap: "wrap",
    aspectRatio: 1.6,
    gap: 2,
  },
  cell: {
    overflow: "hidden",
  },
  cellSingle: {
    width: "100%",
    height: "100%",
  },
  cellHalfTall: {
    flexBasis: "49.7%",
    flexGrow: 1,
    height: "100%",
  },
  cellQuarter: {
    flexBasis: "49.7%",
    flexGrow: 1,
    height: "49.5%",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  viewer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
    alignItems: "center",
    justifyContent: "center",
  },
  close: {
    position: "absolute",
    top: 54,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  pager: {
    position: "absolute",
    bottom: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  pagerText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    color: colors.text,
  },
});
