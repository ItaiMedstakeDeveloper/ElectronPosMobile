import * as SQLite from "expo-sqlite";
import * as seed from "@/data/mockData";
import { hashPassword, verifyPassword } from "@/lib/hash";
import { getMetaSettings, setMetaSetting } from "@/db/meta";
import type {
    Category,
    Product,
    Customer,
    Supplier,
    GRV,
    PurchaseOrder,
    LineItem,
    AppUser,
    UserRole,
} from "@/data/mockData";

// SQLite persistence for Categories, Products, Customers and Suppliers.
// Products.categoryId is a real foreign key into categories.id (ON DELETE
// RESTRICT) so a category that still has products cannot be deleted — the
// database enforces the relationship.
//
// The `customers` and `suppliers` tables mirror the Laravel migrations

// (2023_09_30_081147_create_customers_table / 2023_09_30_130900_create_suppliers_table)
// column-for-column, so local rows map cleanly onto the backend schema. The

// `user_id` column mirrors the migration's FK to users; there is no local users
// table on device, so it is kept nullable with no FK constraint. Columns the UI
// uses that the migration does not define (customer email/type/balance) are
// defaulted on read and are not persisted.

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

// Which shop's data file is currently open. Each shop keeps all of its data in
// its own SQLite file (see src/db/meta.ts); switching shops points `open()` at
// a different file. "electronpos.db" is the original single-shop file, kept as
// the default "Main Shop" so existing installs migrate seamlessly.
let activeDbFile = "electronpos.db";

// Point the data layer at a shop's file. Resets the cached handle so the next
// `open()` connects to the new file. Callers must re-run `initDb()` and reload
// their data afterwards (the provider tree remounts to do this).
export function setActiveDbFile(file: string): void {
    if (file && file !== activeDbFile) {
        activeDbFile = file;
        dbPromise = null;
    }
}

export function getActiveDbFile(): string {
    return activeDbFile;
}

function open() {
    if (!dbPromise) dbPromise = SQLite.openDatabaseAsync(activeDbFile);
    return dbPromise;
}

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();

// Add a column to an existing table only if it isn't already present. Safe to
// run on every startup — used to evolve tables created by older app versions.
async function ensureColumn(
    db: SQLite.SQLiteDatabase,
    table: string,
    column: string,
    decl: string,
): Promise<void> {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === column)) {
        await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
    }
}

