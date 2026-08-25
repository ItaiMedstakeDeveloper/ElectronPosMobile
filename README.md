# Electron POS — React (Expo) rebuild

A cross-platform rewrite of the Laravel/Blade POS as a single **Expo (React Native)**
codebase. The same code runs on:

- **Desktop** — via Expo Web (`react-native-web`). The web build can be wrapped with
  Electron or Tauri to ship a desktop binary (your existing Tauri setup can point at
  the exported web build).
- **Mobile** — iOS / Android through Expo Go or a native build.

This build is **standalone with mock data** (see `src/data/mockData.ts`). No backend is
required yet; swapping the mock module for API calls to your Laravel app is the next step.

## Screens (from the original sidebar)

Dashboard · Products · Cart (with checkout) · Inventory · Customers · Invoices · Reports · Settings

Navigation is **responsive**: a side rail on wide/desktop screens (≥900px) and a bottom
tab bar on mobile.

## Run it

```bash
cd pos-app
npm install

# Desktop preview (opens in the browser)
npm run web

# Mobile (scan the QR with Expo Go)
npm start
```

## Structure

```
app/                 # expo-router screens (file = route)
  _layout.tsx        # responsive shell: Sidebar (desktop) / BottomTabs (mobile)
  index.tsx          # Dashboard
  products.tsx       # searchable catalog + add to cart
  cart.tsx           # cart + mock checkout
  inventory.tsx  customers.tsx  invoices.tsx  reports.tsx  settings.tsx
src/
  data/mockData.ts   # products, categories, customers, invoices  <-- replace with API later
  context/CartContext.tsx
  components/         # Sidebar, BottomTabs, shared ui (Screen/Card/Badge)
  navigation.ts      # nav items derived from the old Laravel sidebar
  theme.ts           # colors, spacing, currency helper
```

## Next steps

1. Replace `src/data/mockData.ts` with a small API client hitting your Laravel routes.
2. Ship desktop: `npm run build:web` → wrap `dist/` with Tauri/Electron.
