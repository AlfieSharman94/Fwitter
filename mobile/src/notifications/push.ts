// Expo push: registering this device's token with the API, and opening the
// right screen when a notification is tapped.
import { useEffect } from "react";
import { Alert, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { useRouter, type Href } from "expo-router";
import { apiFetch } from "../api/client";
import { refreshUnread } from "./unread";
import { refreshDmUnread } from "../dm/unread";

let registeredToken: string | null = null;

// Notifications arriving while the app is open show as a banner. The badge
// is driven by the unread store, not the OS badge.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Safe to call often: does nothing without permission, and only talks to the
// API when the token changed. Simulators and builds without push credentials
// can't get a token, which is fine.
export async function registerPushToken() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token || token === registeredToken) return;

    await apiFetch("/notifications/push-token", {
      method: "POST",
      body: JSON.stringify({ token, platform: Platform.OS }),
    });
    registeredToken = token;
  } catch {
    // No token available on this device/build; nothing to register.
  }
}

const PROMPT_SHOWN_KEY = "fwitter.pushPromptShown";

// iOS only shows its permission prompt once, so ask in our own words first and
// only trigger the system prompt on Yes. Shown once per install; "Not now"
// leaves it to Settings > Notifications.
export async function askForPushOnce() {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "undetermined") return;
    if (await SecureStore.getItemAsync(PROMPT_SHOWN_KEY)) return;
    await SecureStore.setItemAsync(PROMPT_SHOWN_KEY, "1");
    Alert.alert("Turn on notifications?", "Find out when someone replies to you, follows you or sends you a message.", [
      { text: "Not now", style: "cancel" },
      {
        text: "Turn on",
        onPress: async () => {
          const res = await Notifications.requestPermissionsAsync();
          if (res.status === "granted") registerPushToken();
        },
      },
    ]);
  } catch {
    // No permission API on this build; nothing to ask.
  }
}

// Called before signing out, while the session can still authenticate the call.
export async function unregisterPushToken() {
  const token = registeredToken;
  if (!token) return;
  registeredToken = null;
  try {
    await apiFetch("/notifications/push-token", { method: "DELETE", body: JSON.stringify({ token }) });
  } catch {
    // Token stays registered server-side; the next sign-in on this device re-points it.
  }
}

// Opens the screen a tapped notification points at (cold start included), and
// refreshes the unread badge when one arrives while the app is open.
export function usePushNavigation() {
  const router = useRouter();

  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === "string" && url.startsWith("/")) router.push(url as Href);
    };

    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const tapSub = Notifications.addNotificationResponseReceivedListener(open);
    const receivedSub = Notifications.addNotificationReceivedListener(() => {
      refreshUnread();
      refreshDmUnread();
    });
    return () => {
      tapSub.remove();
      receivedSub.remove();
    };
  }, [router]);
}
