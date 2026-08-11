import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Image, Modal, Animated, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../auth/AuthProvider";
import { apiFetch } from "../api/client";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radii } from "../theme/theme";

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = width * 0.85;

type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
};

type SideMenuProps = {
  visible: boolean;
  onClose: () => void;
};

export function SideMenu({ visible, onClose }: SideMenuProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const slideAnim = React.useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      loadProfile();
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      // Get profile (idempotent - returns existing if present, doesn't create if we don't have valid data)
      // For onboarded users, profile should exist
      const profileResponse = await apiFetch("/users/me/profile", {
        method: "POST",
        body: JSON.stringify({
          username: "temp",
          displayName: "temp",
          dateOfBirth: "2000-01-01",
        }),
      });

      const userId = profileResponse.user?.id;
      if (!userId) {
        // Profile doesn't exist yet - user might not be onboarded
        return;
      }

      // Get full profile with counts using GET /users/:id
      const fullProfile = await apiFetch(`/users/${userId}`);
      setProfile({
        id: fullProfile.id,
        username: fullProfile.username,
        displayName: fullProfile.displayName,
        avatarUrl: fullProfile.avatarUrl,
        followersCount: fullProfile.followersCount,
        followingCount: fullProfile.followingCount,
      });
    } catch (e: any) {
      // Profile might not exist - that's okay, show empty state
      console.error("Failed to load profile:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleProfile = () => {
    onClose();
    if (profile?.id) {
      router.push(`/users/${profile.id}`);
    }
  };

  const handleSettings = () => {
    onClose();
    router.push("/settings");
  };

  const handleClubLounge = () => {
    // No-op for now
    onClose();
  };

  const handleLogOut = async () => {
    onClose();
    await signOut();
    router.replace("/(auth)/welcome");
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={styles.backdropPressable} onPress={onClose} />
        </Animated.View>

        <Animated.View style={[styles.drawer, { transform: [{ translateX: slideAnim }] }]}>
          {/* User Profile Header */}
          <View style={styles.profileHeader}>
            {profile?.avatarUrl ? (
              <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {profile?.displayName?.charAt(0)?.toUpperCase() || "?"}
                </Text>
              </View>
            )}
            <View style={styles.profileInfo}>
              <View style={styles.profileNameRow}>
                <Text style={styles.profileName}>{profile?.displayName || "Loading…"}</Text>
                <Ionicons name="checkmark-circle" size={16} color={colors.accent2} />
              </View>
              <Text style={styles.profileUsername}>@{profile?.username || "…"}</Text>
            </View>
          </View>

          {/* Stats Section */}
          <View style={styles.statsSection}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.followingCount ?? 0}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile?.followersCount ?? 0}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
          </View>

          {/* Navigation Links */}
          <View style={styles.navSection}>
            <Pressable style={styles.navItem} onPress={handleProfile}>
              <View style={styles.navItemContent}>
                <View style={styles.navIcon}>
                  <Ionicons name="person" size={20} color={colors.text} />
                </View>
                <Text style={styles.navText}>Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Pressable>

            <Pressable style={styles.navItem} onPress={handleClubLounge}>
              <View style={styles.navItemContent}>
                <View style={styles.navIcon}>
                  <Ionicons name="football" size={20} color={colors.text} />
                </View>
                <Text style={styles.navText}>Club Lounge</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Pressable>

            <Pressable style={styles.navItem} onPress={handleSettings}>
              <View style={styles.navItemContent}>
                <View style={styles.navIcon}>
                  <Ionicons name="settings" size={20} color={colors.text} />
                </View>
                <Text style={styles.navText}>Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
            </Pressable>
          </View>

          {/* Log Out Button */}
          <View style={styles.footer}>
            <Pressable style={styles.logoutButton} onPress={handleLogOut}>
              <Ionicons name="log-out-outline" size={20} color={colors.danger} />
              <Text style={styles.logoutText}>Log out</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  backdropPressable: {
    flex: 1,
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: colors.bg,
    borderRightWidth: 1,
    borderRightColor: colors.divider,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  profileHeader: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.accent,
    marginBottom: 16,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.surface3,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.textBody,
  },
  profileInfo: {
    gap: 4,
  },
  profileNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  profileName: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    textTransform: "uppercase",
  },
  profileUsername: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
  },
  statsSection: {
    flexDirection: "row",
    gap: 24,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.text,
  },
  statLabel: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textDim,
  },
  navSection: {
    flex: 1,
    paddingVertical: 16,
    gap: 4,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  navItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  navIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    justifyContent: "center",
    alignItems: "center",
  },
  navText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.text,
  },
  footer: {
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoutText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    color: colors.danger,
  },
});
