import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius } from "@/theme";
import { useShop } from "@/context/ShopContext";
import { useAuth } from "@/context/AuthContext";

// Compact "active shop" chip shown at the top of the sidebar / mobile drawer.
// Admins can tap it to switch between shops or jump to shop management; other
// roles just see which shop they're working in.
export function ShopSwitcher() {
  const router = useRouter();
  const { role } = useAuth();
  const { shops, activeShop, activeShopId, switching, switchShop } = useShop();
  const [open, setOpen] = useState(false);

  const isAdmin = role === "admin";
  // Nothing useful to show until the shop layer is ready.
  if (!activeShop) return null;

  const pick = (id: string) => {
    setOpen(false);
    if (id !== activeShopId) switchShop(id);
  };

  const manage = () => {
    setOpen(false);
    router.push("/shops" as any);
  };

  return (
    <>
      <Pressable
        style={s.chip}
        onPress={() => isAdmin && setOpen(true)}
        disabled={!isAdmin || switching}
      >
        <View style={s.chipIcon}>
          <Ionicons name="storefront" size={16} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.chipLabel}>SHOP</Text>
          <Text style={s.chipName} numberOfLines={1}>
            {activeShop.name}
          </Text>
        </View>
        {isAdmin ? (
          <Ionicons name="chevron-down" size={16} color="#9a9da1" />
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={s.sheetTitle}>Switch Shop</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {shops.map((shop) => {
                const active = shop.id === activeShopId;
                return (
                  <Pressable key={shop.id} style={s.item} onPress={() => pick(shop.id)}>
                    <Ionicons
                      name="storefront-outline"
                      size={18}
                      color={active ? colors.primary : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.itemName, active && { color: colors.primary }]} numberOfLines={1}>
                        {shop.name}
                      </Text>
                      {shop.isDefault ? <Text style={s.itemMeta}>Default</Text> : null}
                    </View>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable style={s.manage} onPress={manage}>
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
              <Text style={s.manageText}>Manage shops</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  chipIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: "rgba(247,181,0,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipLabel: { color: "#9a9da1", fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
  chipName: { color: colors.textOnDark, fontSize: 14, fontWeight: "700" },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  sheet: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 4,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
  itemName: { fontSize: 15, fontWeight: "600", color: colors.text },
  itemMeta: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  manage: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  manageText: { fontSize: 15, fontWeight: "700", color: colors.primary },
});
