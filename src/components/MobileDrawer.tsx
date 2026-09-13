import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/theme";
import { NavMenu } from "@/components/NavMenu";
import { ShopSwitcher } from "@/components/ShopSwitcher";
import { TrialBadge } from "@/components/TrialBadge";
import { useAuth, roleLabel } from "@/context/AuthContext";

const PANEL_WIDTH = 288;

// Slide-out left drawer used on mobile in place of a "More" screen. Always mounted;
// animates in/out from `open` and blocks touches only while visible.
export function MobileDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { role, user, signOut } = useAuth();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [open, progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-PANEL_WIDTH, 0],
  });
  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  const logout = () => {
    onClose();
    signOut();
    router.replace("/");
  };

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={open ? "auto" : "none"}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]} />
      </Pressable>
      <Animated.View style={[s.panel, { transform: [{ translateX }] }]}>
        <SafeAreaView style={s.panelSafe} edges={["top", "bottom", "left"]}>
          <View style={s.brand}>
            <View style={s.logo}>
              <Ionicons name="flash" size={20} color="#2b2b2b" />
            </View>
            <Text style={s.brandText}>Electron POS</Text>
            <Pressable onPress={onClose} style={s.close} hitSlop={8}>
              <Ionicons name="close" size={22} color="#cfd2d6" />
            </Pressable>
          </View>

          <ShopSwitcher />

          <ScrollView style={s.nav} showsVerticalScrollIndicator={false}>
            <NavMenu dark onNavigate={onClose} />
          </ScrollView>

          <View style={s.account}>
            <TrialBadge />
            <View style={s.accountRow}>
              <Ionicons
                name={
                  role === "cashier"
                    ? "person-outline"
                    : "shield-checkmark-outline"
                }
                size={16}
                color="#cfd2d6"
              />
              <View style={{ flex: 1 }}>
                <Text style={s.accountName} numberOfLines={1}>
                  {user?.name || user?.email || "Signed in"}
                </Text>
                <Text style={s.accountRole}>{role ? roleLabel[role] : ""}</Text>
              </View>
            </View>
            <Pressable style={s.logoutBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={18} color="#cfd2d6" />
              <Text style={s.logoutText}>Sign Out</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000" },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_WIDTH,
    backgroundColor: colors.sidebar,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
    elevation: 16,
  },
  panelSafe: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  logo: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    flex: 1,
    color: colors.textOnDark,
    fontSize: 17,
    fontWeight: "700",
  },
  close: { padding: 4 },
  nav: { flex: 1 },
  account: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.sidebarHover,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  accountName: { color: colors.textOnDark, fontSize: 13, fontWeight: "600" },
  accountRole: { color: "#9a9da1", fontSize: 12 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  logoutText: { color: "#cfd2d6", fontSize: 15, fontWeight: "500" },
});
