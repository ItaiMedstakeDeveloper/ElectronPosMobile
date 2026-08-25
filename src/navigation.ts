import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { UserRole } from "@/data/mockData";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type NavLeaf = { label: string; href: string; icon: IoniconName };

export type NavSection =
  | {
      type: "link";
      label: string;
      href: string;
      icon: IoniconName;
      cta?: boolean;
    }
  | { type: "group"; label: string; icon: IoniconName; children: NavLeaf[] };
// Mirrors the original Laravel sidebar (resources/views/components/navbars/sidebar.blade.php):
// grouped dropdown sections with sub-items. Destinations that already have a screen point
// to it; the rest point to placeholder screens that are easy to flesh out later.
export const navSections: NavSection[] = [
  {
    type: "link",
    label: "Dashboard",
    href: "/dashboard",
    icon: "speedometer-outline",
  },
  {
    type: "group",
    label: "Products",
    icon: "pricetags-outline",
    children: [
      { label: "Product List", href: "/products", icon: "list-outline" },
      { label: "Categories", href: "/categories", icon: "grid-outline" },
    ],
  },
  {
    type: "group",
    label: "Inventory",
    icon: "cube-outline",
    children: [
      {
        label: "Available Inventory",
        href: "/inventory",
        icon: "file-tray-full-outline",
      },
      {
        label: "Goods Received Vouchers",
        href: "/grv",
        icon: "reader-outline",
      },
      {
        label: "Suppliers",
        href: "/suppliers",
        icon: "business-outline",
      },
      {
        label: "Purchase Orders",
        href: "/purchase-orders",
        icon: "clipboard-outline",
      },
      {
        label: "Stock Enquiry",
        href: "/stock-enquiry",
        icon: "search-outline",
      },
    ],
  },
  {
    type: "group",
    label: "Customers",
    icon: "people-outline",
    children: [
      {
        label: "Create Customer",
        href: "/create-customers",
        icon: "person-add-outline",
      },
      {
        label: "Quote Customers",
        href: "/quote-customers",
        icon: "pricetag-outline",
      },
      {
        label: "View Customers",
        href: "/customers",
        icon: "people-outline",
      },
    ],
  },
  {
    type: "group",
    label: "Users",
    icon: "people-circle-outline",
    children: [{ label: "View Users", href: "/users", icon: "person-outline" }],
  },
  {
    type: "group",
    label: "Reports",
    icon: "bar-chart-outline",
    children: [
      {
        label: "View Reports",
        href: "/reports",
        icon: "stats-chart-outline",
      },
    ],
  },
  {
    type: "group",
    label: "Accounts Settings",
    icon: "id-card-outline",
    children: [
      {
        label: "Configure Printers",
        href: "/printers",
        icon: "print-outline",
      },
    ],
  },
];

// Compact mobile bottom bar (a "More" tab holds the full grouped menu above).
export const bottomTabs: NavLeaf[] = [
  { label: "Dashboard", href: "/dashboard", icon: "speedometer-outline" },
  { label: "Products", href: "/products", icon: "pricetags-outline" },
  { label: "Cart", href: "/cart", icon: "cart-outline" },
  { label: "Sales", href: "/sales", icon: "receipt-outline" },
  { label: "Airtime", href: "/sell-airtime", icon: "phone-portrait-outline" },
];

// ---- Role-based access ----
// Cashiers are limited to the checkout flow: browse products and manage the
// cart. Everything else is back-office (admin/manager); user management is
// admin-only.
const CASHIER_ALLOWED_PREFIXES = ["/products", "/cart", "/checkout"];

// Screens a cashier may open; anything else redirects them back to the cart.
export function canAccess(role: UserRole | null, pathname: string): boolean {
  if (!role) return false;
  if (role === "cashier") {
    return CASHIER_ALLOWED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
  }
  // Only admins manage users.
  if (pathname === "/users" || pathname.startsWith("/users/"))
    return role === "admin";
  return true;
}

// The landing screen for a role right after sign-in.
export const homeFor = (role: UserRole | null): string =>
  role === "cashier" ? "/cart" : "/dashboard";

const cashierNav: NavSection[] = [
  {
    type: "link",
    label: "Products",
    href: "/products",
    icon: "pricetags-outline",
  },
  {
    type: "link",
    label: "Go to Cart",
    href: "/cart",
    icon: "basket-outline",
    cta: true,
  },
];

// Grouped side/drawer menu filtered for the current role.
export function navSectionsFor(role: UserRole | null): NavSection[] {
  if (role === "cashier") return cashierNav;
  if (role === "manager") {
    // Managers see everything except user management.
    return navSections.filter(
      (s) => !(s.type === "group" && s.label === "Users"),
    );
  }
  return navSections; // admin
}

const cashierTabs: NavLeaf[] = [
  { label: "Products", href: "/products", icon: "pricetags-outline" },
  { label: "Cart", href: "/cart", icon: "cart-outline" },
];

// Bottom tab bar filtered for the current role.
export function bottomTabsFor(role: UserRole | null): NavLeaf[] {
  return role === "cashier" ? cashierTabs : bottomTabs;
}
