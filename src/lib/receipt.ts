// Builds the sales receipt shown/printed after a checkout. The layout mirrors a
// standard 58mm thermal slip like the desktop POS: centered company header,
// itemised lines, totals, amount paid / change, payment method and a footer.
// The output is HTML sized for a narrow thermal roll and printed via expo-print
// (see src/lib/printer.ts).

export type ReceiptCompany = {
  name: string;
  address?: string;
  phone?: string;
  tin?: string;
  vat?: string;
};

export type ReceiptItem = { name: string; qty: number; unitPrice: number };

export type ReceiptData = {
  receiptNo: string;
  dateTime: string; // human-readable
  cashier?: string | null;
  customer?: string | null;
  company: ReceiptCompany;
  items: ReceiptItem[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  change: number;
  paymentMethod: string;
  paymentRef?: string | null; // e.g. EcoCash number
};

import { currency } from '@/theme';

// Amounts are stored in USD base; `currency()` renders them in the currently
// selected display currency (USD or ZiG) so receipts match on-screen prices.
const money = (n: number) => currency(Number.isFinite(n) ? n : 0);
const esc = (s: string) =>
  String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));

export function buildReceiptHtml(d: ReceiptData): string {
  const rows = d.items
    .map(
      (it) => `
      <tr>
        <td class="qty">${it.qty}</td>
        <td class="name">${esc(it.name)}</td>
        <td class="amt">${money(it.qty * it.unitPrice)}</td>
      </tr>`
    )
    .join('');

  const taxLine = d.tax > 0 ? `<div class="row"><span>VAT</span><span>${money(d.tax)}</span></div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { box-sizing: border-box; }
    body { width: 280px; margin: 0 auto; padding: 8px 10px;
           font-family: 'Courier New', monospace; color: #000; font-size: 12px; }
    .center { text-align: center; }
    .company { font-size: 15px; font-weight: 700; }
    .muted { color: #000; font-size: 11px; }
    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    td.qty { width: 24px; }
    td.amt { text-align: right; white-space: nowrap; }
    td.name { padding-left: 4px; }
    .row { display: flex; justify-content: space-between; }
    .total { font-size: 14px; font-weight: 700; }
    .foot { margin-top: 8px; text-align: center; font-size: 11px; }
  </style>
</head>
<body>
  <div class="center company">${esc(d.company.name)}</div>
  ${d.company.address ? `<div class="center muted">${esc(d.company.address)}</div>` : ''}
  ${d.company.phone ? `<div class="center muted">Tel: ${esc(d.company.phone)}</div>` : ''}
  ${d.company.tin ? `<div class="center muted">TIN: ${esc(d.company.tin)}${d.company.vat ? ` · VAT: ${esc(d.company.vat)}` : ''}</div>` : ''}
  <hr />
  <div class="row"><span>Receipt</span><span>${esc(d.receiptNo)}</span></div>
  <div class="row"><span>Date</span><span>${esc(d.dateTime)}</span></div>
  ${d.cashier ? `<div class="row"><span>Cashier</span><span>${esc(d.cashier)}</span></div>` : ''}
  ${d.customer ? `<div class="row"><span>Customer</span><span>${esc(d.customer)}</span></div>` : ''}
  <hr />
  <table>
    <tbody>${rows}</tbody>
  </table>
  <hr />
  <div class="row"><span>Subtotal</span><span>${money(d.subtotal)}</span></div>
  ${taxLine}
  <div class="row total"><span>TOTAL</span><span>${money(d.total)}</span></div>
  <div class="row"><span>Paid (${esc(d.paymentMethod)})</span><span>${money(d.amountPaid)}</span></div>
  ${d.paymentRef ? `<div class="row"><span>${esc(d.paymentMethod)} No.</span><span>${esc(d.paymentRef)}</span></div>` : ''}
  <div class="row"><span>Change</span><span>${money(d.change)}</span></div>
  <hr />
  <div class="foot">Thank you for your business!</div>
</body>
</html>`;
}
