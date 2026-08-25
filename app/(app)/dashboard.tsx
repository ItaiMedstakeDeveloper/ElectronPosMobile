import React, { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Pressable,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card } from "@/components/ui";
import { Button, TextField } from "@/components/ui";
import { colors, spacing, radius, shadow, currency } from "@/theme";
import { useData } from "@/context/DataContext";

export default function Dashboard() {
  const { width } = useWindowDimensions();
  const cols = width >= 1000 ? 4 : 2;
  const {
    products,
    customers,
    availableStock,
    totalStockValue,
    currencyCode,
    exchangeRate,
    setCurrency,
  } = useData();

  // Local editing state for the ZiG rate form. Seed from the saved rate and
  // keep it in sync when the persisted rate loads or changes (e.g. the SQLite
  // value arrives after first paint, or we return to this screen) so the saved
  // amount is never shown as blank/1.
  const [rateInput, setRateInput] = useState(String(exchangeRate));
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setRateInput(String(exchangeRate));
  }, [exchangeRate]);

  // Persist the entered ZiG rate when leaving this screen, so a rate typed in
  // (even without tapping "Save rate") isn't lost on navigation. A ref holds the
  // latest values so the on-blur handler never reads stale state.
  const persistRef = useRef<() => void>(() => {});
  persistRef.current = () => {
    if (currencyCode === "ZiG") {
      const r = Number(rateInput);
      if (r > 0 && r !== exchangeRate) setCurrency("ZiG", r);
    }
  };
  useFocusEffect(
    useCallback(() => {
      return () => persistRef.current();
    }, []),
  );

  const lowStock = products.items.filter(
    (p) => availableStock(p) <= (p.reorderLevel ?? 0),
  );

  const stats = [
    {
      label: "Stock Value",
      value: currency(totalStockValue),
      icon: "cash-outline",
      tone: colors.success,
    },
    {
      label: "Products",
      value: String(products.items.length),
      icon: "pricetags-outline",
      tone: colors.primary,
    },
    {
      label: "Low Stock",
      value: String(lowStock.length),
      icon: "alert-circle-outline",
      tone: colors.danger,
    },
    {
      label: "Customers",
      value: String(customers.items.length),
      icon: "people-outline",
      tone: colors.accent,
    },
  ] as const;

  const selectUsd = () => {
    // Switch display to USD without touching the saved ZiG rate.
    setCurrency("USD");
    setSaved(false);
  };
  const selectZig = () => {
    // Switch to ZiG immediately using the current/edited rate.
    const r = Number(rateInput) > 0 ? Number(rateInput) : exchangeRate;
    setRateInput(String(r));
    setCurrency("ZiG", r);
    setSaved(false);
  };
  const saveRate = () => {
    const r = Number(rateInput);
    if (!(r > 0)) return;
    setCurrency("ZiG", r);
    setSaved(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Dashboard" subtitle="Overview of your point of sale">
        {/* Currency switch */}
        <Text style={s.sectionTitle}>Currency</Text>
        <View style={s.currencyRow}>
          <CurrencyCard
            label=""
            code="USD"
            symbol="$"
            active={currencyCode === "USD"}
            disabled={currencyCode === "USD"}
            onPress={selectUsd}
          />
          <CurrencyCard
            label=""
            code="ZiG"
            symbol="ZiG"
            active={currencyCode === "ZiG"}
            disabled={currencyCode === "ZiG"}
            onPress={selectZig}
          />
        </View>

        {currencyCode === "ZiG" && (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={s.rateHeadline}>
              1 USD = {Number(rateInput) > 0 ? rateInput : "?"} ZiG
            </Text>
            <Text style={s.rateHint}>
              Set the exchange rate. All prices across the app will display in
              ZiG at this rate.
            </Text>
            <TextField
              label="Exchange rate (ZiG per 1 USD)"
              icon="swap-horizontal-outline"
              placeholder="e.g. 36.50"
              keyboardType="decimal-pad"
              value={rateInput}
              onChangeText={(v) => {
                setRateInput(v);
                setSaved(false);
              }}
            />
            <Button
              title={saved ? "Saved" : "Save rate"}
              icon={saved ? "checkmark-circle-outline" : "save-outline"}
              onPress={saveRate}
              disabled={!(Number(rateInput) > 0)}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Stats */}
        <Text style={s.sectionTitle}>Overview</Text>
        <View style={[s.grid, { gap: spacing.md }]}>
          {stats.map((st) => (
            <Card
              key={st.label}
              style={{
                flexBasis: `${100 / cols}%`,
                flexGrow: 1,
                minWidth: 150,
              }}
            >
              <View style={s.statRow}>
                <View style={[s.iconWrap, { backgroundColor: st.tone + "22" }]}>
                  <Ionicons name={st.icon as any} size={22} color={st.tone} />
                </View>
                <View>
                  <Text style={s.statValue}>{st.value}</Text>
                  <Text style={s.statLabel}>{st.label}</Text>
                </View>
              </View>
            </Card>
          ))}
        </View>

        {lowStock.length > 0 && (
          <>
            <Text style={s.sectionTitle}>Low Stock Alerts</Text>
            <Card>
              {lowStock.map((p, idx) => (
                <View
                  key={p.id}
                  style={[s.invRow, idx < lowStock.length - 1 && s.divider]}
                >
                  <Text style={{ flex: 1, color: colors.text }}>{p.name}</Text>
                  <Text style={s.lowQty}>{availableStock(p)} left</Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </Screen>
      <WhatsAppFab />
    </View>
  );
}

// Floating WhatsApp button: opens a chat to support prefilled with "Hi".
// Tries the WhatsApp app scheme first, then falls back to the wa.me web link
// (which opens WhatsApp if installed, or a browser page otherwise).
function WhatsAppFab() {
  const PHONE = "263771255849";
  const MESSAGE = "Hi";
  const openWhatsApp = async () => {
    const appUrl = `whatsapp://send?phone=${PHONE}&text=${encodeURIComponent(MESSAGE)}`;
    const webUrl = `https://wa.me/${PHONE}?text=${encodeURIComponent(MESSAGE)}`;
    try {
      await Linking.openURL(appUrl);
    } catch {
      try {
        await Linking.openURL(webUrl);
      } catch {
        /* no handler available */
      }
    }
  };
  return (
    <Pressable
      onPress={openWhatsApp}
      accessibilityLabel="Message us on WhatsApp"
      style={({ pressed }) => [s.fab, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name="logo-whatsapp" size={28} color="#fff" />
    </Pressable>
  );
}

function CurrencyCard({
  label,
  code,
  symbol,
  active,
  disabled,
  onPress,
}: {
  label: string;
  code: string;
  symbol: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[s.curCard, active && s.curCardActive]}
    >
      <View style={[s.curSymbol, active && s.curSymbolActive]}>
        <Text style={[s.curSymbolText, active && s.curSymbolTextActive]}>
          {symbol}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.curCode, active && s.curCodeActive]}>{code}</Text>
        <Text style={s.curLabel}>{label}</Text>
      </View>
      {active && (
        <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap" },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#25D366",
    ...shadow,
    elevation: 6,
  },
  currencyRow: { flexDirection: "row", gap: spacing.md },
  curCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow,
  },
  curCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  curSymbol: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bg,
  },
  curSymbolActive: { backgroundColor: colors.primary },
  curSymbolText: { fontSize: 16, fontWeight: "800", color: colors.textMuted },
  curSymbolTextActive: { color: colors.textOnDark },
  curCode: { fontSize: 16, fontWeight: "800", color: colors.text },
  curCodeActive: { color: colors.primary },
  curLabel: { fontSize: 12, color: colors.textMuted },
  rateHeadline: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  rateHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  statRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { fontSize: 22, fontWeight: "700", color: colors.text },
  statLabel: { fontSize: 13, color: colors.textMuted },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
  },
  invRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  lowQty: { fontSize: 14, fontWeight: "700", color: colors.danger },
});
