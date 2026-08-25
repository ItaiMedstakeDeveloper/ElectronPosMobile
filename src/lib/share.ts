import { Linking } from 'react-native';
import { notify } from '@/lib/confirm';

// Default dialling code used to expand local numbers (Zimbabwe: +263). A number
// stored as 0771234567 becomes 263771234567 — the form WhatsApp requires.
const DEFAULT_COUNTRY_CODE = '263';

// Normalise a phone number to the international digits WhatsApp expects: no '+',
// spaces or punctuation, and a country code instead of a leading trunk '0'.
export function toWhatsAppNumber(phone?: string | null, cc = DEFAULT_COUNTRY_CODE): string {
  let d = (phone ?? '').replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2); // international access prefix
  if (d.startsWith(cc)) return d; // already has the country code
  if (d.startsWith('0')) return cc + d.slice(1); // local trunk 0 → country code
  return d; // assume already international
}

// Open WhatsApp with a prefilled message. If a phone number is supplied the
// message is addressed straight to that contact; otherwise WhatsApp opens a
// contact picker. Falls back to the wa.me web link when the native app scheme
// is unavailable (web, or iOS without the query scheme declared).
export async function shareViaWhatsApp(message: string, phone?: string | null) {
  const text = encodeURIComponent(message);
  const digits = toWhatsAppNumber(phone);
  const appUrl = digits ? `whatsapp://send?phone=${digits}&text=${text}` : `whatsapp://send?text=${text}`;
  const webUrl = digits
    ? `https://wa.me/${digits}?text=${text}`
    : `https://api.whatsapp.com/send?text=${text}`;
  try {
    const canOpenApp = await Linking.canOpenURL(appUrl);
    await Linking.openURL(canOpenApp ? appUrl : webUrl);
  } catch {
    try {
      await Linking.openURL(webUrl);
    } catch {
      notify('Could not open WhatsApp. Is it installed?');
    }
  }
}

// Open the device email composer with a prefilled subject and body. `to` is
// optional (suppliers may not have an email on file).
export async function shareViaEmail(subject: string, body: string, to?: string | null) {
  const url = `mailto:${to ?? ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  try {
    await Linking.openURL(url);
  } catch {
    notify('Could not open your email app.');
  }
}
