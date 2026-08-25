import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, Button } from '@/components/ui';
import { colors, spacing, radius, currency } from '@/theme';
import { useData } from '@/context/DataContext';
import * as db from '@/db/db';
import { exportPdf, reportDocument, escapeHtml } from '@/lib/pdf';

type Period = 'today' | 'week' | 'month';

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function Reports() {
  const { company, tax: taxRate } = useData();
  const [period, setPeriod] = useState<Period>('today');

  const [valuation, setValuation] = useState<db.InventoryValuation | null>(null);
  const [stock, setStock] = useState<db.StockRow[]>([]);
  const [byProduct, setByProduct] = useState<{ rows: db.SalesByProductRow[]; totalQty: number; totalRevenue: number } | null>(null);
  const [taxReport, setTaxReport] = useState<db.TaxReport | null>(null);
  const [zReport, setZReport] = useState<db.ZReport | null>(null);

  const today = iso(new Date());
  const range = (() => {
    if (period === 'today') return { from: today, to: today, label: 'Today' };
    if (period === 'week') return { from: iso(new Date(Date.now() - 6 * 86400000)), to: today, label: 'Last 7 days' };
    return { from: `${today.slice(0, 7)}-01`, to: today, label: 'This month' };
  })();

  const load = useCallback(async () => {
    const [v, s, bp, tr, z] = await Promise.all([
      db.getInventoryValuation(),
      db.getStockReport(),
      db.getSalesByProduct(range.from, range.to),
      db.getTaxReport(range.from, range.to),
      db.getZReport(today),
    ]);
    setValuation(v);
    setStock(s);
    setByProduct(bp);
    setTaxReport(tr);
    setZReport(z);
  }, [range.from, range.to, today]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const doc = (title: string, subtitle: string, body: string) =>
    reportDocument({ companyName: company.name, companyPhone: company.phone, title, subtitle, body });

  const lowCount = stock.filter((r) => r.low).length;

  // ---- PDF builders ----
  const downloadValuation = () => {
    if (!valuation) return;
    const rows = valuation.rows
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.sku)}</td>` +
          `<td class="r">${r.qty}</td><td class="r">${currency(r.cost)}</td>` +
          `<td class="r">${currency(r.costValue)}</td></tr>`
      )
      .join('');
    const body = `
      <div class="kpis">
        <div class="kpi"><div class="label">Total Cost Value</div><div class="value">${currency(valuation.totalCost)}</div></div>
        <div class="kpi"><div class="label">Total Retail Value</div><div class="value">${currency(valuation.totalRetail)}</div></div>
      </div>
      <table><thead><tr><th>Product</th><th>SKU</th><th class="r">Qty</th><th class="r">Unit Cost</th><th class="r">Value</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4" class="r">Total</td><td class="r">${currency(valuation.totalCost)}</td></tr></tfoot></table>`;
    exportPdf(doc('Inventory Valuation', `As at ${today}`, body));
  };

  const downloadStock = () => {
    const rows = stock
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.sku)}</td>` +
          `<td class="r">${r.qty}</td><td class="r">${r.reorderLevel}</td>` +
          `<td>${r.low ? 'REORDER' : 'OK'}</td></tr>`
      )
      .join('');
    const body = `
      <div class="kpis">
        <div class="kpi"><div class="label">Products</div><div class="value">${stock.length}</div></div>
        <div class="kpi"><div class="label">Need Reorder</div><div class="value">${lowCount}</div></div>
      </div>
      <table><thead><tr><th>Product</th><th>SKU</th><th class="r">On Hand</th><th class="r">Reorder Lvl</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
    exportPdf(doc('Stock & Reorder Report', `As at ${today}`, body));
  };

  const downloadByProduct = () => {
    if (!byProduct) return;
    const rows = byProduct.rows
      .map(
        (r) => `<tr><td>${escapeHtml(r.name)}</td><td class="r">${r.qty}</td><td class="r">${currency(r.revenue)}</td></tr>`
      )
      .join('');
    const body = `
      <table><thead><tr><th>Product</th><th class="r">Units Sold</th><th class="r">Revenue</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3">No sales in this period.</td></tr>'}</tbody>
      <tfoot><tr><td class="r">Total</td><td class="r">${byProduct.totalQty}</td><td class="r">${currency(byProduct.totalRevenue)}</td></tr></tfoot></table>`;
    exportPdf(doc('Sales by Product', `${range.label} · ${range.from} to ${range.to}`, body));
  };

  const downloadTax = () => {
    if (!taxReport) return;
    const body = `
      <div class="kpis">
        <div class="kpi"><div class="label">Transactions</div><div class="value">${taxReport.transactions}</div></div>
        <div class="kpi"><div class="label">Net Sales</div><div class="value">${currency(taxReport.net)}</div></div>
        <div class="kpi"><div class="label">VAT (${taxRate}%)</div><div class="value">${currency(taxReport.tax)}</div></div>
        <div class="kpi"><div class="label">Gross Sales</div><div class="value">${currency(taxReport.gross)}</div></div>
      </div>`;
    exportPdf(doc('Tax (VAT) Report', `${range.label} · ${range.from} to ${range.to}`, body));
  };

  const downloadZ = () => {
    if (!zReport) return;
    const pay = zReport.byPayment
      .map((p) => `<tr><td>${escapeHtml(p.method)}</td><td class="r">${p.count}</td><td class="r">${currency(p.total)}</td></tr>`)
      .join('');
    const cash = zReport.byCashier
      .map((c) => `<tr><td>${escapeHtml(c.name)}</td><td class="r">${c.count}</td><td class="r">${currency(c.total)}</td></tr>`)
      .join('');
    const body = `
      <div class="kpis">
        <div class="kpi"><div class="label">Transactions</div><div class="value">${zReport.transactions}</div></div>
        <div class="kpi"><div class="label">Net</div><div class="value">${currency(zReport.net)}</div></div>
        <div class="kpi"><div class="label">VAT</div><div class="value">${currency(zReport.tax)}</div></div>
        <div class="kpi"><div class="label">Gross</div><div class="value">${currency(zReport.gross)}</div></div>
      </div>
      <h3>By Payment Method</h3>
      <table><thead><tr><th>Method</th><th class="r">Count</th><th class="r">Total</th></tr></thead>
      <tbody>${pay || '<tr><td colspan="3">No sales today.</td></tr>'}</tbody></table>
      <h3>By Cashier</h3>
      <table><thead><tr><th>Cashier</th><th class="r">Count</th><th class="r">Total</th></tr></thead>
      <tbody>${cash || '<tr><td colspan="3">No sales today.</td></tr>'}</tbody></table>`;
    exportPdf(doc('Z-Report (End of Day)', today, body));
  };

  return (
    <Screen title="Reports" subtitle="Generate and download PDF reports">
      <Text style={s.section}>Sales period</Text>
      <View style={s.periodRow}>
        {(['today', 'week', 'month'] as Period[]).map((p) => (
          <Pressable
            key={p}
            style={[s.chip, period === p && s.chipActive]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[s.chipText, period === p && s.chipTextActive]}>
              {p === 'today' ? 'Today' : p === 'week' ? 'Last 7 days' : 'This month'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ReportCard
        icon="cash-outline"
        title="Z-Report (End of Day)"
        summary={zReport ? `${zReport.transactions} sales · ${currency(zReport.gross)} gross · today` : 'Loading…'}
        onDownload={downloadZ}
      />
      <ReportCard
        icon="bar-chart-outline"
        title="Sales by Product"
        summary={byProduct ? `${byProduct.totalQty} units · ${currency(byProduct.totalRevenue)} · ${range.label}` : 'Loading…'}
        onDownload={downloadByProduct}
      />
      <ReportCard
        icon="receipt-outline"
        title="Tax (VAT) Report"
        summary={taxReport ? `VAT ${currency(taxReport.tax)} on ${currency(taxReport.net)} net · ${range.label}` : 'Loading…'}
        onDownload={downloadTax}
      />
      <ReportCard
        icon="cube-outline"
        title="Inventory Valuation"
        summary={valuation ? `${valuation.rows.length} products · ${currency(valuation.totalCost)} at cost` : 'Loading…'}
        onDownload={downloadValuation}
      />
      <ReportCard
        icon="alert-circle-outline"
        title="Stock & Reorder"
        summary={`${stock.length} products · ${lowCount} need reorder`}
        onDownload={downloadStock}
      />
    </Screen>
  );
}

function ReportCard({
  icon,
  title,
  summary,
  onDownload,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  summary: string;
  onDownload: () => void;
}) {
  return (
    <Card>
      <View style={s.cardHead}>
        <View style={s.iconWrap}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>{title}</Text>
          <Text style={s.cardSummary}>{summary}</Text>
        </View>
      </View>
      <Button title="Download PDF" icon="download-outline" variant="outline" onPress={onDownload} />
    </Card>
  );
}

const s = StyleSheet.create({
  section: { fontSize: 14, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  cardSummary: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
