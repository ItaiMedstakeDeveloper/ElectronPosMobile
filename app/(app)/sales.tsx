import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Badge } from '@/components/ui';
import { colors, spacing, radius, currency } from '@/theme';
import { useData } from '@/context/DataContext';
import { confirmAction } from '@/lib/confirm';
import { printReceipt } from '@/lib/printer';
import type { ReceiptData } from '@/lib/receipt';
import type { SaleRecord } from '@/db/db';

type PeriodKey = 'today' | 'yesterday' | 'last7' | 'month' | 'all';

const PERIODS: { key: PeriodKey; label: string; icon: any }[] = [
  { key: 'today', label: 'Today', icon: 'today-outline' },
  { key: 'yesterday', label: 'Yesterday', icon: 'arrow-back-outline' },
  { key: 'last7', label: 'Last 7 days', icon: 'calendar-outline' },
  { key: 'month', label: 'This month', icon: 'calendar-number-outline' },
  { key: 'all', label: 'All time', icon: 'infinite-outline' },
];

// Date prefixes (yyyy-mm-dd) computed in UTC to match how sales.created_at is
// stored (new Date().toISOString()). Returns [from, to] or null for "all time".
function rangeFor(key: PeriodKey): [string, string] | null {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const now = new Date();
  const today = iso(now);
  switch (key) {
    case 'today':
      return [today, today];
    case 'yesterday': {
      const y = new Date(now);
      y.setUTCDate(y.getUTCDate() - 1);
      return [iso(y), iso(y)];
    }
    case 'last7': {
      const s = new Date(now);
      s.setUTCDate(s.getUTCDate() - 6);
      return [iso(s), today];
    }
    case 'month': {
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      return [iso(first), today];
    }
    case 'all':
    default:
      return null;
  }
}

