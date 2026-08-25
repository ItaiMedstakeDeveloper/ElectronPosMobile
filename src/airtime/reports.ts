// NOTE: expo-print / expo-sharing / expo-file-system are NATIVE modules.
// They are loaded lazily (inside the export functions) rather than at the top
// of this file so that merely importing the report helpers never pulls in
// native code at app startup. Expo Router evaluates every route file up front,
// so a top-level native import here would hang the splash screen on any build
// that hasn't been recompiled with these modules.

/** Format a number as USD, trimming a trailing .00. */
export function money(n: number): string {
  return `$${n % 1 === 0 ? n.toString() : n.toFixed(2)}`;
}

/** Local YYYY-MM-DD key for grouping/comparison. */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "5 Jun 2026" */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "5 Jun 2026, 2:05 PM" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${formatDate(d)}, ${h}:${minutes} ${ampm}`;
}

export function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

export function endOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(23, 59, 59, 999);
  return n;
}

/** Monday-based start of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const n = startOfDay(d);
  const day = (n.getDay() + 6) % 7; // 0 = Monday
  n.setDate(n.getDate() - day);
  return n;
}

export function addDays(d: Date, days: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + days);
  return n;
}

/* ------------------------------------------------------------------ */
/* CSV + PDF export                                                    */
/* ------------------------------------------------------------------ */

function escapeCsv(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string from headers + rows. */
export function buildCsv(
  headers: string[],
  rows: (string | number)[][],
): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCsv).join(","));
  return lines.join("\n");
}

function safeName(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
}

/** Write a CSV to a temp file and open the share sheet (download/save). */
export async function exportCsv(filename: string, csv: string): Promise<void> {
  const FileSystem: any = require("expo-file-system/legacy");
  const Sharing: any = require("expo-sharing");
  const uri = `${FileSystem.cacheDirectory}${safeName(filename)}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "text/csv",
    dialogTitle: filename,
    UTI: "public.comma-separated-values-text",
  });
}

/** Render HTML to a PDF and open the share sheet (download/save/print). */
export async function exportPdf(filename: string, html: string): Promise<void> {
  const Print: any = require("expo-print");
  const Sharing: any = require("expo-sharing");
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: filename,
    UTI: "com.adobe.pdf",
  });
}

/** Wrap a report title + summary + table into a styled, printable HTML page. */
export function reportHtml(opts: {
  title: string;
  subtitle?: string;
  summary?: { label: string; value: string }[];
  headers: string[];
  rows: (string | number)[][];
}): string {
  const summaryHtml = opts.summary?.length
    ? `<div class="summary">${opts.summary
        .map(
          (s) =>
            `<div class="metric"><div class="m-label">${s.label}</div><div class="m-value">${s.value}</div></div>`,
        )
        .join("")}</div>`
    : "";

  const head = opts.headers.map((h) => `<th>${h}</th>`).join("");
  const body = opts.rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
  <style>
    * { font-family: -apple-system, Roboto, 'Segoe UI', sans-serif; }
    body { padding: 28px; color: #11181C; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .subtitle { color: #687076; font-size: 13px; margin-bottom: 20px; }
    .summary { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
    .metric { border: 1px solid #e2e6e8; border-radius: 10px; padding: 12px 16px; min-width: 120px; }
    .m-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #687076; }
    .m-value { font-size: 20px; font-weight: 800; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; background: #0A2E36; color: #fff; padding: 8px 10px; }
    td { padding: 8px 10px; border-bottom: 1px solid #eceff0; }
    tr:nth-child(even) td { background: #f7f9fa; }
    .footer { margin-top: 24px; font-size: 11px; color: #9BA1A6; }
  </style></head>
  <body>
    <h1>${opts.title}</h1>
    ${opts.subtitle ? `<div class="subtitle">${opts.subtitle}</div>` : ""}
    ${summaryHtml}
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <div class="footer">Generated ${formatDateTime(new Date().toISOString())} · ScanIt</div>
  </body></html>`;
}
