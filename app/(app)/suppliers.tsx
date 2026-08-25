import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Screen,
  Card,
  Button,
  FormModal,
  TextField,
  Select,
} from "@/components/ui";
import { colors, spacing } from "@/theme";
import { useData } from "@/context/DataContext";
import { confirmAction } from "@/lib/confirm";
import type { Supplier } from "@/data/mockData";

const empty: Omit<Supplier, "id"> = {
  name: "",
  tin: "",
  vat: "",
  address: "",
  type: "NA",
  phone: "",
  contactPerson: "",
  contactPhone: "",
};

export default function Suppliers() {
  const { suppliers } = useData();
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Supplier, "id">>(empty);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const openAdd = () => {
    setEditId(null);
    setForm(empty);
    setModal(true);
  };
  const openEdit = (sup: Supplier) => {
    setEditId(sup.id);
    const { id, ...rest } = sup;
    setForm(rest);
    setModal(true);
  };
  const save = () => {
    if (!form.name.trim()) return;
    if (editId) suppliers.update(editId, form);
    else suppliers.add(form);
    setModal(false);
  };

  return (
    <Screen
      title="Suppliers"
      subtitle={`${suppliers.items.length} suppliers`}
      action={<Button title="Add" icon="add" onPress={openAdd} />}
    >
      {suppliers.items.map((sup) => (
        <Card key={sup.id}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{sup.name}</Text>
              <Text style={s.meta}>
                {sup.type} · TIN {sup.tin} · VAT {sup.vat}
              </Text>
            </View>
            <Pressable style={s.iconBtn} onPress={() => openEdit(sup)}>
              <Ionicons
                name="create-outline"
                size={20}
                color={colors.primary}
              />
            </Pressable>
            <Pressable
              style={s.iconBtn}
              onPress={() =>
                confirmAction(`Delete "${sup.name}"?`, () =>
                  suppliers.remove(sup.id),
                )
              }
            >
              <Ionicons name="trash-outline" size={20} color={colors.danger} />
            </Pressable>
          </View>
          <View style={s.info}>
            <Row icon="location-outline" text={sup.address} />
            <Row icon="call-outline" text={sup.phone} />
            <Row
              icon="person-outline"
              text={`${sup.contactPerson} · ${sup.contactPhone}`}
            />
          </View>
        </Card>
      ))}

      <FormModal
        visible={modal}
        title={editId ? "Edit Supplier" : "Add Supplier"}
        onClose={() => setModal(false)}
        onSubmit={save}
      >
        <TextField
          label="Supplier Name"
          value={form.name}
          onChangeText={(v) => set("name", v)}
        />
        <TextField
          label="TIN Number"
          value={form.tin}
          onChangeText={(v) => set("tin", v)}
          keyboardType="number-pad"
        />
        <TextField
          label="VAT Number"
          value={form.vat}
          onChangeText={(v) => set("vat", v)}
          keyboardType="number-pad"
        />
        <TextField
          label="Address"
          value={form.address}
          onChangeText={(v) => set("address", v)}
        />
        <Select
          label="Supplier Type"
          value={form.type}
          onChange={(v) => set("type", v)}
          options={[
            { label: "NA", value: "NA" },
            { label: "Cash", value: "Cash" },
            { label: "Credit", value: "Credit" },
          ]}
        />
        <TextField
          label="Phone Number"
          value={form.phone}
          onChangeText={(v) => set("phone", v)}
          keyboardType="phone-pad"
        />
        <TextField
          label="Contact Person"
          value={form.contactPerson}
          onChangeText={(v) => set("contactPerson", v)}
        />
        <TextField
          label="Contact Person Number"
          value={form.contactPhone}
          onChangeText={(v) => set("contactPhone", v)}
          keyboardType="phone-pad"
        />
      </FormModal>
    </Screen>
  );
}

function Row({
  icon,
  text,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  text: string;
}) {
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={s.infoText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  iconBtn: { padding: 6 },
  info: { marginTop: spacing.sm, gap: 4 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  infoText: { fontSize: 13, color: colors.textMuted, flex: 1 },
});
