// Central design tokens. Mirrors the dark sidebar / warning-yellow accent
// from the original Laravel POS so the look stays familiar.
export const colors = {
  bg: '#f5f6f8',
  surface: '#ffffff',
  sidebar: '#1e2128', // deep charcoal rail
  sidebarHover: '#2a2e37',
  border: '#e6e8ec',
  text: '#1a2230',
  textMuted: '#6b7280',
  textOnDark: '#ffffff',
  primary: '#3b5bdb',
  primarySoft: '#e9edfc', // light-nav active pill
  accent: '#f7b500', // cart / call-to-action yellow
  accentSoft: 'rgba(247,181,0,0.16)', // dark-nav active pill
  success: '#12b886',
  danger: '#e03131',
  warningBg: '#fff4d6',
};

// Reusable soft elevation for cards / raised surfaces.
export const shadow = {
  shadowColor: '#0b1220',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
};

// Layouts switch from mobile (bottom tabs) to desktop (side rail) here.
export const BREAKPOINT_WIDE = 900;

// ---- Currency ----
// Prices are stored in USD (the base). The app can DISPLAY everything in USD or
// ZiG using an exchange rate (ZiG per 1 USD). `currency()` is read by every
// screen, so switching here reprices the whole app. The active config lives in
// module state and is driven by DataContext (persisted in SQLite settings).
export type CurrencyCode = 'USD' | 'ZiG';

let _code: CurrencyCode = 'USD';
let _rate = 1; // ZiG per 1 USD

export function setCurrencyConfig(code: CurrencyCode, rate: number) {
  _code = code === 'ZiG' ? 'ZiG' : 'USD';
  _rate = rate > 0 ? rate : 1;
}
export function getCurrencyCode(): CurrencyCode {
  return _code;
}
export function getExchangeRate(): number {
  return _rate;
}

// Convert an amount typed in the DISPLAY currency back to the USD base.
export const toBaseUsd = (displayAmount: number) => (_code === 'ZiG' ? displayAmount / _rate : displayAmount);

// Format a USD base amount in the currently selected display currency.
export const currency = (nUsd: number) => {
  const v = _code === 'ZiG' ? nUsd * _rate : nUsd;
  const num = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return _code === 'ZiG' ? `ZiG ${num}` : `$${num}`;
};
