import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Card, Badge, Select } from '@/components/ui';
import { colors, spacing, currency } from '@/theme';
import { useData } from '@/context/DataContext';

function stockStatus(qty: number): { label: string; tone: 'success' | 'accent' | 'danger' | 'muted' } {
  if (qty <= 0) return { label: 'Out of Stock', tone: 'danger' };
  if (qty <= 10) return { label: 'Low Stock', tone: 'danger' };
  if (qty <= 50) return { label: 'Medium Stock', tone: 'accent' };
  return { label: 'High Stock', tone: 'success' };
}

export default function StockEnquiry() {
  const { products, availableStock } = useData();
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const selected = products.items.find((p) => p.id === productId);
  const selectedQty = selected ? availableStock(selected) : 0;

  return (
    <Screen title="Stock Enquiry" subtitle="Check stock levels by product">
      <Card>
        <Select
          label="Select Product"
          value={productId}
          onChange={setProductId}
          placeholder="Choose a product…"
          options={products.items.map((p) => ({ label: `${p.name} (${p.sku})`, value: p.id }))}
        />
      </Card>

      {selected ? (
        <Card>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{selected.name}</Text>
              <Text style={s.meta}>{selected.sku}</Text>
            </View>
            <Badge text={stockStatus(selectedQty).label} tone={stockStatus(selectedQty).tone} />
          </View>
          <View style={s.grid}>
            <Metric label="In Stock" value={`${selectedQty} ${selected.unit}`} />
            <Metric label="Unit Price" value={currency(selected.price)} />
            <Metric label="Cost Value" value={currency(selected.cost * selectedQty)} />
            <Metric label="Retail Value" value={currency(selected.price * selectedQty)} />
          </View>
          {selectedQty <= selected.reorderLevel ? (
            <Text style={s.reorder}>⚠ Below reorder level ({selected.reorderLevel})</Text>
          ) : null}
        </Card>
      ) : null}

      <Text style={s.section}>All Stock</Text>
      <Card style={{ padding: 0 }}>
        {products.items.map((p, idx) => {
          const qty = availableStock(p);
          const st = stockStatus(qty);
          return (
            <View key={p.id} style={[s.row, idx < products.items.length - 1 && s.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{p.name}</Text>
                <Text style={s.meta}>{p.sku}</Text>
              </View>
              <Text style={s.qty}>{qty}</Text>
              <Badge text={st.label} tone={st.tone} />
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metric}>
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { flexBasis: '48%', flexGrow: 1, backgroundColor: colors.bg, borderRadius: 10, padding: spacing.md },
  metricValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  metricLabel: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  reorder: { marginTop: spacing.md, color: colors.danger, fontWeight: '600' },
  section: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowName: { fontSize: 15, fontWeight: '600', color: colors.text },
  qty: { fontSize: 16, fontWeight: '700', color: colors.text, minWidth: 40, textAlign: 'right' },
});
