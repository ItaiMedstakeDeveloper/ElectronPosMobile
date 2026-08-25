import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Button, FormModal, TextField, Select } from '@/components/ui';
import { colors, spacing, radius, currency } from '@/theme';
import { useData } from '@/context/DataContext';
import { notify } from '@/lib/confirm';
import { shareViaWhatsApp, shareViaEmail } from '@/lib/share';
import { LineItemsEditor, lineItemsTotal } from '@/components/LineItemsEditor';
import type { LineItem, Quote } from '@/data/mockData';

const today = () => new Date().toISOString().slice(0, 10);

export default function QuoteCustomers() {
  const { quotes, customers, products, tax, company } = useData();
  const [modal, setModal] = useState(false);
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [date, setDate] = useState(today());
  const [items, setItems] = useState<LineItem[]>([]);

  const customerOf = (id: string) => customers.items.find((c) => c.id === id);
  const customerName = (id: string) => customerOf(id)?.name ?? 'Unknown';

  // Human-readable quotation used as the WhatsApp / email message body.
  const buildMessage = (q: Quote) => {
    const lines = q.items
      .map((it) => `• ${it.qty} x ${it.name} @ ${currency(it.unitCost)} = ${currency(it.qty * it.unitCost)}`)
      .join('\n');
    return [
      `*QUOTATION ${q.number}*`,
      company.name,
      '',
      `Customer: ${customerName(q.customerId)}`,
      `Date: ${q.date}`,
      '',
      'Items:',
      lines,
      '',
      `Subtotal: ${currency(q.subtotal)}`,
      `Tax: ${currency(q.tax)}`,
      `Total: ${currency(q.total)}`,
      '',
      'Regards,',
      company.name,
      company.phone,
    ].join('\n');
  };

  const shareWhatsApp = (q: Quote) => {
    const customer = customerOf(q.customerId);
    if (!customer?.phone?.trim() || customer.phone.trim() === '-') {
      notify(`No phone number on file for ${customerName(q.customerId)}. Add one on the customer to send via WhatsApp.`);
      return;
    }
    // Sends the quotation straight to the customer's WhatsApp number.
    shareViaWhatsApp(buildMessage(q), customer.phone);
  };

  const shareEmail = (q: Quote) => {
    const customer = customerOf(q.customerId);
    const to = customer?.email && customer.email !== '-' ? customer.email : undefined;
    shareViaEmail(`Quotation ${q.number} — ${company.name}`, buildMessage(q), to);
  };

  const subtotal = lineItemsTotal(items);
  const taxAmount = (subtotal * tax) / 100;
  const total = subtotal + taxAmount;

  const openAdd = () => {
    setCustomerId(customers.items[0]?.id);
    setDate(today());
    setItems([]);
    setModal(true);
  };
  const save = () => {
    if (!customerId || items.length === 0) return;
    quotes.add({
      number: `CQ-${1000 + quotes.items.length + 1}`,
      customerId,
      date,
      items,
      subtotal,
      tax: taxAmount,
      total,
    });
    setModal(false);
  };

  return (
    <Screen
      title="Quote Customers"
      subtitle={`${quotes.items.length} quotations`}
      action={<Button title="New" icon="add" onPress={openAdd} />}
    >
      {quotes.items.map((q) => (
        <Card key={q.id}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.number}>{q.number}</Text>
              <Text style={s.meta}>
                {customerName(q.customerId)} · {q.date}
              </Text>
            </View>
            <Text style={s.total}>{currency(q.total)}</Text>
          </View>
          <View style={s.itemsBox}>
            {q.items.map((it) => (
              <View key={it.productId} style={s.itemRow}>
                <Text style={s.itemName}>
                  {it.qty} × {it.name}
                </Text>
                <Text style={s.itemPrice}>{currency(it.qty * it.unitCost)}</Text>
              </View>
            ))}
          </View>
          <View style={s.shareRow}>
            <Pressable style={[s.shareBtn, s.whatsappBtn]} onPress={() => shareWhatsApp(q)}>
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
              <Text style={s.shareText}>WhatsApp</Text>
            </Pressable>
            <Pressable style={[s.shareBtn, s.emailBtn]} onPress={() => shareEmail(q)}>
              <Ionicons name="mail-outline" size={18} color={colors.text} />
              <Text style={[s.shareText, { color: colors.text }]}>Email</Text>
            </Pressable>
          </View>
        </Card>
      ))}

      <FormModal
        visible={modal}
        title="Create Quote"
        submitLabel="Save Quote"
        onClose={() => setModal(false)}
        onSubmit={save}
      >
        <Select
          label="Customer"
          value={customerId}
          onChange={setCustomerId}
          placeholder="Choose customer…"
          options={customers.items.map((c) => ({ label: c.name, value: c.id }))}
        />
        <TextField label="Quote Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <LineItemsEditor items={items} onChange={setItems} products={products.items} priceField="price" />
        <View style={s.summary}>
          <SummaryRow label="Subtotal" value={currency(subtotal)} />
          <SummaryRow label={`Tax (${tax}%)`} value={currency(taxAmount)} />
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>Total</Text>
            <Text style={s.grandValue}>{currency(total)}</Text>
          </View>
        </View>
      </FormModal>
    </Screen>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.sumRow}>
      <Text style={s.sumLabel}>{label}</Text>
      <Text style={s.sumValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  number: { fontSize: 16, fontWeight: '700', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  total: { fontSize: 17, fontWeight: '800', color: colors.text },
  itemsBox: { marginTop: spacing.md, gap: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { fontSize: 14, color: colors.text },
  itemPrice: { fontSize: 14, color: colors.textMuted },
  summary: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  sumLabel: { color: colors.textMuted, fontSize: 14 },
  sumValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  grandRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm, marginTop: 4, borderTopWidth: 1, borderTopColor: colors.border },
  grandLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  grandValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  shareRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  whatsappBtn: { backgroundColor: '#25D366' },
  emailBtn: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg },
  shareText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
