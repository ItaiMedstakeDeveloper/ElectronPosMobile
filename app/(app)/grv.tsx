import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Screen, Card, Button, Badge, FormModal, TextField, Select } from '@/components/ui';
import { colors, spacing, currency } from '@/theme';
import { useData } from '@/context/DataContext';
import { notify } from '@/lib/confirm';
import { LineItemsEditor, lineItemsTotal } from '@/components/LineItemsEditor';
import type { LineItem, GRV as GRVType } from '@/data/mockData';

const today = () => new Date().toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(4, '0');

export default function GRV() {
  const { grvs, suppliers, products } = useData();
  const [modal, setModal] = useState(false);
  const [supplierId, setSupplierId] = useState<string | undefined>();
  const [date, setDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState<GRVType['paymentMethod']>('Credit');
  const [items, setItems] = useState<LineItem[]>([]);

  const supplierName = (id: string) => suppliers.items.find((sp) => sp.id === id)?.name ?? 'Unknown';

  const openAdd = () => {
    setSupplierId(suppliers.items[0]?.id);
    setDate(today());
    setPaymentMethod('Credit');
    setItems([]);
    setModal(true);
  };
  const save = () => {
    if (!supplierId) {
      notify('Please choose a supplier.');
      return;
    }
    if (items.length === 0) {
      notify('Please add at least one product to the GRV.');
      return;
    }
    if (items.some((it) => it.qty <= 0)) {
      notify('Each line item needs a quantity greater than zero.');
      return;
    }
    grvs.add({
      number: `GRN-${pad(grvs.items.length + 1)}`,
      supplierId,
      date,
      paymentMethod,
      items,
      total: lineItemsTotal(items),
    });
    setModal(false);
  };

  return (
    <Screen
      title="Goods Received Vouchers"
      subtitle={`${grvs.items.length} vouchers`}
      action={<Button title="New" icon="add" onPress={openAdd} />}
    >
      {grvs.items.map((g) => (
        <Card key={g.id}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.number}>{g.number}</Text>
              <Text style={s.meta}>
                {supplierName(g.supplierId)} · {g.date}
              </Text>
            </View>
            <Badge text={g.paymentMethod} tone="muted" />
          </View>
          <View style={s.itemsBox}>
            {g.items.map((it) => (
              <View key={it.productId} style={s.itemRow}>
                <Text style={s.itemName}>
                  {it.qty} × {it.name}
                </Text>
                <Text style={s.itemPrice}>{currency(it.qty * it.unitCost)}</Text>
              </View>
            ))}
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{currency(g.total)}</Text>
          </View>
        </Card>
      ))}

      <FormModal
        visible={modal}
        title="Create GRV"
        submitLabel="Create GRV"
        onClose={() => setModal(false)}
        onSubmit={save}
      >
        <Select
          label="Supplier"
          value={supplierId}
          onChange={setSupplierId}
          placeholder="Choose supplier…"
          options={suppliers.items.map((sp) => ({ label: sp.name, value: sp.id }))}
        />
        <TextField label="GRV Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <Select
          label="Payment Method"
          value={paymentMethod}
          onChange={(v) => setPaymentMethod(v as GRVType['paymentMethod'])}
          options={[
            { label: 'Cash', value: 'Cash' },
            { label: 'Card', value: 'Card' },
            { label: 'Credit', value: 'Credit' },
          ]}
        />
        <LineItemsEditor items={items} onChange={setItems} products={products.items} priceField="cost" />
        <View style={s.grandRow}>
          <Text style={s.grandLabel}>Total</Text>
          <Text style={s.grandValue}>{currency(lineItemsTotal(items))}</Text>
        </View>
      </FormModal>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  number: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  itemsBox: { marginTop: spacing.md, gap: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 14, color: colors.text },
  itemPrice: { fontSize: 14, color: colors.textMuted },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 13, color: colors.textMuted },
  totalValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  grandLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  grandValue: { fontSize: 18, fontWeight: '800', color: colors.text },
});
