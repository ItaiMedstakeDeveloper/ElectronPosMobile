import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius, currency } from "@/theme";
import { useData } from "@/context/DataContext";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/data/mockData";

// A tinted thumbnail derived from the product name (real photos would need an
// image field + picker). The tile's colour is stable per product.
const TILE_COLORS = [
  "#e9edfc",
  "#fdeee0",
  "#e6f7f0",
  "#fbe9ef",
  "#eef1f5",
  "#e8f4fb",
];
const tileColor = (id: string) =>
  TILE_COLORS[Math.abs(hash(id)) % TILE_COLORS.length];
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}

export default function Sell() {
  const router = useRouter();
  const { products } = useData();
  const { add, lines, subtotal, count } = useCart();
  const [query, setQuery] = useState("");
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 4 : width >= 700 ? 3 : 2;

  const qtyById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of lines) m[l.product.id] = l.qty;
    return m;
  }, [lines]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products.items;
    return products.items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [query, products.items]);

  return (
    <View style={s.root}>
      {/* Header + search */}
      <View style={s.header}>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={s.search}
            placeholder="Search by name or barcode…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          {query ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Product grid */}
      <ScrollView
        contentContainerStyle={s.gridContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.grid}>
          {filtered.map((p) => {
            const inCart = qtyById[p.id] ?? 0;
            return (
              <Pressable
                key={p.id}
                style={[s.tile, { flexBasis: `${100 / cols}%` }]}
                onPress={() => add(p)}
              >
                <View style={s.tileInner}>
                  <View style={[s.thumb, { backgroundColor: tileColor(p.id) }]}>
                    <Text style={s.thumbText}>
                      {p.name.charAt(0).toUpperCase()}
                    </Text>
                    {inCart > 0 ? (
                      <View style={s.countBadge}>
                        <Text style={s.countBadgeText}>{inCart}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={s.tileName} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <Text style={s.tilePrice}>{currency(p.price)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {filtered.length === 0 ? (
          <Text style={s.empty}>No products match your search.</Text>
        ) : null}
      </ScrollView>

      {/* Sticky checkout bar (above the bottom nav) */}
      {count > 0 ? (
        <Pressable
          style={s.checkoutBar}
          onPress={() => router.push("/checkout")}
        >
          <View style={s.cartCircle}>
            <Text style={s.cartCircleText}>{count}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.checkoutLabel}>Checkout</Text>
            <Text style={s.checkoutHint}>
              {count} item{count === 1 ? "" : "s"}
            </Text>
          </View>
          <Text style={s.checkoutTotal}>{currency(subtotal)}</Text>
          <Ionicons name="arrow-forward" size={20} color="#2b2b2b" />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.4,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  search: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    outlineStyle: "none" as any,
  },

  gridContent: {
    padding: spacing.md,
    paddingBottom: 96,
    maxWidth: 1100,
    width: "100%",
    alignSelf: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  tile: { padding: spacing.xs },
  tileInner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 6,
  },
  thumb: {
    width: "100%",
    aspectRatio: 1.4,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbText: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.text,
    opacity: 0.5,
  },
  countBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  tileName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    minHeight: 36,
  },
  tilePrice: { fontSize: 15, fontWeight: "800", color: colors.primary },
  empty: { color: colors.textMuted, padding: spacing.md, textAlign: "center" },

  checkoutBar: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  cartCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  cartCircleText: { color: "#2b2b2b", fontWeight: "800", fontSize: 15 },
  checkoutLabel: { color: "#2b2b2b", fontWeight: "800", fontSize: 16 },
  checkoutHint: { color: "#5a4a00", fontWeight: "600", fontSize: 12 },
  checkoutTotal: { color: "#2b2b2b", fontWeight: "800", fontSize: 17 },
});
