import { Alert } from "react-native";
import { apiFetch } from "../api/client";
import { fetchLinks, type Link } from "./links";

// At 16, someone who linked as a child decides whether to stay linked. Asked once per link;
// the answer is stored server-side, so it isn't repeated on other devices.
export async function askStayLinked() {
  let links: Link[];
  try {
    links = (await fetchLinks()).filter((l) => l.needsStayAnswer);
  } catch {
    return;
  }
  const ask = (i: number) => {
    const l = links[i];
    if (!l) return;
    const answer = (yes: boolean) =>
      apiFetch(`/links/${l.id}/stay`, { method: "POST", body: JSON.stringify({ yes }) })
        .catch(() => {})
        .finally(() => ask(i + 1));
    Alert.alert(
      `Stay linked to @${l.other.username}?`,
      "You’re 16 now, so it’s your choice. You can also unlink later from Settings, Linked accounts.",
      [
        { text: "Unlink", style: "destructive", onPress: () => answer(false) },
        { text: "Stay linked", onPress: () => answer(true) },
      ]
    );
  };
  ask(0);
}
