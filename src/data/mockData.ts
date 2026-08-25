// Standalone mock data. This mirrors the domain of the original Laravel POS
// (products, categories, inventory, customers, invoices, suppliers, users,
// purchase orders, GRVs, quotes, company/tax/printer settings) so the React
// screens have realistic content before any backend is wired up.

export type Category = { id: string; name: string; createdAt: string };

export type Product = {
    id: string;
    name: string;
    sku: string; // barcode
    categoryId: string;
    description: string;
    cost: number;
    price: number; // selling price
    unit: "Each" | "Kg" | "L" | "M";
    taxGroup: string; // e.g. '15%', '0%', 'Exempt'
    stock: number;
    reorderLevel: number;
};

export type Customer = {
    id: string;
    name: string;
    code: string;
    phone: string;
    email: string;
    address: string;
    tin: string;
    vat: string;
    type: "Cash" | "Credit";
    status: "Active" | "Not Active";
    balance: number;
};

export type Supplier = {
    id: string;
    name: string;
    tin: string;
    vat: string;
    address: string;
    type: "NA" | "Cash" | "Credit";
    phone: string;
    contactPerson: string;
    contactPhone: string;
};

export type Employee = {
    id: string;
    name: string;
    email: string;
    role: "Administrator" | "Cashier";
    createdAt: string;
};

// Application login accounts, mirroring the Laravel `users` migration
// (name, email, password, role enum admin|manager|cashier, active) plus a
// `phone` used for cashier sign-in. Admins/managers sign in with email +
// password; cashiers sign in with phone + a numeric passcode. The credential
// (password/passcode) is never surfaced in this read model — it lives only in
// SQLite. Email is null for cashiers; phone is null for accounts that don't use
// phone sign-in.
export type UserRole = "admin" | "manager" | "cashier";
export type AppUser = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: UserRole;
    active: boolean;
};

export type LineItem = {
    productId: string;
    name: string;
    unit: string;
    qty: number;
    unitCost: number;
};

export type PurchaseOrder = {
    id: string;
    number: string;
    supplierId: string;
    date: string;
    expectedDate: string;
    paymentMethod: "Cash" | "Card" | "Credit";
    invoiceNumber: string;
    items: LineItem[];
    total: number;
    // 'pending' until goods are received against it, then 'received'.
    status?: string;
};

export type GRV = {
    id: string;
    number: string;
    supplierId: string;
    date: string;
    paymentMethod: "Cash" | "Card" | "Credit";
    items: LineItem[];
    total: number;
};

export type Quote = {
    id: string;
    number: string;
    customerId: string;
    date: string;
    items: LineItem[];
    subtotal: number;
    tax: number;
    total: number;
};

export type InvoiceItem = {
    productId: string;
    name: string;
    qty: number;
    price: number;
};

export type Invoice = {
    id: string;
    number: string;
    customerId: string | null;
    customerName: string;
    date: string; // ISO
    items: InvoiceItem[];
    total: number;
    status: "paid" | "unpaid" | "quote";
};

export type Company = {
    name: string;
    tin: string;
    vat: string;
    address: string;
    phone: string;
    bankAccount: string;
    bankDetails: string;
    email: string;
};

export type Printer = {
    name: string;
    connectionMode: "Bluetooth" | "USB" | "Network" | "Wi-Fi";
    deviceId: string;
    status: string;
};

export const categories: Category[] = [
    { id: "c1", name: "Beverages", createdAt: "2026-07-01" },
    { id: "c2", name: "Snacks", createdAt: "2026-07-01" },
    { id: "c3", name: "Household", createdAt: "2026-07-02" },
    { id: "c4", name: "Electronics", createdAt: "2026-07-05" },
    { id: "c5", name: "Stationery", createdAt: "2026-07-08" },
];

const p = (
    id: string,
    name: string,
    sku: string,
    categoryId: string,
    cost: number,
    price: number,
    unit: Product["unit"],
    stock: number,
    reorderLevel: number,
): Product => ({
    id,
    name,
    sku,
    categoryId,
    description: name,
    cost,
    price,
    unit,
    taxGroup: "15%",
    stock,
    reorderLevel,
});

