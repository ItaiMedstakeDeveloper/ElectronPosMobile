import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Screen, Card, TextField } from '@/components/ui';
import { colors, spacing, radius, currency, toBaseUsd } from '@/theme';
import { useCart } from '@/context/CartContext';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { printReceipt } from '@/lib/printer';
import { notify } from '@/lib/confirm';
import type { ReceiptData } from '@/lib/receipt';

// A tinted thumbnail colour derived from the product id (stable per product),
// mirroring the Sell grid so the same product reads consistently in both places.
const TILE_COLORS = ['#e9edfc', '#fdeee0', '#e6f7f0', '#fbe9ef', '#eef1f5', '#e8f4fb'];
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
const tileColor = (id: string) => TILE_COLORS[Math.abs(hash(id)) % TILE_COLORS.length];

type PaymentMethod = 'Cash' | 'EcoCash';

export default function Checkout() {
  const { lines, setQty, remove, subtotal, clear, count } = useCart();
  const { recordSale, company, printer } = useData();
  const { user } = useAuth();
  const router = useRouter();
  const [lastSale, setLastSale] = useState<string | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const [payment, setPayment] = useState<PaymentMethod>('Cash');
  const [tendered, setTendered] = useState('');
  const [ecocashNumber, setEcocashNumber] = useState('');
  const [busy, setBusy] = useState(false);

  const total = subtotal;
  // `tendered` is typed in the DISPLAY currency (ZiG when selected); convert it
  // back to the USD base so all math and stored amounts stay in USD.
  const tenderedNum = toBaseUsd(parseFloat(tendered) || 0);
  const change = payment === 'Cash' && tendered.trim() ? Math.max(0, tenderedNum - total) : 0;

  const doCheckout = async () => {
    if (busy || count === 0) return;
    if (payment === 'Cash' && tendered.trim() && tenderedNum < total) {
      return notify('Amount tendered is less than the total.');
    }
    if (payment === 'EcoCash' && !ecocashNumber.trim()) {
      return notify('Enter the EcoCash number to complete this payment.');
    }

    const amountPaid = payment === 'Cash' ? (tendered.trim() ? tenderedNum : total) : total;
    const changeDue = payment === 'Cash' ? Math.max(0, amountPaid - total) : 0;
    const paymentRef = payment === 'EcoCash' ? ecocashNumber.trim() : null;

    setBusy(true);
    try {
      const saleId = await recordSale({
        subtotal,
        tax: 0,
        total,
        amountPaid,
        change: changeDue,
        paymentMethod: payment,
        userId: user?.id ?? null,
        userName: user?.name ?? null,
        customerId: null,
        items: lines.map((l) => ({
          productId: l.product.id,
          name: l.product.name,
          categoryId: l.product.categoryId,
          qty: l.qty,
          unitPrice: l.product.price,
        })),
      });
      const receiptNo = 'INV-' + saleId;
      const receipt: ReceiptData = {
        receiptNo,
        dateTime: new Date().toLocaleString(),
        cashier: user?.name ?? null,
        company: {
          name: company.name,
          address: company.address,
          phone: company.phone,
          tin: company.tin,
          vat: company.vat,
        },
        items: lines.map((l) => ({ name: l.product.name, qty: l.qty, unitPrice: l.product.price })),
        subtotal,
        tax: 0,
        total,
        amountPaid,
        change: changeDue,
        paymentMethod: payment,
        paymentRef,
      };
      setLastSale(receiptNo);
      setLastReceipt(receipt);
      clear();
      setTendered('');
      setEcocashNumber('');
      await printReceipt(receipt, printer.deviceId);
      router.replace('/cart');
    } finally {
      setBusy(false);
    }
  };

  if (count === 0) {
    return (
      <Screen title="Checkout">
        {lastSale ? (
          <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
            <Text style={s.doneTitle}>Sale completed</Text>
            <Text style={s.doneMeta}>Receipt {lastSale} recorded.</Text>
            {lastReceipt ? (
              <Pressable style={s.reprintBtn} onPress={() => printReceipt(lastReceipt, printer.deviceId)}>
                <Ionicons name="print-outline" size={18} color={colors.primary} />
                <Text style={s.reprintText}>Print Receipt</Text>
              </Pressable>
            ) : null}
            <Link href="/cart" asChild>
              <Pressable style={s.primaryBtn}>
                <Text style={s.primaryBtnText}>New Sale</Text>
              </Pressable>
            </Link>
          </Card>
        ) : (
          <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl }}>
            <Ionicons name="cart-outline" size={48} color={colors.textMuted} />
            <Text style={s.doneTitle}>Nothing to check out</Text>
            <Link href="/cart" asChild>
              <Pressable style={s.primaryBtn}>
                <Text style={s.primaryBtnText}>Back to Sell</Text>
              </Pressable>
            </Link>
          </Card>
        )}
      </Screen>
    );
  }

  return (
    <Screen title="Checkout" subtitle={`${count} item${count === 1 ? '' : 's'} · ${currency(total)}`}>
      {/* Line items */}
      <Card style={{ padding: 0 }}>
        {lines.map((l, idx) => (
          <View key={l.product.id} style={[s.item, idx < lines.length - 1 && s.divider]}>
            <View style={s.itemRow}>
              {/* Product thumbnail: tinted box with the product's initial. */}
              <View style={[s.thumb, { backgroundColor: tileColor(l.product.id) }]}>
                <Text style={s.thumbText}>{l.product.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={s.itemBody}>
                <View style={s.itemTop}>
                  <Text style={s.name}>{l.product.name}</Text>
                  <Text style={s.lineTotal}>{currency(l.qty * l.product.price)}</Text>
                  <Pressable onPress={() => remove(l.product.id)} style={s.removeBtn} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
                <View style={s.itemBottom}>
                  <Text style={s.meta}>{currency(l.product.price)} each</Text>
                  <View style={{ flex: 1 }} />
                  <View style={s.stepper}>
                    <Pressable style={s.stepBtn} onPress={() => setQty(l.product.id, l.qty - 1)} hitSlop={6}>
                      <Ionicons name="remove" size={18} color={colors.text} />
                    </Pressable>
                    <Text style={s.qty}>{l.qty}</Text>
                    <Pressable style={s.stepBtn} onPress={() => setQty(l.product.id, l.qty + 1)} hitSlop={6}>
                      <Ionicons name="add" size={18} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </View>
        ))}
      </Card>

      {/* Payment */}
      <Card>
        <Text style={s.payTitle}>Payment Method</Text>
        <View style={s.segment}>
          <PayButton label="Cash" icon="cash-outline" active={payment === 'Cash'} onPress={() => setPayment('Cash')} />
          {/* EcoCash disabled for now — uncomment to re-enable the option. */}
          {/* <PayButton
            label="EcoCash"
            icon="phone-portrait-outline"
            active={payment === 'EcoCash'}
            onPress={() => setPayment('EcoCash')}
          /> */}
        </View>

        {payment === 'Cash' ? (
          <View style={s.payCard}>
            <TextField
              label="Amount Tendered"
              value={tendered}
              onChangeText={(v) => setTendered(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder={currency(total)}
            />
            <View style={s.changeRow}>
              <Text style={s.changeLabel}>Change</Text>
              <Text style={s.changeValue}>{currency(change)}</Text>
            </View>
          </View>
        ) : (
          <View style={s.payCard}>
            <TextField
              label="EcoCash Number"
              value={ecocashNumber}
              onChangeText={(v) => setEcocashNumber(v.replace(/[^0-9+]/g, ''))}
              keyboardType="phone-pad"
              placeholder="+263 77 123 4567"
            />
          </View>
        )}

        <SummaryRow label="Subtotal" value={currency(subtotal)} />
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>{currency(total)}</Text>
        </View>
        <View style={s.actions}>
          <Pressable style={s.secondaryBtn} onPress={clear} disabled={busy}>
            <Text style={s.secondaryBtnText}>Clear</Text>
          </Pressable>
          <Pressable style={[s.checkoutBtn, busy && { opacity: 0.6 }]} onPress={doCheckout} disabled={busy}>
            <Ionicons name="card-outline" size={18} color="#2b2b2b" />
            <Text style={s.checkoutText}>{busy ? 'Processing…' : `Charge ${currency(total)}`}</Text>
          </Pressable>
        </View>
      </Card>
    </Screen>
  );
}

function PayButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[s.payBtn, active && s.payBtnActive]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={active ? colors.primary : colors.textMuted} />
      <Text style={[s.payBtnText, active && s.payBtnTextActive]}>{label}</Text>
    </Pressable>
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
  item: { padding: spacing.md, gap: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  itemBody: { flex: 1, gap: 8 },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbText: { fontSize: 20, fontWeight: '800', color: colors.text, opacity: 0.55 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  itemBottom: { flexDirection: 'row', alignItems: 'center' },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  qty: { minWidth: 28, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text },
  lineTotal: { fontSize: 15, fontWeight: '700', color: colors.text },
  removeBtn: { padding: 2 },

  payTitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginBottom: spacing.sm },
  segment: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  payBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  payBtnActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  payBtnText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  payBtnTextActive: { color: colors.primary },
  payCard: { backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.md },
  changeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  changeLabel: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  changeValue: { fontSize: 16, fontWeight: '800', color: colors.success },

  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  sumLabel: { color: colors.textMuted, fontSize: 15 },
  sumValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontSize: 18, fontWeight: '700', color: colors.text },
  totalValue: { fontSize: 20, fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  secondaryBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  secondaryBtnText: { color: colors.text, fontWeight: '600' },
  checkoutBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: radius.md, backgroundColor: colors.accent },
  checkoutText: { color: '#2b2b2b', fontWeight: '800', fontSize: 15 },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 11, borderRadius: radius.md, marginTop: spacing.sm },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  doneTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  doneMeta: { fontSize: 14, color: colors.textMuted },
  reprintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  reprintText: { color: colors.primary, fontWeight: '700' },
});
