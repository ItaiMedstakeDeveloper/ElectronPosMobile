import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen, Card, Badge, Button, FormModal } from "@/components/ui";
import { colors, spacing, currency } from "@/theme";
import { useData } from "@/context/DataContext";
import { confirmAction, notify } from "@/lib/confirm";
import {
    CustomerFields,
    CustomerForm,
    emptyCustomer,
} from "@/components/CustomerFields";
import type { Customer } from "@/data/mockData";

export default function Customers() {
    const { customers } = useData();
    const [modal, setModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<CustomerForm>(emptyCustomer);

    const set = <K extends keyof CustomerForm>(k: K, v: CustomerForm[K]) =>
        setForm((f) => ({ ...f, [k]: v }));

    const openEdit = (c: Customer) => {
        setEditId(c.id);
        const { id, balance, ...rest } = c;
        setForm(rest);
        setModal(true);
    };

    const save = () => {
        // Mirror the Laravel customer rules: customer_name required, code required
        // and unique (ignoring the record currently being edited).
        if (!form.name.trim()) {
            notify("Please enter a customer name.");
            return;
        }
        if (!form.code.trim()) {
            notify("Please enter a customer code.");
            return;
        }
        const code = form.code.trim().toLowerCase();
        if (
            customers.items.some(
                (c) => c.id !== editId && c.code.trim().toLowerCase() === code,
            )
        ) {
            notify(
                `The code "${form.code.trim()}" is already used by another customer.`,
            );
            return;
        }
        const clean = {
            ...form,
            name: form.name.trim(),
            code: form.code.trim(),
        };
        if (editId) customers.update(editId, clean);
        else customers.add({ ...clean, balance: 0 });
        setModal(false);
    };

    return (
        <Screen
            title="Customers"
            subtitle={`${customers.items.length} customers`}
            action={
                <Button
                    title="Add"
                    icon="add"
                    onPress={() => {
                        setEditId(null);
                        setForm(emptyCustomer);
                        setModal(true);
                    }}
                />
            }
        >
            {customers.items.map((c) => (
                <Card key={c.id}>
                    <View style={s.row}>
                        <View style={s.avatar}>
                            <Text style={s.avatarText}>{c.name.charAt(0)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.name}>{c.name}</Text>
                            <Text style={s.meta}>
                                {c.code} · {c.type}
                            </Text>
                            <View style={s.metaRow}>
                                <Ionicons
                                    name="call-outline"
                                    size={13}
                                    color={colors.textMuted}
                                />
                                <Text style={s.meta}>{c.phone}</Text>
                            </View>
                        </View>
                        <View style={s.actions}>
                            <Badge
                                text={
                                    c.status === "Active"
                                        ? "Active"
                                        : "Inactive"
                                }
                                tone={
                                    c.status === "Active" ? "success" : "muted"
                                }
                            />
                            {c.balance > 0 ? (
                                <Text style={s.owes}>
                                    Owes {currency(c.balance)}
                                </Text>
                            ) : null}
                            <View style={s.iconRow}>
                                <Pressable
                                    style={s.iconBtn}
                                    onPress={() => openEdit(c)}
                                >
                                    <Ionicons
                                        name="create-outline"
                                        size={20}
                                        color={colors.primary}
                                    />
                                </Pressable>
                                <Pressable
                                    style={s.iconBtn}
                                    onPress={() =>
                                        confirmAction(
                                            `Delete "${c.name}"?`,
                                            () => customers.remove(c.id),
                                        )
                                    }
                                >
                                    <Ionicons
                                        name="trash-outline"
                                        size={20}
                                        color={colors.danger}
                                    />
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Card>
            ))}

            <FormModal
                visible={modal}
                title={editId ? "Edit Customer" : "Add Customer"}
                onClose={() => setModal(false)}
                onSubmit={save}
            >
                <CustomerFields form={form} set={set} />
            </FormModal>
        </Screen>
    );
}

const s = StyleSheet.create({
    row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
    },
    avatarText: { color: "#fff", fontSize: 18, fontWeight: "700" },
    name: { fontSize: 16, fontWeight: "600", color: colors.text },
    meta: { fontSize: 13, color: colors.textMuted },
    metaRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 3,
    },
    actions: { alignItems: "flex-end", gap: 4 },
    owes: { fontSize: 12, color: colors.danger, fontWeight: "600" },
    iconRow: { flexDirection: "row" },
    iconBtn: { padding: 6 },
});