export const products: Product[] = [
    p("p1", "Coca-Cola 500ml", "BEV-001", "c1", 0.8, 1.2, "Each", 240, 50),
    p("p2", "Mineral Water 1L", "BEV-002", "c1", 0.5, 0.8, "Each", 18, 40),
    p("p3", "Orange Juice 1L", "BEV-003", "c1", 1.7, 2.5, "Each", 62, 30),
    p("p4", "Potato Chips 150g", "SNK-001", "c2", 1.1, 1.75, "Each", 130, 40),
    p("p5", "Chocolate Bar", "SNK-002", "c2", 0.7, 1.1, "Each", 9, 25),
    p("p6", "Salted Peanuts 200g", "SNK-003", "c2", 1.4, 2.2, "Each", 54, 20),
    p("p7", "Dish Soap 750ml", "HH-001", "c3", 2.2, 3.4, "Each", 40, 15),
    p("p8", "Paper Towels 2-pack", "HH-002", "c3", 3.2, 4.9, "Each", 22, 15),
    p("p9", "USB-C Cable 1m", "ELE-001", "c4", 4.5, 6.99, "Each", 75, 20),
    p("p10", "AA Batteries 4-pack", "ELE-002", "c4", 3.6, 5.5, "Each", 3, 30),
    p(
        "p11",
        "Ballpoint Pen (Blue)",
        "STA-001",
        "c5",
        0.2,
        0.4,
        "Each",
        500,
        100,
    ),
    p("p12", "A4 Notebook", "STA-002", "c5", 1.2, 2.0, "Each", 88, 30),
];

export const customers: Customer[] = [
    {
        id: "cu1",
        name: "Walk-in Customer",
        code: "WALK-IN",
        phone: "-",
        email: "-",
        address: "-",
        tin: "-",
        vat: "-",
        type: "Cash",
        status: "Active",
        balance: 0,
    },
    {
        id: "cu2",
        name: "Tendai Moyo",
        code: "CUST-002",
        phone: "+263 77 123 4567",
        email: "tendai@example.com",
        address: "12 Samora Machel Ave, Harare",
        tin: "2000123456",
        vat: "220012345",
        type: "Credit",
        status: "Active",
        balance: 45.5,
    },
    {
        id: "cu3",
        name: "Rufaro Ncube",
        code: "CUST-003",
        phone: "+263 71 987 6543",
        email: "rufaro@example.com",
        address: "8 Leopold Takawira St, Bulawayo",
        tin: "2000987654",
        vat: "220098765",
        type: "Cash",
        status: "Active",
        balance: 0,
    },
    {
        id: "cu4",
        name: "Blessing Chikwava",
        code: "CUST-004",
        phone: "+263 78 555 0101",
        email: "blessing@example.com",
        address: "45 Fife Ave, Harare",
        tin: "2000555010",
        vat: "220055501",
        type: "Credit",
        status: "Not Active",
        balance: 120.0,
    },
];

export const suppliers: Supplier[] = [
    {
        id: "s1",
        name: "Delta Beverages",
        tin: "2001112223",
        vat: "220111222",
        address: "Northend Rd, Harare",
        type: "Credit",
        phone: "+263 24 288 0000",
        contactPerson: "Farai Dube",
        contactPhone: "+263 77 200 1000",
    },
    {
        id: "s2",
        name: "Cairns Foods",
        tin: "2003334445",
        vat: "220333444",
        address: "Willowvale, Harare",
        type: "Credit",
        phone: "+263 24 262 1000",
        contactPerson: "Nyasha Banda",
        contactPhone: "+263 71 300 2000",
    },
    {
        id: "s3",
        name: "Tech Distributors Zw",
        tin: "2005556667",
        vat: "220555666",
        address: "Msasa, Harare",
        type: "Cash",
        phone: "+263 24 244 3000",
        contactPerson: "Kuda Sibanda",
        contactPhone: "+263 78 400 3000",
    },
];

export const employees: Employee[] = [
    {
        id: "e1",
        name: "Admin User",
        email: "admin@electronpos.co.zw",
        role: "Administrator",
        createdAt: "2026-06-01",
    },
    {
        id: "e2",
        name: "Chipo Marufu",
        email: "chipo@electronpos.co.zw",
        role: "Cashier",
        createdAt: "2026-06-15",
    },
    {
        id: "e3",
        name: "Tafara Zhou",
        email: "tafara@electronpos.co.zw",
        role: "Cashier",
        createdAt: "2026-07-10",
    },
];

