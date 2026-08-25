import * as Print from 'expo-print';
import { Linking, Platform, PermissionsAndroid } from 'react-native';
import { buildReceiptHtml, ReceiptData } from '@/lib/receipt';
import { notify } from '@/lib/confirm';
import { currency } from '@/theme';

// In-app Bluetooth receipt printing via a native ESC/POS module. This only
// exists in a custom dev build — in Expo Go / web the require still resolves but
// the native methods are absent, so we detect that and fall back to the OS print
// sheet (expo-print) instead of crashing.

let BT: { BluetoothManager: any; BluetoothEscposPrinter: any } | null = null;
try {
  // Maintained fork (AndroidX / modern Gradle) with the same API as the original.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const m = require('@brooons/react-native-bluetooth-escpos-printer');
  if (m?.BluetoothManager && m?.BluetoothEscposPrinter) {
    BT = { BluetoothManager: m.BluetoothManager, BluetoothEscposPrinter: m.BluetoothEscposPrinter };
  }
} catch {
  BT = null;
}

export type BtDevice = { name: string; address: string };

const NOT_AVAILABLE =
  'Bluetooth printing needs the installed app (dev build) — it is not available in Expo Go.';

// True only when the native module is actually wired in (a dev build).
export function isBluetoothPrintingAvailable(): boolean {
  return !!BT && typeof BT.BluetoothManager?.scanDevices === 'function';
}

async function requestAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const wanted = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ].filter(Boolean) as string[];
    if (wanted.length === 0) return true;
    const res = await PermissionsAndroid.requestMultiple(wanted as any);
    return Object.values(res).every((v) => v !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
  } catch {
    return true; // older Android without runtime BT permissions
  }
}

// Make sure Bluetooth is permitted and turned on. Returns false (with a notice)
// when unavailable so callers can stop.
export async function ensureBluetoothReady(): Promise<boolean> {
  if (!isBluetoothPrintingAvailable()) {
    notify(NOT_AVAILABLE);
    return false;
  }
  const granted = await requestAndroidPermissions();
  if (!granted) {
    notify('Bluetooth permission is required to find the printer.');
    return false;
  }
  try {
    const enabled = await BT!.BluetoothManager.isBluetoothEnabled();
    if (!enabled) await BT!.BluetoothManager.enableBluetooth();
  } catch {
    // enableBluetooth rejects if the user declines the system prompt.
  }
  return true;
}

const parseList = (arr: any): BtDevice[] =>
  (Array.isArray(arr) ? arr : [])
    .map((d: any) => ({ name: d?.name || '(unnamed)', address: d?.address }))
    .filter((d: BtDevice) => !!d.address);

// Scan for nearby + already-paired Bluetooth devices.
export async function scanForPrinters(): Promise<{ paired: BtDevice[]; found: BtDevice[] }> {
  if (!isBluetoothPrintingAvailable()) {
    notify(NOT_AVAILABLE);
    return { paired: [], found: [] };
  }
  const raw = await BT!.BluetoothManager.scanDevices();
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw || {};
  return { paired: parseList(data.paired), found: parseList(data.found) };
}

// Connect to a printer by MAC address. Swallows "already connected" errors.
export async function connectPrinter(address: string): Promise<void> {
  if (!isBluetoothPrintingAvailable()) {
    notify(NOT_AVAILABLE);
    throw new Error('bluetooth-unavailable');
  }
  await BT!.BluetoothManager.connect(address);
}

// Amounts are stored in USD base; render in the selected display currency.
const money = (n: number) => currency(Number.isFinite(n) ? n : 0);

