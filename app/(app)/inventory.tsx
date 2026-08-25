import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Card, Badge } from '@/components/ui';
import { colors, spacing, currency } from '@/theme';
import { useData } from '@/context/DataContext';

export default function Inventory() {
  const { products, categories, availableStock, totalStockValue } = useData();
  const categoryName = (id: string) => categories.items.find((c) => c.id === id)?.name ?? 'Uncategorised';
  // Sort by how close each product is to its reorder level, using the stock
  // level calculated from the GRV `stocks` ledger.
  const ratio = (p: (typeof products.items)[number]) =>
    availableStock(p) / (p.reorderLevel || 1);
  const sorted = [...products.items].sort((a, b) => ratio(a) - ratio(b));

  return (
    <Screen
      title="Inventory"
      subtitle={`Stock levels across all products · Value ${currency(totalStockValue)}`}
    >
      <Card style={{ padding: 0 }}>
        <View style={[s.row, s.headRow]}>
          <Text style={[s.cell, s.flex2, s.headText]}>Product</Text>
          <Text style={[s.cell, s.flex1, s.headText]}>Stock</Text>
          <Text style={[s.cell, s.flex1, s.headText]}>Status</Text>
        </View>
        {sorted.map((p, idx) => {
          const qty = availableStock(p);
          const low = qty <= p.reorderLevel;
          return (
            <View key={p.id} style={[s.row, idx < sorted.length - 1 && s.divider]}>
              <View style={[s.cell, s.flex2]}>
                <Text style={s.name}>{p.name}</Text>
                <Text style={s.meta}>{p.sku} · {categoryName(p.categoryId)}</Text>
              </View>
              <Text style={[s.cell, s.flex1, s.stock]}>{qty}</Text>
              <View style={[s.cell, s.flex1]}>
                <Badge text={low ? 'Reorder' : 'OK'} tone={low ? 'danger' : 'success'} />
              </View>
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 12 },
  headRow: { backgroundColor: colors.bg, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  headText: { fontSize: 12, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  cell: { paddingRight: spacing.sm },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  name: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  stock: { fontSize: 16, fontWeight: '700', color: colors.text },
});