// Rebuild the `users` table to the current schema (nullable email + phone)
// when an older version created it with `email NOT NULL` and no phone column.
// Existing rows are copied across so accounts survive the upgrade.
async function migrateUsersTable(db: SQLite.SQLiteDatabase) {
    const cols = await db.getAllAsync<{ name: string; notnull: number }>(
        "PRAGMA table_info(users)",
    );
    if (cols.length === 0) return; // table not present yet
    const hasPhone = cols.some((c) => c.name === "phone");
    const emailNotNull = cols.some(
        (c) => c.name === "email" && c.notnull === 1,
    );
    if (hasPhone && !emailNotNull) return; // already current

    await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );
    INSERT INTO users_new (id, name, email, phone, password, role, active, created_at, updated_at)
      SELECT id, name, email, ${hasPhone ? "phone" : "NULL"}, password, role, active, created_at, updated_at FROM users;
    DROP TABLE users;
    ALTER TABLE users_new RENAME TO users;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
    PRAGMA foreign_keys = ON;
  `);
}

export async function initDb() {
    const db = await open();
    await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT NOT NULL,
      categoryId INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cost REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'Each',
      taxGroup TEXT NOT NULL DEFAULT '15%',
      stock INTEGER NOT NULL DEFAULT 0,
      reorderLevel INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE RESTRICT
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      code TEXT NOT NULL DEFAULT '',
      customer_tinnumber TEXT NOT NULL DEFAULT '',
      customer_vatnumber TEXT NOT NULL DEFAULT '',
      user_id INTEGER,
      customer_address TEXT NOT NULL DEFAULT '',
      customer_phonenumber TEXT NOT NULL DEFAULT '',
      customer_status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_name TEXT NOT NULL,
      user_id INTEGER,
      supplier_tinnumber TEXT NOT NULL DEFAULT '',
      supplier_vatnumber TEXT NOT NULL DEFAULT '',
      supplier_address TEXT NOT NULL DEFAULT '',
      supplier_phonenumber TEXT NOT NULL DEFAULT '',
      supplier_contactperson TEXT NOT NULL DEFAULT '',
      supplier_contactpersonnumber TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'NA',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS g_r_v_s (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      purchase_order_id INTEGER,
      grn_date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Credit',
      total TEXT NOT NULL DEFAULT '0',
      supplier_invoicenumber TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grv_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      measurement TEXT NOT NULL DEFAULT 'Each',
      quantity INTEGER NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (grv_id) REFERENCES g_r_v_s(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER,
      purchaseorder_date TEXT NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'Credit',
      expected_date TEXT,
      delivery_instructions TEXT,
      supplier_invoicenumber TEXT,
      total REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS purchase_order_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      measurement TEXT NOT NULL DEFAULT 'Each',
      quantity INTEGER NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subtotal REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      amount_paid REAL NOT NULL DEFAULT 0,
      change REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'Cash',
      user_id INTEGER,
      user_name TEXT,
      customer_id INTEGER,
      created_at TEXT NOT NULL,
      reversed INTEGER NOT NULL DEFAULT 0,
      reversed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      category_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      type TEXT NOT NULL,           -- 'add' (received) | 'writeoff'
      quantity INTEGER NOT NULL,    -- always positive
      note TEXT,                    -- description (add) / reason (writeoff)
      created_at TEXT,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );
  `);

    // Migrate an older `users` table (email NOT NULL, no phone column) to the
    // current shape, preserving existing accounts. Runs only when needed.
    await migrateUsersTable(db);

    // Older DBs created the `sales` table before reversal was supported; add the
    // columns if they're missing so transactions can be voided.
    await ensureColumn(db, 'sales', 'reversed', 'INTEGER NOT NULL DEFAULT 0');
    await ensureColumn(db, 'sales', 'reversed_at', 'TEXT');

    // Create the user unique indexes only after the migration has guaranteed the
    // email/phone columns exist (older DBs had no phone column).
    await db.execAsync(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
  `);

    // Seed once, mapping the mock string ids (c1, p1…) to fresh integer primary keys.
    const row = await db.getFirstAsync<{ c: number }>(
        "SELECT COUNT(*) as c FROM categories",
    );
    if ((row?.c ?? 0) === 0) {
        const idMap: Record<string, number> = {};
        for (const c of seed.categories) {
            const res = await db.runAsync(
                "INSERT INTO categories (name, createdAt) VALUES (?, ?)",
                c.name,
                c.createdAt,
            );
            idMap[c.id] = res.lastInsertRowId;
        }
        for (const p of seed.products) {
            await db.runAsync(
                `INSERT INTO products (name, sku, categoryId, description, cost, price, unit, taxGroup, stock, reorderLevel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                p.name,
                p.sku,
                idMap[p.categoryId] ?? 1,
                p.description,
                p.cost,
                p.price,
                p.unit,
                p.taxGroup,
                p.stock,
                p.reorderLevel,
            );
        }
    }

    // Seed a sample cashier once per shop. Admin accounts are global "owners"
    // that live in the meta store (see src/db/meta.ts) — a shop only holds its
    // own managers and cashiers. The credential is stored as a salted SHA-256
    // hash in the `password` column.
    const userRow = await db.getFirstAsync<{ c: number }>(
        "SELECT COUNT(*) as c FROM users",
    );
    if ((userRow?.c ?? 0) === 0) {
        const hashed = await hashPassword("1234");
        await db.runAsync(
            `INSERT INTO users (name, email, phone, password, role, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
            "Cashier",
            null,
            "+263770000000",
            hashed,
            "cashier",
            today(),
            today(),
        );
    }

    // Seed customers once, mapping the mock records onto the migration columns.
    const custRow = await db.getFirstAsync<{ c: number }>(
        "SELECT COUNT(*) as c FROM customers",
    );
    if ((custRow?.c ?? 0) === 0) {
        for (const c of seed.customers) {
            await db.runAsync(
                `INSERT INTO customers
          (customer_name, code, customer_tinnumber, customer_vatnumber, customer_address, customer_phonenumber, customer_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                c.name,
                c.code,
                c.tin,
                c.vat,
                c.address,
                c.phone,
                c.status,
                today(),
                today(),
            );
        }
    }

    // Seed suppliers once, mapping the mock records onto the migration columns.
    const supRow = await db.getFirstAsync<{ c: number }>(
        "SELECT COUNT(*) as c FROM suppliers",
    );
    if ((supRow?.c ?? 0) === 0) {
        for (const su of seed.suppliers) {
            await db.runAsync(
                `INSERT INTO suppliers
          (supplier_name, supplier_tinnumber, supplier_vatnumber, supplier_address, supplier_phonenumber, supplier_contactperson, supplier_contactpersonnumber, type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                su.name,
                su.tin,
                su.vat,
                su.address,
                su.phone,
                su.contactPerson,
                su.contactPhone,
                su.type,
                today(),
                today(),
            );
        }
    }
}

export async function getCategories(): Promise<Category[]> {
    const db = await open();
    const rows = await db.getAllAsync<any>(
        "SELECT * FROM categories ORDER BY id DESC",
    );
    return rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        createdAt: r.createdAt,
    }));
}

export async function addCategory(name: string): Promise<void> {
    const db = await open();
    await db.runAsync(
        "INSERT INTO categories (name, createdAt) VALUES (?, ?)",
        name,
        today(),
    );
}

export async function updateCategory(id: string, name: string): Promise<void> {
    const db = await open();
    await db.runAsync(
        "UPDATE categories SET name = ? WHERE id = ?",
        name,
        Number(id),
    );
}

export async function deleteCategory(id: string): Promise<void> {
    const db = await open();
    // Throws (FOREIGN KEY constraint failed) if products still reference this category.
    await db.runAsync("DELETE FROM categories WHERE id = ?", Number(id));
}

export async function countProductsInCategory(id: string): Promise<number> {
    const db = await open();
    const row = await db.getFirstAsync<{ c: number }>(
        "SELECT COUNT(*) as c FROM products WHERE categoryId = ?",
        Number(id),
    );
    return row?.c ?? 0;
}

// ---- Products ----
export async function getProducts(): Promise<Product[]> {
    const db = await open();
    const rows = await db.getAllAsync<any>(
        "SELECT * FROM products ORDER BY id DESC",
    );
    return rows.map((r) => ({
        id: String(r.id),
        name: r.name,
        sku: r.sku,
        categoryId: String(r.categoryId),
        description: r.description,
        cost: r.cost,
        price: r.price,
        unit: r.unit,
        taxGroup: r.taxGroup,
        stock: r.stock,
        reorderLevel: r.reorderLevel,
    }));
}

export async function addProduct(p: Omit<Product, "id">): Promise<void> {
    const db = await open();
    await db.runAsync(
        `INSERT INTO products (name, sku, categoryId, description, cost, price, unit, taxGroup, stock, reorderLevel)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p.name,
        p.sku,
        Number(p.categoryId),
        p.description,
        p.cost,
        p.price,
        p.unit,
        p.taxGroup,
        p.stock,
        p.reorderLevel,
    );
}

export async function updateProduct(
    id: string,
    p: Omit<Product, "id">,
): Promise<void> {
    const db = await open();
    await db.runAsync(
        `UPDATE products SET name = ?, sku = ?, categoryId = ?, description = ?, cost = ?, price = ?,
       unit = ?, taxGroup = ?, stock = ?, reorderLevel = ? WHERE id = ?`,
        p.name,
        p.sku,
        Number(p.categoryId),
        p.description,
        p.cost,
        p.price,
        p.unit,
        p.taxGroup,
        p.stock,
        p.reorderLevel,
        Number(id),
    );
}

export async function deleteProduct(id: string): Promise<void> {
    const db = await open();
    await db.runAsync("DELETE FROM products WHERE id = ?", Number(id));
}

// ---- Customers ----
// Rows map onto the Laravel `customers` migration columns. The UI-only fields
// email/type/balance are not columns in the migration, so they are defaulted
// here and not persisted.

export async function getCustomers(): Promise<Customer[]> {
    const db = await open();
    const rows = await db.getAllAsync<any>(
        "SELECT * FROM customers ORDER BY id DESC",
    );
    return rows.map((r) => ({
        id: String(r.id),
        name: r.customer_name,
        code: r.code,
        phone: r.customer_phonenumber,
        email: "",
        address: r.customer_address,
        tin: r.customer_tinnumber,
        vat: r.customer_vatnumber,
        type: "Cash",
        status: r.customer_status === "Active" ? "Active" : "Not Active",
        balance: 0,
    }));
}

export async function addCustomer(c: Omit<Customer, "id">): Promise<void> {
    const db = await open();
    await db.runAsync(
        `INSERT INTO customers
      (customer_name, code, customer_tinnumber, customer_vatnumber, customer_address, customer_phonenumber, customer_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        c.name,
        c.code,
        c.tin,
        c.vat,
        c.address,
        c.phone,
        c.status,
        today(),
        today(),
    );
}

export async function updateCustomer(
    id: string,
    c: Omit<Customer, "id">,
): Promise<void> {
    const db = await open();
    await db.runAsync(
        `UPDATE customers SET customer_name = ?, code = ?, customer_tinnumber = ?, customer_vatnumber = ?,
       customer_address = ?, customer_phonenumber = ?, customer_status = ?, updated_at = ? WHERE id = ?`,
        c.name,
        c.code,
        c.tin,
        c.vat,
        c.address,
        c.phone,
        c.status,
        today(),
        Number(id),
    );
}

export async function deleteCustomer(id: string): Promise<void> {
    const db = await open();
    await db.runAsync("DELETE FROM customers WHERE id = ?", Number(id));
}

// ---- Suppliers ----
// Rows map onto the Laravel `suppliers` migration columns.

export async function getSuppliers(): Promise<Supplier[]> {
    const db = await open();
    const rows = await db.getAllAsync<any>(
        "SELECT * FROM suppliers ORDER BY id DESC",
    );
    return rows.map((r) => ({
        id: String(r.id),
        name: r.supplier_name,
        tin: r.supplier_tinnumber,
        vat: r.supplier_vatnumber,
        address: r.supplier_address,
        type: r.type,
        phone: r.supplier_phonenumber,
        contactPerson: r.supplier_contactperson,
        contactPhone: r.supplier_contactpersonnumber,
    }));
}

export async function addSupplier(su: Omit<Supplier, "id">): Promise<void> {
    const db = await open();
    await db.runAsync(
        `INSERT INTO suppliers
      (supplier_name, supplier_tinnumber, supplier_vatnumber, supplier_address, supplier_phonenumber, supplier_contactperson, supplier_contactpersonnumber, type, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        su.name,
        su.tin,
        su.vat,
        su.address,
        su.phone,
        su.contactPerson,
        su.contactPhone,
        su.type,
        today(),
        today(),
    );
}

export async function updateSupplier(
    id: string,
    su: Omit<Supplier, "id">,
): Promise<void> {
    const db = await open();
    await db.runAsync(
        `UPDATE suppliers SET supplier_name = ?, supplier_tinnumber = ?, supplier_vatnumber = ?, supplier_address = ?,
       supplier_phonenumber = ?, supplier_contactperson = ?, supplier_contactpersonnumber = ?, type = ?, updated_at = ? WHERE id = ?`,
        su.name,
        su.tin,
        su.vat,
        su.address,
        su.phone,
        su.contactPerson,
        su.contactPhone,
        su.type,
        today(),
        Number(id),
    );
}

export async function deleteSupplier(id: string): Promise<void> {
    const db = await open();
    await db.runAsync("DELETE FROM suppliers WHERE id = ?", Number(id));
}

// ---- GRVs (Goods Received Vouchers) ----
// The header maps onto the Laravel `g_r_v_s` migration and each line item maps
// onto a `stocks` row (GRV hasMany Stock via grv_id), mirroring the backend.
// The UI's `number` is derived from the row id (there is no number column in the
// migration); supplier_invoicenumber/status use their migration defaults.

const grvNumber = (id: number) => `GRN-${String(id).padStart(4, "0")}`;

export async function getGRVs(): Promise<GRV[]> {
    const db = await open();
    const headers = await db.getAllAsync<any>(
        "SELECT * FROM g_r_v_s ORDER BY id DESC",
    );
    const lines = await db.getAllAsync<any>(
        "SELECT * FROM stocks ORDER BY id ASC",
    );
    const byGrv: Record<string, LineItem[]> = {};
    for (const l of lines) {
        const key = String(l.grv_id);
        (byGrv[key] ??= []).push({
            productId: l.product_id == null ? "" : String(l.product_id),
            name: l.product_name,
            unit: l.measurement,
            qty: l.quantity,
            unitCost: l.unit_cost,
        });
    }
    return headers.map((r) => ({
        id: String(r.id),
        number: grvNumber(r.id),
        supplierId: r.supplier_id == null ? "" : String(r.supplier_id),
        date: r.grn_date,
        paymentMethod: r.payment_method,
        items: byGrv[String(r.id)] ?? [],
        total: Number(r.total),
    }));
}

export async function addGRV(
    g: Omit<GRV, "id" | "number">,
    opts?: { purchaseOrderId?: string | null; supplierInvoiceNumber?: string | null },
): Promise<void> {
    const db = await open();
    const stamp = today();
    await db.withTransactionAsync(async () => {
        const res = await db.runAsync(
            `INSERT INTO g_r_v_s
          (supplier_id, purchase_order_id, grn_date, payment_method, total, supplier_invoicenumber, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            g.supplierId ? Number(g.supplierId) : null,
            opts?.purchaseOrderId ? Number(opts.purchaseOrderId) : null,
            g.date,
            g.paymentMethod,
            String(g.total),
            opts?.supplierInvoiceNumber ?? "",
            "published",
            stamp,
            stamp,
        );
        const grvId = res.lastInsertRowId;
        for (const it of g.items) {
            await db.runAsync(
                `INSERT INTO stocks
              (grv_id, product_id, product_name, measurement, quantity, unit_cost, total_cost, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                grvId,
                it.productId ? Number(it.productId) : null,
                it.name,
                it.unit,
                it.qty,
                it.unitCost,
                it.qty * it.unitCost,
                stamp,
                stamp,
            );
        }
    });
}

export async function deleteGRV(id: string): Promise<void> {
    const db = await open();
    // stocks rows are removed by the ON DELETE CASCADE foreign key.
    await db.runAsync("DELETE FROM g_r_v_s WHERE id = ?", Number(id));
}

// ---- Stock levels ----
// Available inventory is derived from the `stocks` ledger (rows written by
// GRVs), mirroring the Laravel backend which has no stock column on products
// and instead does SUM(stocks.quantity) per product and SUM(stocks.total_cost)
// for the overall value (see ApiController::stock). `received` is the quantity
// received into stock; `costValue` is its cumulative cost.

export type StockLevel = { received: number; costValue: number };

export async function getStockLevels(): Promise<Record<string, StockLevel>> {
    const db = await open();
    const rows = await db.getAllAsync<any>(
        `SELECT product_id,
                SUM(quantity)   AS received,
                SUM(total_cost) AS costValue
         FROM stocks
         WHERE product_id IS NOT NULL
         GROUP BY product_id`,
    );
    const map: Record<string, StockLevel> = {};
    for (const r of rows) {
        map[String(r.product_id)] = {
            received: Number(r.received) || 0,
            costValue: Number(r.costValue) || 0,
        };
    }
    return map;
}

export async function getTotalStockValue(): Promise<number> {
    const db = await open();
    const row = await db.getFirstAsync<{ v: number }>(
        "SELECT COALESCE(SUM(total_cost), 0) AS v FROM stocks",
    );
    return Number(row?.v ?? 0);
}

// ---- Purchase Orders ----
// The header maps onto the Laravel `purchase_orders` migration and each line
// item maps onto a `purchase_order_item` row (FK purchase_order_id), mirroring
// the backend. `product_id` on the line items is a local extension (the Laravel
// migration only stores product_name) so the mobile UI can reference products.
// The UI's `number` is derived from the row id (there is no number column);
// delivery_instructions/status use their migration defaults.

const poNumber = (id: number) => `PO-${1000 + id}`;

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
    const db = await open();
    const headers = await db.getAllAsync<any>(
        "SELECT * FROM purchase_orders ORDER BY id DESC",
    );
    const lines = await db.getAllAsync<any>(
        "SELECT * FROM purchase_order_item ORDER BY id ASC",
    );
    const byPo: Record<string, LineItem[]> = {};
    for (const l of lines) {
        const key = String(l.purchase_order_id);
        (byPo[key] ??= []).push({
            productId: l.product_id == null ? "" : String(l.product_id),
            name: l.product_name,
            unit: l.measurement,
            qty: l.quantity,
            unitCost: l.unit_cost,
        });
    }
    return headers.map((r) => ({
        id: String(r.id),
        number: poNumber(r.id),
        supplierId: r.supplier_id == null ? "" : String(r.supplier_id),
        date: r.purchaseorder_date,
        expectedDate: r.expected_date ?? "",
        paymentMethod: r.payment_method,
        invoiceNumber: r.supplier_invoicenumber ?? "",
        items: byPo[String(r.id)] ?? [],
        total: Number(r.total),
        status: r.status ?? "pending",
    }));
}

// Update a purchase order's status (e.g. 'pending' → 'received' when a GRV is
// created against it).
export async function updatePurchaseOrderStatus(id: string, status: string): Promise<void> {
    const db = await open();
    await db.runAsync(
        "UPDATE purchase_orders SET status = ?, updated_at = ? WHERE id = ?",
        status,
        today(),
        Number(id),
    );
}

export async function addPurchaseOrder(
    po: Omit<PurchaseOrder, "id" | "number">,
): Promise<void> {
    const db = await open();
    const stamp = today();
    await db.withTransactionAsync(async () => {
        const res = await db.runAsync(
            `INSERT INTO purchase_orders
          (supplier_id, purchaseorder_date, payment_method, expected_date, delivery_instructions, supplier_invoicenumber, total, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            po.supplierId ? Number(po.supplierId) : null,
            po.date,
            po.paymentMethod,
            po.expectedDate || null,
            "",
            po.invoiceNumber || null,
            po.total,
            "pending",
            stamp,
            stamp,
        );
        const poId = res.lastInsertRowId;
        for (const it of po.items) {
            await db.runAsync(
                `INSERT INTO purchase_order_item
              (purchase_order_id, product_id, product_name, measurement, quantity, unit_cost, total_cost, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                poId,
                it.productId ? Number(it.productId) : null,
                it.name,
                it.unit,
                it.qty,
                it.unitCost,
                it.qty * it.unitCost,
                stamp,
                stamp,
            );
        }
    });
}

export async function deletePurchaseOrder(id: string): Promise<void> {
    const db = await open();
    // purchase_order_item rows are removed by the ON DELETE CASCADE foreign key.
    await db.runAsync("DELETE FROM purchase_orders WHERE id = ?", Number(id));
}

// ---- Users / authentication ----
// Login accounts live in the `users` table. Admins/managers sign in with email
// + password; cashiers sign in with phone + a numeric passcode. Whichever
// credential applies is stored as a salted SHA-256 hash in the `password`
// column and never leaves the database (read models omit it). Email is null for
// cashiers; both email and phone are uniquely indexed when present.

const mapUser = (r: any): AppUser => ({
    id: String(r.id),
    name: r.name,
    email: r.email ?? null,
    phone: r.phone ?? null,
    role: r.role as UserRole,
    active: !!r.active,
});

const normEmail = (email?: string | null): string | null => {
    const v = (email ?? "").trim().toLowerCase();
    return v ? v : null;
};
const normPhone = (phone?: string | null): string | null => {
    const v = (phone ?? "").trim();
    return v ? v : null;
};

export async function getUsers(): Promise<AppUser[]> {
    const db = await open();
    const rows = await db.getAllAsync<any>(
        "SELECT id, name, email, phone, role, active FROM users ORDER BY id ASC",
    );
    return rows.map(mapUser);
}

export type NewUser = {
    name: string;
    email?: string | null;
    phone?: string | null;
    secret: string; // password for admin/manager, passcode for cashier
    role: UserRole;
    active?: boolean;
};

export async function createUser(u: NewUser): Promise<void> {
    const db = await open();
    const hashed = await hashPassword(u.secret);
    // UNIQUE indexes on email/phone surface a constraint error the caller can
    // translate into a friendly message.
    await db.runAsync(
        `INSERT INTO users (name, email, phone, password, role, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        u.name,
        normEmail(u.email),
        normPhone(u.phone),
        hashed,
        u.role,
        u.active === false ? 0 : 1,
        today(),
        today(),
    );
}

export type UserPatch = {
    name: string;
    email?: string | null;
    phone?: string | null;
    role: UserRole;
    active: boolean;
    secret?: string; // only updated when a non-empty value is supplied
};

export async function updateUser(id: string, u: UserPatch): Promise<void> {
    const db = await open();
    const email = normEmail(u.email);
    const phone = normPhone(u.phone);
    if (u.secret && u.secret.trim()) {
        const hashed = await hashPassword(u.secret);
        await db.runAsync(
            `UPDATE users SET name = ?, email = ?, phone = ?, role = ?, active = ?, password = ?, updated_at = ? WHERE id = ?`,
            u.name,
            email,
            phone,
            u.role,
            u.active ? 1 : 0,
            hashed,
            today(),
            Number(id),
        );
    } else {
        await db.runAsync(
            `UPDATE users SET name = ?, email = ?, phone = ?, role = ?, active = ?, updated_at = ? WHERE id = ?`,
            u.name,
            email,
            phone,
            u.role,
            u.active ? 1 : 0,
            today(),
            Number(id),
        );
    }
}

export async function deleteUser(id: string): Promise<void> {
    const db = await open();
    await db.runAsync("DELETE FROM users WHERE id = ?", Number(id));
}

export async function countAdmins(excludeId?: string): Promise<number> {
    const db = await open();
    const row = excludeId
        ? await db.getFirstAsync<{ c: number }>(
              "SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1 AND id != ?",
              Number(excludeId),
          )
        : await db.getFirstAsync<{ c: number }>(
              "SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND active = 1",
          );
    return row?.c ?? 0;
}

// Manager sign-in: email + password, scoped to the active shop. Global admins
// (owners) authenticate against the meta store instead (see meta.authenticateOwner);
// cashiers use phone + passcode below.
export async function authenticateManager(
    email: string,
    password: string,
): Promise<AppUser | null> {
    const db = await open();
    const row = await db.getFirstAsync<any>(
        "SELECT * FROM users WHERE email = ? AND role = 'manager'",
        normEmail(email),
    );
    if (!row || !row.active) return null;
    const ok = await verifyPassword(password, row.password);
    return ok ? mapUser(row) : null;
}

// Cashier sign-in: phone + numeric passcode. Only matches cashier accounts.
export async function authenticateCashier(
    phone: string,
    passcode: string,
): Promise<AppUser | null> {
    const db = await open();
    const row = await db.getFirstAsync<any>(
        "SELECT * FROM users WHERE phone = ? AND role = 'cashier'",
        normPhone(phone),
    );
    if (!row || !row.active) return null;
    const ok = await verifyPassword(passcode, row.password);
    return ok ? mapUser(row) : null;
}

// ---- Sales + Reports ----
// Sales are persisted when a cart is checked out. Reports are derived from the
// sales / sale_items ledger plus the stock ledger. Available stock is
// opening (product.stock) + received via GRVs - sold via sales.

export type SaleItemInput = {
    productId: string;
    name: string;
    categoryId?: string | null;
    qty: number;
    unitPrice: number;
};
export type SaleInput = {
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    change: number;
    paymentMethod: string;
    userId?: string | null;
    userName?: string | null;
    customerId?: string | null;
    items: SaleItemInput[];
};

// Persist a completed sale and its line items in one transaction. Returns the
// new sale id (used as the receipt/invoice number).
export async function recordSale(sale: SaleInput): Promise<number> {
    const db = await open();
    const stamp = now();
    let saleId = 0;
    await db.withTransactionAsync(async () => {
        const res = await db.runAsync(
            `INSERT INTO sales
          (subtotal, tax, total, amount_paid, change, payment_method, user_id, user_name, customer_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            sale.subtotal,
            sale.tax,
            sale.total,
            sale.amountPaid,
            sale.change,
            sale.paymentMethod,
            sale.userId ? Number(sale.userId) : null,
            sale.userName ?? null,
            sale.customerId ? Number(sale.customerId) : null,
            stamp,
        );
        saleId = res.lastInsertRowId;
        for (const it of sale.items) {
            await db.runAsync(
                `INSERT INTO sale_items
              (sale_id, product_id, product_name, category_id, quantity, unit_price, line_total)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                saleId,
                it.productId ? Number(it.productId) : null,
                it.name,
                it.categoryId ? Number(it.categoryId) : null,
                it.qty,
                it.unitPrice,
                it.qty * it.unitPrice,
            );
        }
    });
    return saleId;
}

export type SaleLine = { name: string; qty: number; unitPrice: number; lineTotal: number };
export type SaleRecord = {
    id: number;
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    change: number;
    paymentMethod: string;
    userName: string | null;
    createdAt: string;
    reversed: boolean;
    reversedAt: string | null;
    items: SaleLine[];
};

// List sales (newest first), optionally within an inclusive date range (yyyy-mm-dd).
// Each record carries its line items. Reversed sales are still returned so the
// Sales screen can show them flagged; totals/reports already exclude them.
export async function getSales(from?: string, to?: string): Promise<SaleRecord[]> {
    const db = await open();
    const where = from && to ? `WHERE ${dayClause} BETWEEN ? AND ?` : '';
    const params = from && to ? [from, to] : [];
    const sales = await db.getAllAsync<any>(
        `SELECT id, subtotal, tax, total, amount_paid, change, payment_method,
                user_name, created_at, reversed, reversed_at
         FROM sales ${where} ORDER BY id DESC`,
        ...params,
    );
    if (sales.length === 0) return [];
    const ids = sales.map((s) => s.id);
    const placeholders = ids.map(() => '?').join(',');
    const items = await db.getAllAsync<any>(
        `SELECT sale_id, product_name, quantity, unit_price, line_total
         FROM sale_items WHERE sale_id IN (${placeholders})`,
        ...ids,
    );
    const byId: Record<number, SaleLine[]> = {};
    for (const it of items) {
        (byId[it.sale_id] ||= []).push({
            name: it.product_name,
            qty: Number(it.quantity) || 0,
            unitPrice: Number(it.unit_price) || 0,
            lineTotal: Number(it.line_total) || 0,
        });
    }
    return sales.map((s) => ({
        id: s.id,
        subtotal: Number(s.subtotal) || 0,
        tax: Number(s.tax) || 0,
        total: Number(s.total) || 0,
        amountPaid: Number(s.amount_paid) || 0,
        change: Number(s.change) || 0,
        paymentMethod: s.payment_method,
        userName: s.user_name ?? null,
        createdAt: s.created_at,
        reversed: !!s.reversed,
        reversedAt: s.reversed_at ?? null,
        items: byId[s.id] ?? [],
    }));
}

// Reverse (void) a sale. It stays in the ledger flagged as reversed, so it drops
// out of stock-sold totals (restoring available stock) and out of reports.
export async function reverseSale(saleId: number): Promise<void> {
    const db = await open();
    await db.runAsync(
        `UPDATE sales SET reversed = 1, reversed_at = ? WHERE id = ?`,
        now(),
        saleId,
    );
}

// Total quantity sold per product id (used to net down available stock).
export async function getSoldQuantities(): Promise<Record<string, number>> {
    const db = await open();
    const rows = await db.getAllAsync<any>(
        `SELECT si.product_id AS product_id, SUM(si.quantity) AS sold
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE si.product_id IS NOT NULL AND s.reversed = 0
         GROUP BY si.product_id`,
    );
    const map: Record<string, number> = {};
    for (const r of rows) map[String(r.product_id)] = Number(r.sold) || 0;
    return map;
}

// ---- Manual stock adjustments (product list: Add Stock / Write Off) ----
// These move the product's on-hand quantity directly and log why in
// `stock_adjustments` for an audit trail. Add increases stock; write-off
// decreases it (never below zero).

export async function addStock(productId: string, quantity: number, note?: string): Promise<void> {
    if (!(quantity > 0)) return;
    const db = await open();
    await db.withTransactionAsync(async () => {
        await db.runAsync(
            `INSERT INTO stock_adjustments (product_id, type, quantity, note, created_at)
             VALUES (?, 'add', ?, ?, ?)`,
            Number(productId),
            quantity,
            note ?? null,
            now(),
        );
        await db.runAsync(
            'UPDATE products SET stock = stock + ? WHERE id = ?',
            quantity,
            Number(productId),
        );
    });
}

export async function writeOffStock(productId: string, quantity: number, note?: string): Promise<void> {
    if (!(quantity > 0)) return;
    const db = await open();
    await db.withTransactionAsync(async () => {
        await db.runAsync(
            `INSERT INTO stock_adjustments (product_id, type, quantity, note, created_at)
             VALUES (?, 'writeoff', ?, ?, ?)`,
            Number(productId),
            quantity,
            note ?? null,
            now(),
        );
        await db.runAsync(
            'UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?',
            quantity,
            Number(productId),
        );
    });
}

// ---- App settings (key/value) ----
// These are device-level, not per-shop (licence token, display currency), so
// they live in the shared meta store rather than any single shop's file. The
// signatures are unchanged, so existing callers (LicenseContext, DataContext)
// keep working across shop switches.

export async function getAppSettings(): Promise<Record<string, string>> {
    return getMetaSettings();
}

export async function setAppSetting(key: string, value: string): Promise<void> {
    return setMetaSetting(key, value);
}

// ---- Report queries ----

export type ValuationRow = {
    name: string;
    sku: string;
    qty: number;
    cost: number;
    price: number;
    costValue: number;
    retailValue: number;
};
export type InventoryValuation = {
    rows: ValuationRow[];
    totalCost: number;
    totalRetail: number;
};

export async function getInventoryValuation(): Promise<InventoryValuation> {
    const [products, levels, sold] = await Promise.all([
        getProducts(),
        getStockLevels(),
        getSoldQuantities(),
    ]);
    const rows: ValuationRow[] = products.map((p) => {
        const qty = p.stock + (levels[p.id]?.received ?? 0) - (sold[p.id] ?? 0);
        return {
            name: p.name,
            sku: p.sku,
            qty,
            cost: p.cost,
            price: p.price,
            costValue: qty * p.cost,
            retailValue: qty * p.price,
        };
    });
    return {
        rows,
        totalCost: rows.reduce((n, r) => n + r.costValue, 0),
        totalRetail: rows.reduce((n, r) => n + r.retailValue, 0),
    };
}

export type StockRow = {
    name: string;
    sku: string;
    qty: number;
    reorderLevel: number;
    low: boolean;
};

export async function getStockReport(): Promise<StockRow[]> {
    const [products, levels, sold] = await Promise.all([
        getProducts(),
        getStockLevels(),
        getSoldQuantities(),
    ]);
    return products
        .map((p) => {
            const qty = p.stock + (levels[p.id]?.received ?? 0) - (sold[p.id] ?? 0);
            return { name: p.name, sku: p.sku, qty, reorderLevel: p.reorderLevel, low: qty <= p.reorderLevel };
        })
        .sort((a, b) => Number(b.low) - Number(a.low) || a.qty - b.qty);
}

// A day filter: created_at is a full ISO timestamp, so compare the date prefix.
const dayClause = 'substr(created_at, 1, 10)';

export type SalesByProductRow = { name: string; qty: number; revenue: number };
export async function getSalesByProduct(
    from: string,
    to: string,
): Promise<{ rows: SalesByProductRow[]; totalQty: number; totalRevenue: number }> {
    const db = await open();
    const rows = await db.getAllAsync<any>(
        `SELECT si.product_name AS name, SUM(si.quantity) AS qty, SUM(si.line_total) AS revenue
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE substr(s.created_at, 1, 10) BETWEEN ? AND ? AND s.reversed = 0
         GROUP BY si.product_name
         ORDER BY revenue DESC`,
        from,
        to,
    );
    const mapped: SalesByProductRow[] = rows.map((r) => ({
        name: r.name,
        qty: Number(r.qty) || 0,
        revenue: Number(r.revenue) || 0,
    }));
    return {
        rows: mapped,
        totalQty: mapped.reduce((n, r) => n + r.qty, 0),
        totalRevenue: mapped.reduce((n, r) => n + r.revenue, 0),
    };
}

export type TaxReport = {
    net: number;
    tax: number;
    gross: number;
    transactions: number;
};
export async function getTaxReport(from: string, to: string): Promise<TaxReport> {
    const db = await open();
    const row = await db.getFirstAsync<any>(
        `SELECT COALESCE(SUM(subtotal),0) AS net, COALESCE(SUM(tax),0) AS tax,
                COALESCE(SUM(total),0) AS gross, COUNT(*) AS n
         FROM sales WHERE ${dayClause} BETWEEN ? AND ? AND reversed = 0`,
        from,
        to,
    );
    return {
        net: Number(row?.net) || 0,
        tax: Number(row?.tax) || 0,
        gross: Number(row?.gross) || 0,
        transactions: Number(row?.n) || 0,
    };
}

export type ZReport = {
    date: string;
    transactions: number;
    net: number;
    tax: number;
    gross: number;
    byPayment: { method: string; total: number; count: number }[];
    byCashier: { name: string; total: number; count: number }[];
};
export async function getZReport(date: string): Promise<ZReport> {
    const db = await open();
    const totals = await db.getFirstAsync<any>(
        `SELECT COUNT(*) AS n, COALESCE(SUM(subtotal),0) AS net,
                COALESCE(SUM(tax),0) AS tax, COALESCE(SUM(total),0) AS gross
         FROM sales WHERE ${dayClause} = ? AND reversed = 0`,
        date,
    );
    const byPayment = await db.getAllAsync<any>(
        `SELECT payment_method AS method, COALESCE(SUM(total),0) AS total, COUNT(*) AS count
         FROM sales WHERE ${dayClause} = ? AND reversed = 0 GROUP BY payment_method`,
        date,
    );
    const byCashier = await db.getAllAsync<any>(
        `SELECT COALESCE(user_name,'Unknown') AS name, COALESCE(SUM(total),0) AS total, COUNT(*) AS count
         FROM sales WHERE ${dayClause} = ? AND reversed = 0 GROUP BY user_name`,
        date,
    );
    return {
        date,
        transactions: Number(totals?.n) || 0,
        net: Number(totals?.net) || 0,
        tax: Number(totals?.tax) || 0,
        gross: Number(totals?.gross) || 0,
        byPayment: byPayment.map((r) => ({ method: r.method, total: Number(r.total) || 0, count: Number(r.count) || 0 })),
        byCashier: byCashier.map((r) => ({ name: r.name, total: Number(r.total) || 0, count: Number(r.count) || 0 })),
    };
}
