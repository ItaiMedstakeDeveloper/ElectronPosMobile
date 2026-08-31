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
  const { products, categories } = useData();
  const { add, lines, subtotal, count } = useCart();
  const [query, setQuery] = useState("");
  // Which browse mode: the flat "All Items" grid, or drill into "Categories".
  const [tab, setTab] = useState<"all" | "categories">("all");
  // In the categories tab, the category we've drilled into (null = show the
  // list of category cards).
  const [catId, setCatId] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const cols = width >= 1100 ? 4 : width >= 700 ? 3 : 2;

  const qtyById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const l of lines) m[l.product.id] = l.qty;
    return m;
  }, [lines]);

  const q = query.trim().toLowerCase();
  const matches = (p: Product) =>
    p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);

  // Products shown in the grid: everything (All Items) or one category, each
  // narrowed by the search box.
  const gridProducts = useMemo(() => {
    let items = products.items;
    if (tab === "categories") items = items.filter((p) => p.categoryId === catId);
    return q ? items.filter(matches) : items;
  }, [tab, catId, q, products.items]);

  // Category cards (with product counts), filtered by search on the name.
  const catCards = useMemo(() => {
    const cards = categories.items.map((c) => ({
      ...c,
      count: products.items.filter((p) => p.categoryId === c.id).length,
    }));
    return q ? cards.filter((c) => c.name.toLowerCase().includes(q)) : cards;
  }, [categories.items, products.items, q]);

  const switchTab = (next: "all" | "categories") => {
    setTab(next);
    setCatId(null);
  };

  const activeCat = catId
    ? categories.items.find((c) => c.id === catId)
    : null;
  // Show the category picker when in the categories tab with nothing drilled into.
  const showCategoryList = tab === "categories" && !catId;

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

        {/* Browse tabs: segmented pill */}
        <View style={s.segment}>
          {(
            [
              ["all", "All Items"],
              ["categories", "Categories"],
            ] as const
          ).map(([key, label]) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                style={[s.segmentBtn, active && s.segmentBtnActive]}
                onPress={() => switchTab(key)}
              >
                <Text style={[s.segmentText, active && s.segmentTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Drill-down header once inside a category */}
        {activeCat ? (
          <Pressable style={s.backRow} onPress={() => setCatId(null)}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={s.backText}>Categories</Text>
            <Text style={s.crumbSep}>/</Text>
            <Text style={s.crumbCurrent}>{activeCat.name}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Content: category cards, or the product grid */}
      <ScrollView
        contentContainerStyle={s.gridContent}
        showsVerticalScrollIndicator={false}
      >
        {showCategoryList ? (
          <>
            <View style={s.grid}>
              {catCards.map((c) => (
                <Pressable
                  key={c.id}
                  style={[s.tile, { flexBasis: `${100 / cols}%` }]}
                  onPress={() => setCatId(c.id)}
                >
                  <View style={s.catInner}>
                    <View
                      style={[s.catIcon, { backgroundColor: tileColor(c.id) }]}
                    >
                      <Ionicons
                        name="grid-outline"
                        size={24}
                        color={colors.text}
                      />
                    </View>
                    <Text style={s.tileName} numberOfLines={2}>
                      {c.name}
                    </Text>
                    <Text style={s.catCount}>
                      {c.count} item{c.count === 1 ? "" : "s"}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
            {catCards.length === 0 ? (
              <Text style={s.empty}>No categories match your search.</Text>
            ) : null}
          </>
        ) : (
          <>
            <View style={s.grid}>
              {gridProducts.map((p) => {
                const inCart = qtyById[p.id] ?? 0;
                return (
                  <Pressable
                    key={p.id}
                    style={[s.tile, { flexBasis: `${100 / cols}%` }]}
                    onPress={() => add(p)}
                  >
                    <View style={s.tileInner}>
                      <View
                        style={[s.thumb, { backgroundColor: tileColor(p.id) }]}
                      >
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
            {gridProducts.length === 0 ? (
              <Text style={s.empty}>No products match your search.</Text>
            ) : null}
          </>
        )}
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

  // Segmented pill tab bar
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: radius.sm,
  },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 14, fontWeight: "700", color: colors.textMuted },
  segmentTextActive: { color: "#fff" },

  // Category drill-down breadcrumb
  backRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 15, fontWeight: "600", color: colors.primary },
  crumbSep: { fontSize: 15, color: colors.textMuted, marginHorizontal: 2 },
  crumbCurrent: { fontSize: 15, fontWeight: "700", color: colors.text },

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

  // Category card (Categories tab, before drilling in)
  catInner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: "center",
    gap: 8,
  },
  catIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  catCount: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
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
