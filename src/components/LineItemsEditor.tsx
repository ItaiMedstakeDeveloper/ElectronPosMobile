import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Select } from '@/components/ui';
import { colors, spacing, radius, currency } from '@/theme';
import type { LineItem, Product } from '@/data/mockData';

// Editable list of product line items used by Purchase Orders, GRVs and Quotes.
export function LineItemsEditor({
  items,
  onChange,
  products,
  priceField,
}: {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  products: Product[];
  priceField: 'cost' | 'price';
}) {
  const addProduct = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    if (items.some((i) => i.productId === productId)) return;
    onChange([
      ...items,
      { productId, name: prod.name, unit: prod.unit, qty: 1, unitCost: prod[priceField] },
    ]);
  };
  const setQty = (productId: string, qty: number) =>
    onChange(items.map((i) => (i.productId === productId ? { ...i, qty: Math.max(0, qty) } : i)));
  const remove = (productId: string) =>
    onChange(items.filter((i) => i.productId !== productId));

  return (
    <View style={{ gap: spacing.sm }}>
      <Select
        label="Add Product"
        value={undefined}
        onChange={addProduct}
        placeholder="Search products…"
        options={products
          .filter((p) => !items.some((i) => i.productId === p.id))
          .map((p) => ({ label: `${p.name} (${currency(p[priceField])})`, value: p.id }))}
      />

      {items.length === 0 ? (
        <Text style={s.empty}>No line items yet.</Text>
      ) : (
        items.map((it) => (
          <View key={it.productId} style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{it.name}</Text>
              <Text style={s.meta}>
                {currency(it.unitCost)} / {it.unit}
              </Text>
            </View>
            <TextInput
              style={s.qtyInput}
              value={String(it.qty)}
              onChangeText={(v) => setQty(it.productId, parseInt(v, 10) || 0)}
              keyboardType="number-pad"
            />
            <Text style={s.lineTotal}>{currency(it.qty * it.unitCost)}</Text>
            <Pressable onPress={() => remove(it.productId)} style={s.removeBtn}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

export const lineItemsTotal = (items: LineItem[]) =>
  items.reduce((n, i) => n + i.qty * i.unitCost, 0);

const s = StyleSheet.create({
  empty: { color: colors.textMuted, fontSize: 13, paddingVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { fontSize: 14, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  qtyInput: {
    width: 52,
    textAlign: 'center',
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    outlineStyle: 'none' as any,
  },
  lineTotal: { minWidth: 70, textAlign: 'right', fontSize: 14, fontWeight: '700', color: colors.text },
  removeBtn: { padding: 2 },
});
