import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HapticTab } from '@/components/haptic-tab';
import { colors, fonts } from '../../src/theme/theme';
import { refreshUnread, useUnreadCount } from '../../src/notifications/unread';
import { askForPushOnce, registerPushToken } from '../../src/notifications/push';
import { loadMe } from '../../src/auth/me';
import { refreshDmUnread, useDmUnread } from '../../src/dm/unread';
import { askStayLinked } from '../../src/links/stayPrompt';

export default function TabLayout() {
  const unread = useUnreadCount();
  const dmUnread = useDmUnread();

  // The tabs only mount once signed in and onboarded, so this is where the badge
  // gets synced and this device is registered for push.
  useEffect(() => {
    const refreshAll = () => {
      refreshUnread();
      refreshDmUnread();
    };
    loadMe();
    refreshAll();
    registerPushToken();
    askForPushOnce();
    askStayLinked();
    const interval = setInterval(refreshAll, 60_000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshAll();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.divider,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMedium,
          fontSize: 11,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size || 24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications" size={size || 24} color={color} />,
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            color: colors.accentText,
            fontFamily: fonts.bodyBold,
            fontSize: 11,
          },
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size || 24} color={color} />,
          tabBarBadge: dmUnread > 0 ? (dmUnread > 99 ? '99+' : dmUnread) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.accent,
            color: colors.accentText,
            fontFamily: fonts.bodyBold,
            fontSize: 11,
          },
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size || 24} color={color} />,
        }}
      />
    </Tabs>
  );
}