export default function Sales() {
  const { listSales, reverseSale, company, printer } = useData();
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? 'Today';

  const load = useCallback(async () => {
    setLoading(true);
    const range = rangeFor(period);
    const rows = range ? await listSales(range[0], range[1]) : await listSales();
    setSales(rows);
    setLoading(false);
  }, [period, listSales]);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(() => {
    const active = sales.filter((s) => !s.reversed);
    return {
      count: active.length,
      revenue: active.reduce((n, s) => n + s.total, 0),
    };
  }, [sales]);

  const doReprint = async (sale: SaleRecord) => {
    const receipt: ReceiptData = {
      receiptNo: 'INV-' + sale.id,
      dateTime: new Date(sale.createdAt).toLocaleString(),
      cashier: sale.userName,
      company: {
        name: company.name,
        address: company.address,
        phone: company.phone,
        tin: company.tin,
        vat: company.vat,
      },
      items: sale.items.map((i) => ({ name: i.name, qty: i.qty, unitPrice: i.unitPrice })),
      subtotal: sale.subtotal,
      tax: sale.tax,
      total: sale.total,
      amountPaid: sale.amountPaid,
      change: sale.change,
      paymentMethod: sale.paymentMethod,
    };
    setBusyId(sale.id);
    try {
      await printReceipt(receipt, printer.deviceId);
    } finally {
      setBusyId(null);
    }
  };

  const doReverse = (sale: SaleRecord) => {
    confirmAction(
      `Reverse sale INV-${sale.id} for ${currency(sale.total)}? Its items return to stock and it is removed from reports.`,
      async () => {
        setBusyId(sale.id);
        try {
          await reverseSale(sale.id);
          await load();
        } finally {
          setBusyId(null);
        }
      }
    );
  };

  return (
    <Screen
      title="Sales"
      subtitle={`${totals.count} sale${totals.count === 1 ? '' : 's'} · ${currency(totals.revenue)}`}
      action={
        <Pressable style={s.periodBtn} onPress={() => setPickerOpen(true)}>
          <Ionicons name="funnel-outline" size={16} color={colors.primary} />
          <Text style={s.periodBtnText}>{periodLabel}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.primary} />
        </Pressable>
      }
    >
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : sales.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="receipt-outline" size={44} color={colors.textMuted} />
          <Text style={s.emptyText}>No sales for {periodLabel.toLowerCase()}.</Text>
        </View>
      ) : (
        sales.map((sale) => {
          const open = expandedId === sale.id;
          const itemCount = sale.items.reduce((n, i) => n + i.qty, 0);
          return (
            <Card key={sale.id} style={{ padding: 0, opacity: sale.reversed ? 0.7 : 1 }}>
              {/* Summary row */}
              <Pressable
                style={s.row}
                onPress={() => setExpandedId(open ? null : sale.id)}
              >
                <View style={s.rowIcon}>
                  <Ionicons
                    name={sale.paymentMethod === 'EcoCash' ? 'phone-portrait-outline' : 'cash-outline'}
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.rowTitleLine}>
                    <Text style={s.rowTitle}>INV-{sale.id}</Text>
                    {sale.reversed ? <Badge text="Reversed" tone="danger" /> : null}
                  </View>
                  <Text style={s.rowMeta}>
                    {new Date(sale.createdAt).toLocaleString()} · {itemCount} item{itemCount === 1 ? '' : 's'} · {sale.paymentMethod}
                  </Text>
                </View>
                <Text style={[s.rowTotal, sale.reversed && s.strike]}>{currency(sale.total)}</Text>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
              </Pressable>

              {/* Expanded detail */}
              {open ? (
                <View style={s.detail}>
                  {sale.items.map((it, idx) => (
                    <View key={idx} style={s.itemRow}>
                      <Text style={s.itemQty}>{it.qty}×</Text>
                      <Text style={s.itemName} numberOfLines={1}>{it.name}</Text>
                      <Text style={s.itemAmt}>{currency(it.lineTotal)}</Text>
                    </View>
                  ))}

                  <View style={s.sep} />
                  <DetailLine label="Subtotal" value={currency(sale.subtotal)} />
                  <DetailLine label="Total" value={currency(sale.total)} strong />
                  <DetailLine label={`Paid (${sale.paymentMethod})`} value={currency(sale.amountPaid)} />
                  <DetailLine label="Change" value={currency(sale.change)} />
                  {sale.userName ? <DetailLine label="Cashier" value={sale.userName} /> : null}
                  <DetailLine label="Date" value={new Date(sale.createdAt).toLocaleString()} />

                  <View style={s.actions}>
                    <Pressable
                      style={[s.actionBtn, s.reverseBtn, (sale.reversed || busyId === sale.id) && s.disabled]}
                      disabled={sale.reversed || busyId === sale.id}
                      onPress={() => doReverse(sale)}
                    >
                      <Ionicons name="return-down-back-outline" size={18} color={sale.reversed ? colors.textMuted : colors.danger} />
                      <Text style={[s.reverseText, sale.reversed && { color: colors.textMuted }]}>
                        {sale.reversed ? 'Reversed' : 'Reverse'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[s.actionBtn, s.reprintBtn, busyId === sale.id && s.disabled]}
                      disabled={busyId === sale.id}
                      onPress={() => doReprint(sale)}
                    >
                      <Ionicons name="print-outline" size={18} color="#fff" />
                      <Text style={s.reprintText}>{busyId === sale.id ? 'Working…' : 'Reprint'}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })
      )}

      {/* Period picker bottom drawer */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setPickerOpen(false)}>
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <Text style={s.sheetTitle}>Select period</Text>
            {PERIODS.map((p) => {
              const active = p.key === period;
              return (
                <Pressable
                  key={p.key}
                  style={[s.option, active && s.optionActive]}
                  onPress={() => {
                    setPeriod(p.key);
                    setExpandedId(null);
                    setPickerOpen(false);
                  }}
                >
                  <Ionicons name={p.icon} size={20} color={active ? colors.primary : colors.textMuted} />
                  <Text style={[s.optionText, active && s.optionTextActive]}>{p.label}</Text>
                  {active ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function DetailLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={s.detailLine}>
      <Text style={[s.detailLabel, strong && s.detailStrong]}>{label}</Text>
      <Text style={[s.detailValue, strong && s.detailStrong]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  periodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  periodBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },

  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyText: { color: colors.textMuted, fontSize: 15 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowTotal: { fontSize: 16, fontWeight: '800', color: colors.text },
  strike: { textDecorationLine: 'line-through', color: colors.textMuted },

  detail: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: 4,
    backgroundColor: colors.bg,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 2 },
  itemQty: { fontSize: 13, fontWeight: '700', color: colors.textMuted, minWidth: 30 },
  itemName: { flex: 1, fontSize: 14, color: colors.text },
  itemAmt: { fontSize: 14, fontWeight: '600', color: colors.text },
  sep: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  detailLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  detailLabel: { fontSize: 14, color: colors.textMuted },
  detailValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  detailStrong: { fontSize: 16, fontWeight: '800', color: colors.text },

  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  reverseBtn: { borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.surface },
  reverseText: { color: colors.danger, fontWeight: '700', fontSize: 14 },
  reprintBtn: { backgroundColor: colors.primary },
  reprintText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  disabled: { opacity: 0.5 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.sm },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  optionActive: { backgroundColor: colors.primarySoft },
  optionText: { flex: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  optionTextActive: { color: colors.primary, fontWeight: '800' },
});
