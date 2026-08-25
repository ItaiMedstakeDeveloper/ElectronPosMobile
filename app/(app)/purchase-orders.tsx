import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Button, Badge, FormModal, TextField, Select } from '@/components/ui';
import { colors, spacing, radius, currency } from '@/theme';
import { useData } from '@/context/DataContext';
import { notify } from '@/lib/confirm';
import { shareViaWhatsApp, shareViaEmail } from '@/lib/share';
import { LineItemsEditor, lineItemsTotal } from '@/components/LineItemsEditor';
import type { LineItem, PurchaseOrder } from '@/data/mockData';

const today = () => new Date().toISOString().slice(0, 10);

export default function PurchaseOrders() {
  const { purchaseOrders, suppliers, products, company, receivePurchaseOrder } = useData();
  const [modal, setModal] = useState(false);
  const [supplierId, setSupplierId] = useState<string | undefined>();
  const [date, setDate] = useState(today());
  const [expectedDate, setExpectedDate] = useState(today());
  const [paymentMethod, setPaymentMethod] = useState<PurchaseOrder['paymentMethod']>('Credit');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);

  // "Receive" (convert PO → GRV) modal state.
  const [receiveModal, setReceiveModal] = useState(false);
  const [receivePO, setReceivePO] = useState<PurchaseOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<LineItem[]>([]);
  const [receiveDate, setReceiveDate] = useState(today());
  const [receiveInvoice, setReceiveInvoice] = useState('');
  const [receiving, setReceiving] = useState(false);

  const supplierOf = (id: string) => suppliers.items.find((sp) => sp.id === id);
  const supplierName = (id: string) => supplierOf(id)?.name ?? 'Unknown';

  // Human-readable purchase order used as the WhatsApp / email message body.
  const buildMessage = (po: PurchaseOrder) => {
    const lines = po.items
      .map((it) => `• ${it.qty} x ${it.name} @ ${currency(it.unitCost)} = ${currency(it.qty * it.unitCost)}`)
      .join('\n');
    return [
      `*PURCHASE ORDER ${po.number}*`,
      company.name,
      '',
      `Supplier: ${supplierName(po.supplierId)}`,
      `Order Date: ${po.date}`,
      `Expected: ${po.expectedDate}`,
      `Payment: ${po.paymentMethod}`,
      po.invoiceNumber ? `Invoice #: ${po.invoiceNumber}` : null,
      '',
      'Items:',
      lines,
      '',
      `Total: ${currency(po.total)}`,
      '',
      `Regards,`,
      company.name,
      company.phone,
    ]
      .filter((l) => l !== null)
      .join('\n');
  };

  const shareWhatsApp = (po: PurchaseOrder) => {
    const supplier = supplierOf(po.supplierId);
    if (!supplier?.phone?.trim()) {
      notify(`No phone number on file for ${supplierName(po.supplierId)}. Add one on the supplier to send via WhatsApp.`);
      return;
    }
    // Sends the purchase order straight to the supplier's WhatsApp number.
    shareViaWhatsApp(buildMessage(po), supplier.phone);
  };

  const shareEmail = (po: PurchaseOrder) =>
    shareViaEmail(`Purchase Order ${po.number} — ${company.name}`, buildMessage(po));

  // Open the receive modal pre-filled from the PO's lines (quantities editable).
  const openReceive = (po: PurchaseOrder) => {
    setReceivePO(po);
    setReceiveItems(po.items.map((it) => ({ ...it })));
    setReceiveDate(today());
    setReceiveInvoice('');
    setReceiveModal(true);
  };

  const confirmReceive = async () => {
    if (!receivePO || receiving) return;
    if (receiveItems.length === 0) return notify('Add at least one item to receive.');
    if (receiveItems.some((it) => it.qty <= 0)) {
      return notify('Each received line needs a quantity greater than zero.');
    }
    setReceiving(true);
    try {
      await receivePurchaseOrder({
        po: receivePO,
        items: receiveItems,
        date: receiveDate,
        supplierInvoiceNumber: receiveInvoice.trim() || undefined,
      });
      setReceiveModal(false);
      setReceivePO(null);
      notify('Goods received. Stock updated and the purchase order marked received.');
    } finally {
      setReceiving(false);
    }
  };

  const openAdd = () => {
    setSupplierId(suppliers.items[0]?.id);
    setDate(today());
    setExpectedDate(today());
    setPaymentMethod('Credit');
    setInvoiceNumber('');
    setItems([]);
    setModal(true);
  };
  const save = () => {
    if (!supplierId) {
      notify('Please choose a supplier.');
      return;
    }
    if (items.length === 0) {
      notify('Please add at least one product to the purchase order.');
      return;
    }
    if (items.some((it) => it.qty <= 0)) {
      notify('Each line item needs a quantity greater than zero.');
      return;
    }
    purchaseOrders.add({
      number: `PO-${1000 + purchaseOrders.items.length + 1}`,
      supplierId,
      date,
      expectedDate,
      paymentMethod,
      invoiceNumber,
      items,
      total: lineItemsTotal(items),
    });
    setModal(false);
  };

  return (
    <Screen
      title="Purchase Orders"
      subtitle={`${purchaseOrders.items.length} orders`}
      action={<Button title="New" icon="add" onPress={openAdd} />}
    >
      {purchaseOrders.items.map((po) => {
        const received = po.status === 'received';
        return (
        <Card key={po.id}>
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.number}>{po.number || 'PO'}</Text>
              <Text style={s.meta}>
                {supplierName(po.supplierId)} · {po.date}
              </Text>
            </View>
            <View style={s.badges}>
              <Badge text={received ? 'Received' : 'Pending'} tone={received ? 'success' : 'accent'} />
              <Badge text={po.paymentMethod} tone="muted" />
            </View>
          </View>
          <View style={s.itemsBox}>
            {po.items.map((it) => (
              <View key={it.productId} style={s.itemRow}>
                <Text style={s.itemName}>
                  {it.qty} × {it.name}
                </Text>
                <Text style={s.itemPrice}>{currency(it.qty * it.unitCost)}</Text>
              </View>
            ))}
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Total · exp. {po.expectedDate}</Text>
            <Text style={s.totalValue}>{currency(po.total)}</Text>
          </View>
          {!received ? (
            <Pressable style={s.receiveBtn} onPress={() => openReceive(po)}>
              <Ionicons name="cube-outline" size={18} color="#fff" />
              <Text style={s.receiveText}>Receive (create GRV)</Text>
            </Pressable>
          ) : null}
          <View style={s.shareRow}>
            <Pressable style={[s.shareBtn, s.whatsappBtn]} onPress={() => shareWhatsApp(po)}>
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
              <Text style={s.shareText}>WhatsApp</Text>
            </Pressable>
            <Pressable style={[s.shareBtn, s.emailBtn]} onPress={() => shareEmail(po)}>
              <Ionicons name="mail-outline" size={18} color={colors.text} />
              <Text style={[s.shareText, { color: colors.text }]}>Email</Text>
            </Pressable>
          </View>
        </Card>
        );
      })}

      <FormModal
        visible={modal}
        title="Create Purchase Order"
        submitLabel="Create Order"
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
        <TextField label="Order Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <TextField label="Expected Date" value={expectedDate} onChangeText={setExpectedDate} placeholder="YYYY-MM-DD" />
        <Select
          label="Payment Method"
          value={paymentMethod}
          onChange={(v) => setPaymentMethod(v as PurchaseOrder['paymentMethod'])}
          options={[
            { label: 'Cash', value: 'Cash' },
            { label: 'Card', value: 'Card' },
            { label: 'Credit', value: 'Credit' },
          ]}
        />
        <TextField label="Supplier Invoice Number" value={invoiceNumber} onChangeText={setInvoiceNumber} />
        <LineItemsEditor items={items} onChange={setItems} products={products.items} priceField="cost" />
        <View style={s.grandRow}>
          <Text style={s.grandLabel}>Total</Text>
          <Text style={s.grandValue}>{currency(lineItemsTotal(items))}</Text>
        </View>
      </FormModal>

      <FormModal
        visible={receiveModal}
        title={`Receive ${receivePO?.number ?? 'PO'}`}
        submitLabel={receiving ? 'Receiving…' : 'Confirm & Create GRV'}
        onClose={() => setReceiveModal(false)}
        onSubmit={confirmReceive}
      >
        <Text style={s.receiveHint}>
          Confirm the quantities actually received. This creates a GRV, raises stock, and marks the
          order received.
        </Text>
        <TextField label="Received Date" value={receiveDate} onChangeText={setReceiveDate} placeholder="YYYY-MM-DD" />
        <TextField
          label="Supplier Invoice Number"
          value={receiveInvoice}
          onChangeText={setReceiveInvoice}
          placeholder="Optional"
        />
        <LineItemsEditor
          items={receiveItems}
          onChange={setReceiveItems}
          products={products.items}
          priceField="cost"
        />
        <View style={s.grandRow}>
          <Text style={s.grandLabel}>Total Received</Text>
          <Text style={s.grandValue}>{currency(lineItemsTotal(receiveItems))}</Text>
        </View>
      </FormModal>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badges: { alignItems: 'flex-end', gap: 4 },
  receiveHint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.sm },
  receiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
    marginTop: spacing.md,
  },
  receiveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
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
