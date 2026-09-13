import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, Badge, Button, FormModal, TextField } from "@/components/ui";
import { colors, spacing, radius } from "@/theme";
import { useShop } from "@/context/ShopContext";
import { confirmAction, notify } from "@/lib/confirm";

type Form = { name: string; address: string; phone: string };
const empty: Form = { name: "", address: "", phone: "" };

export default function Shops() {
  const { shops, activeShopId, switching, createShop, switchShop, setDefault, removeShop } =
    useShop();
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => {
    setForm(empty);
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return notify("Please enter a shop name.");
    setBusy(true);
    try {
      await createShop({ name: form.name, address: form.address, phone: form.phone });
      setModal(false);
    } catch (e) {
      console.error("Create shop failed", e);
      notify("Could not create the shop. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const onSwitch = (id: string) => {
    if (id === activeShopId || switching) return;
    switchShop(id).catch((e) => {
      console.error("Switch shop failed", e);
      notify("Could not switch shops. Please try again.");
    });
  };

  const onDelete = (id: string, name: string) => {
    if (id === activeShopId) {
      return notify("You can't delete the shop you're currently in. Switch to another shop first.");
    }
    if (shops.length <= 1) {
      return notify("You must keep at least one shop.");
    }
    confirmAction(
      `Delete "${name}"? This permanently removes the shop and all of its data.`,
      () => removeShop(id).catch((e) => {
        console.error("Delete shop failed", e);
        notify("Could not delete the shop.");
      }),
    );
  };

  return (
    <Screen
      title="Shops"
      subtitle={`${shops.length} shop${shops.length === 1 ? "" : "s"}`}
      action={<Button title="Add Shop" icon="add" onPress={openAdd} />}
    >
      {shops.map((shop) => {
        const active = shop.id === activeShopId;
        return (
          <Card key={shop.id}>
            <View style={s.row}>
              <View style={[s.icon, active && s.iconActive]}>
                <Ionicons name="storefront" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{shop.name}</Text>
                {shop.address || shop.phone ? (
                  <Text style={s.meta} numberOfLines={1}>
                    {[shop.address, shop.phone].filter(Boolean).join(" · ")}
                  </Text>
                ) : (
                  <Text style={s.meta}>No address set</Text>
                )}
              </View>
              <View style={s.badges}>
                {active ? <Badge text="Active" tone="success" /> : null}
                {shop.isDefault ? <Badge text="Default" tone="accent" /> : null}
              </View>
            </View>

            <View style={s.actions}>
              {!active ? (
                <Pressable style={s.actionBtn} onPress={() => onSwitch(shop.id)} disabled={switching}>
                  <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
                  <Text style={s.actionText}>Switch to</Text>
                </Pressable>
              ) : null}
              {!shop.isDefault ? (
                <Pressable style={s.actionBtn} onPress={() => setDefault(shop.id)}>
                  <Ionicons name="star-outline" size={18} color={colors.primary} />
                  <Text style={s.actionText}>Set default</Text>
                </Pressable>
              ) : null}
              <Pressable style={s.actionBtn} onPress={() => onDelete(shop.id, shop.name)}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
                <Text style={[s.actionText, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            </View>
          </Card>
        );
      })}

      <FormModal
        visible={modal}
        title="Add Shop"
        submitLabel={busy ? "Creating…" : "Create Shop"}
        onClose={() => setModal(false)}
        onSubmit={save}
      >
        <Text style={s.note}>
          A new shop starts with its own staff, products and sales. It becomes your active
          shop right away.
        </Text>
        <TextField
          label="Shop Name"
          placeholder="e.g. Avondale Branch"
          value={form.name}
          onChangeText={(v) => set("name", v)}
        />
        <TextField
          label="Address (optional)"
          placeholder="e.g. 12 Main St, Harare"
          value={form.address}
          onChangeText={(v) => set("address", v)}
        />
        <TextField
          label="Phone (optional)"
          placeholder="+263 77 123 4567"
          keyboardType="phone-pad"
          value={form.phone}
          onChangeText={(v) => set("phone", v)}
        />
      </FormModal>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  iconActive: { backgroundColor: colors.primary },
  name: { fontSize: 16, fontWeight: "600", color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  badges: { alignItems: "flex-end", gap: 4 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
  },
  actionText: { fontSize: 14, fontWeight: "600", color: colors.primary },
  note: { fontSize: 13, color: colors.textMuted, marginBottom: 4 },
});