export const purchaseOrders: PurchaseOrder[] = [
    {
        id: "po1",
        number: "PO-1001",
        supplierId: "s1",
        date: "2026-08-10",
        expectedDate: "2026-08-17",
        paymentMethod: "Credit",
        invoiceNumber: "DB-55231",
        items: [
            {
                productId: "p1",
                name: "Coca-Cola 500ml",
                unit: "Each",
                qty: 200,
                unitCost: 0.8,
            },
            {
                productId: "p2",
                name: "Mineral Water 1L",
                unit: "Each",
                qty: 150,
                unitCost: 0.5,
            },
        ],
        total: 235,
    },
    {
        id: "po2",
        number: "PO-1002",
        supplierId: "s3",
        date: "2026-08-14",
        expectedDate: "2026-08-21",
        paymentMethod: "Cash",
        invoiceNumber: "TD-90012",
        items: [
            {
                productId: "p9",
                name: "USB-C Cable 1m",
                unit: "Each",
                qty: 50,
                unitCost: 4.5,
            },
        ],
        total: 225,
    },
];

export const grvs: GRV[] = [
    {
        id: "g1",
        number: "GRN-0001",
        supplierId: "s1",
        date: "2026-08-12",
        paymentMethod: "Credit",
        items: [
            {
                productId: "p1",
                name: "Coca-Cola 500ml",
                unit: "Each",
                qty: 200,
                unitCost: 0.8,
            },
        ],
        total: 160,
    },
];

export const quotes: Quote[] = [
    {
        id: "q1",
        number: "CQ-1001",
        customerId: "cu2",
        date: "2026-08-16",
        items: [
            {
                productId: "p8",
                name: "Paper Towels 2-pack",
                unit: "Each",
                qty: 5,
                unitCost: 4.9,
            },
            {
                productId: "p7",
                name: "Dish Soap 750ml",
                unit: "Each",
                qty: 3,
                unitCost: 3.4,
            },
        ],
        subtotal: 34.7,
        tax: 5.21,
        total: 39.91,
    },
];

export const invoices: Invoice[] = [
    {
        id: "inv1",
        number: "INV-1001",
        customerId: "cu2",
        customerName: "Tendai Moyo",
        date: "2026-08-18T10:24:00Z",
        items: [
            { productId: "p1", name: "Coca-Cola 500ml", qty: 6, price: 1.2 },
            { productId: "p4", name: "Potato Chips 150g", qty: 2, price: 1.75 },
        ],
        total: 10.7,
        status: "paid",
    },
    {
        id: "inv2",
        number: "INV-1002",
        customerId: "cu3",
        customerName: "Rufaro Ncube",
        date: "2026-08-18T14:02:00Z",
        items: [
            { productId: "p9", name: "USB-C Cable 1m", qty: 1, price: 6.99 },
        ],
        total: 6.99,
        status: "unpaid",
    },
    {
        id: "inv3",
        number: "INV-1003",
        customerId: "cu4",
        customerName: "Blessing Chikwava",
        date: "2026-08-19T09:15:00Z",
        items: [
            {
                productId: "p8",
                name: "Paper Towels 2-pack",
                qty: 3,
                price: 4.9,
            },
            { productId: "p7", name: "Dish Soap 750ml", qty: 2, price: 3.4 },
        ],
        total: 21.5,
        status: "paid",
    },
];

export const company: Company = {
    name: "Electron POS Ltd",
    tin: "2000000001",
    vat: "220000001",
    address: "Harare, Zimbabwe",
    phone: "+263 24 000 0000",
    bankAccount: "0123456789",
    bankDetails: "CBZ Bank, Kwame Nkrumah Branch",
    email: "accounts@electronpos.co.zw",
};

export const tax = { value: 15 };

export const printer: Printer = {
    name: "Not configured",
    connectionMode: "USB",
    deviceId: "",
    status: "disconnected",
};

export const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "Uncategorised";