// Send the receipt as ESC/POS text to the currently connected printer (58mm/32 cols).
async function printReceiptBluetooth(d: ReceiptData): Promise<void> {
  const P = BT!.BluetoothEscposPrinter;
  const W = 32;
  const twoCol = (l: string, r: string) => {
    const left = l.length + r.length >= W ? l.slice(0, Math.max(0, W - r.length - 1)) : l;
    const pad = Math.max(1, W - left.length - r.length);
    return `${left}${' '.repeat(pad)}${r}\r\n`;
  };
  const rule = `${'-'.repeat(W)}\r\n`;

  await P.printerAlign(P.ALIGN.CENTER);
  await P.printText(`${d.company.name}\r\n`, {});
  if (d.company.address) await P.printText(`${d.company.address}\r\n`, {});
  if (d.company.phone) await P.printText(`Tel: ${d.company.phone}\r\n`, {});
  if (d.company.tin)
    await P.printText(`TIN: ${d.company.tin}${d.company.vat ? `  VAT: ${d.company.vat}` : ''}\r\n`, {});

  await P.printerAlign(P.ALIGN.LEFT);
  await P.printText(rule, {});
  await P.printText(twoCol('Receipt', d.receiptNo), {});
  await P.printText(twoCol('Date', d.dateTime), {});
  if (d.cashier) await P.printText(twoCol('Cashier', d.cashier), {});
  if (d.customer) await P.printText(twoCol('Customer', d.customer), {});
  await P.printText(rule, {});

  for (const it of d.items) {
    await P.printText(`${it.qty} x ${it.name}\r\n`, {});
    await P.printText(twoCol('', money(it.qty * it.unitPrice)), {});
  }

  await P.printText(rule, {});
  await P.printText(twoCol('Subtotal', money(d.subtotal)), {});
  if (d.tax > 0) await P.printText(twoCol('VAT', money(d.tax)), {});
  await P.printText(twoCol('TOTAL', money(d.total)), {});
  await P.printText(twoCol(`Paid (${d.paymentMethod})`, money(d.amountPaid)), {});
  if (d.paymentRef) await P.printText(twoCol(`${d.paymentMethod} No.`, d.paymentRef), {});
  await P.printText(twoCol('Change', money(d.change)), {});

  await P.printerAlign(P.ALIGN.CENTER);
  await P.printText('\r\nThank you for your business!\r\n', {});
  await P.printText('\r\n\r\n\r\n', {});
}

// Unified entry used by checkout. Prefers the connected Bluetooth printer
// (reconnecting to the saved address first); falls back to the OS print sheet
// when Bluetooth isn't available (e.g. Expo Go) so a receipt still comes out.
export async function printReceipt(d: ReceiptData, deviceAddress?: string | null): Promise<boolean> {
  if (isBluetoothPrintingAvailable()) {
    try {
      if (deviceAddress) {
        try {
          await connectPrinter(deviceAddress);
        } catch {
          // may already be connected — continue and let the print surface a real error
        }
      }
      await printReceiptBluetooth(d);
      return true;
    } catch (e) {
      console.warn('Bluetooth print failed', e);
      notify('Could not print. Make sure the Bluetooth printer is on and connected.');
      return false;
    }
  }
  try {
    await Print.printAsync({ html: buildReceiptHtml(d) });
    return true;
  } catch (e) {
    console.warn('OS print failed / cancelled', e);
    return false;
  }
}

export async function printTest(deviceAddress?: string | null): Promise<void> {
  if (isBluetoothPrintingAvailable()) {
    try {
      if (deviceAddress) {
        try {
          await connectPrinter(deviceAddress);
        } catch {
          /* maybe already connected */
        }
      }
      const P = BT!.BluetoothEscposPrinter;
      await P.printerAlign(P.ALIGN.CENTER);
      await P.printText('Electron POS\r\n', {});
      await P.printText('-- PRINTER TEST --\r\n', {});
      await P.printText('Printing works!\r\n\r\n\r\n', {});
    } catch (e) {
      console.warn('Test print failed', e);
      notify('Test print failed. Is the printer on and connected?');
    }
    return;
  }
  const html = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>body{width:280px;margin:0 auto;padding:16px;font-family:'Courier New',monospace;text-align:center}</style>
  </head><body>
    <div style="font-size:16px;font-weight:700">Electron POS</div>
    <div style="margin:8px 0">— PRINTER TEST —</div>
    <div>If you can read this, printing works.</div>
  </body></html>`;
  try {
    await Print.printAsync({ html });
  } catch (e) {
    console.warn('Test print failed / cancelled', e);
  }
}

// Jump to the phone's Bluetooth settings (used as a fallback / convenience).
export async function openBluetoothSettings(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS');
      return;
    }
    await Linking.openURL('App-Prefs:Bluetooth').catch(() => Linking.openSettings());
  } catch {
    await Linking.openSettings().catch(() => {});
  }
}
