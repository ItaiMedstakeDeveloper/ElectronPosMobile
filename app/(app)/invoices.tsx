import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Card, Badge } from '@/components/ui';
import { colors, spacing, currency } from '@/theme';
import { invoices } from '@/data/mockData';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function Invoices() {
  return (
    <Screen title="Invoices" subtitle={`${invoices.length} invoices`}>
      {invoices.map((inv) => (
        <Card key={inv.id}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.number}>{inv.number}</Text>
              <Text style={s.meta}>{inv.customerName} · {fmtDate(inv.date)}</Text>
            </View>
            <Badge text={inv.status} tone={inv.status === 'paid' ? 'success' : inv.status === 'quote' ? 'muted' : 'danger'} />
          </View>
          <View style={s.items}>
            {inv.items.map((it) => (
              <View key={it.productId} style={s.itemRow}>
                <Text style={s.itemName}>{it.qty} × {it.name}</Text>
                <Text style={s.itemPrice}>{currency(it.qty * it.price)}</Text>
              </View>
            ))}
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{currency(inv.total)}</Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  number: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  items: { marginTop: spacing.md, gap: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 14, color: colors.text },
  itemPrice: { fontSize: 14, color: colors.textMuted },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  totalValue: { fontSize: 17, fontWeight: '800', color: colors.text },
});
