import * as SQLite from "expo-sqlite";
import { hashPassword, verifyPassword } from "@/lib/hash";
import type { AppUser } from "@/data/mockData";

// Global "meta" store, shared by every shop on the device. Multi-shop support
// keeps all domain data (products, sales, staff, …) in a SEPARATE SQLite file
// per shop (see src/db/db.ts). This meta database is the one thing that spans
// all shops:
//   • `shops`         — the registry of shops and which file backs each one.
//   • `owners`        — the global admin account(s). One owner signs in once and
//                       can switch between shops, even though each shop has its
//                       own (per-shop) managers and cashiers.
//   • `meta_settings` — device-level key/value settings: the active shop id, the
//                       licence token, and the display currency. These must NOT
//                       live in a per-shop file or switching shops would lose
//                       them.

const LEGACY_DB = "electronpos.db"; // the single-shop file used before multi-shop

let metaPromise: Promise<SQLite.SQLiteDatabase> | null = null;
function openMeta() {
    if (!metaPromise) metaPromise = SQLite.openDatabaseAsync("pos_meta.db");
    return metaPromise;
}

// Close the meta connection so its file can be overwritten (used by restore).
// The next call to openMeta() reopens it.
export async function closeMeta(): Promise<void> {
    if (!metaPromise) return;
    try {
        const db = await metaPromise;
        await db.closeAsync();
    } catch {
        /* already closed */
    }
    metaPromise = null;
}

const today = () => new Date().toISOString().slice(0, 10);

const normEmail = (email?: string | null): string | null => {
    const v = (email ?? "").trim().toLowerCase();
    return v ? v : null;
};
const normPhone = (phone?: string | null): string | null => {
    const v = (phone ?? "").trim();
    return v ? v : null;
};

export type Shop = {
    id: string;
    name: string;
    address: string;
    phone: string;
    dbFile: string;
    isDefault: boolean;
    createdAt: string;
};

const mapShop = (r: any): Shop => ({
    id: String(r.id),
    name: r.name,
    address: r.address ?? "",
    phone: r.phone ?? "",
    dbFile: r.db_file,
    isDefault: !!r.is_default,
    createdAt: r.created_at,
});

// ---- Initialisation + migration ----

export async function initMeta(): Promise<void> {
    const db = await openMeta();
    await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS shops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      db_file TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      password TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_owners_email ON owners(email) WHERE email IS NOT NULL;
    CREATE TABLE IF NOT EXISTS meta_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
    await migrateFromLegacy(db);
    await ensureSeedOwner(db);
}

// First run of the multi-shop build: register the existing single-shop database
// as "Main Shop", lift its admin accounts up to global owners, and move the
// device-level settings (licence, currency) into the meta store. Runs once —
// guarded by the shops table being empty.
async function migrateFromLegacy(db: SQLite.SQLiteDatabase): Promise<void> {
    const row = await db.getFirstAsync<{ c: number }>(
        "SELECT COUNT(*) AS c FROM shops",
    );
    if ((row?.c ?? 0) > 0) return;

    const res = await db.runAsync(
        "INSERT INTO shops (name, address, phone, db_file, is_default, created_at) VALUES (?, ?, ?, ?, 1, ?)",
        "Main Shop",
        "",
        "",
        LEGACY_DB,
        today(),
    );
    const shopId = res.lastInsertRowId;
    await setMetaSetting("active_shop_id", String(shopId));

    // Pull owners + settings out of the legacy file if it already has data.
    try {
        const legacy = await SQLite.openDatabaseAsync(LEGACY_DB);
        try {
            const admins = await legacy.getAllAsync<any>(
                "SELECT name, email, phone, password FROM users WHERE role = 'admin'",
            );
            for (const a of admins) {
                try {
                    await db.runAsync(
                        `INSERT INTO owners (name, email, phone, password, active, created_at, updated_at)
                         VALUES (?, ?, ?, ?, 1, ?, ?)`,
                        a.name,
                        normEmail(a.email),
                        normPhone(a.phone),
                        a.password,
                        today(),
                        today(),
                    );
                } catch {
                    /* duplicate email — ignore */
                }
            }
            // Owners are global now; drop the admin logins from the shop file so
            // they aren't shown as (unusable) shop staff.
            await legacy.execAsync("DELETE FROM users WHERE role = 'admin'");
        } catch {
            /* no users table yet (fresh install) */
        }
        try {
            const settings = await legacy.getAllAsync<{ key: string; value: string }>(
                "SELECT key, value FROM app_settings",
            );
            for (const st of settings) await setMetaSetting(st.key, st.value);
        } catch {
            /* no app_settings yet */
        }
    } catch {
        /* legacy file unavailable — nothing to migrate */
    }
}

// Guarantee at least one owner exists, so the app is never locked out. Mirrors
// the demo admin the single-shop build seeded.
async function ensureSeedOwner(db: SQLite.SQLiteDatabase): Promise<void> {
    const row = await db.getFirstAsync<{ c: number }>(
        "SELECT COUNT(*) AS c FROM owners",
    );
    if ((row?.c ?? 0) > 0) return;
    const hashed = await hashPassword("admin123");
    await db.runAsync(
        `INSERT INTO owners (name, email, phone, password, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        "Administrator",
        "admin@electronpos.co.zw",
        "+263771234567",
        hashed,
        today(),
        today(),
    );
}

// ---- Meta settings (device-level key/value) ----

export async function getMetaSettings(): Promise<Record<string, string>> {
    const db = await openMeta();
    const rows = await db.getAllAsync<{ key: string; value: string }>(
        "SELECT key, value FROM meta_settings",
    );
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
}

export async function setMetaSetting(key: string, value: string): Promise<void> {
    const db = await openMeta();
    await db.runAsync(
        `INSERT INTO meta_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        key,
        value,
    );
}

// ---- Shops registry ----

export async function listShops(): Promise<Shop[]> {
    const db = await openMeta();
    const rows = await db.getAllAsync<any>(
        "SELECT * FROM shops ORDER BY id ASC",
    );
    return rows.map(mapShop);
}

export async function getShop(id: string): Promise<Shop | null> {
    const db = await openMeta();
    const row = await db.getFirstAsync<any>(
        "SELECT * FROM shops WHERE id = ?",
        Number(id),
    );
    return row ? mapShop(row) : null;
}

// The active shop id, falling back to the default shop (then the first shop) if
// nothing is set yet.
export async function getActiveShopId(): Promise<string | null> {
    const settings = await getMetaSettings();
    const shops = await listShops();
    if (shops.length === 0) return null;
    const saved = settings["active_shop_id"];
    if (saved && shops.some((s) => s.id === saved)) return saved;
    const def = shops.find((s) => s.isDefault) ?? shops[0];
    return def.id;
}

export async function setActiveShop(id: string): Promise<void> {
    await setMetaSetting("active_shop_id", id);
}

export async function setDefaultShop(id: string): Promise<void> {
    const db = await openMeta();
    await db.execAsync("UPDATE shops SET is_default = 0");
    await db.runAsync("UPDATE shops SET is_default = 1 WHERE id = ?", Number(id));
}

// Create a new shop. Its data file is `shop_<id>.db`; the file itself is created
// and seeded the first time the app opens it (see db.initDb).
export async function createShop(input: {
    name: string;
    address?: string;
    phone?: string;
}): Promise<Shop> {
    const db = await openMeta();
    const res = await db.runAsync(
        "INSERT INTO shops (name, address, phone, db_file, is_default, created_at) VALUES (?, ?, ?, ?, 0, ?)",
        input.name.trim(),
        input.address?.trim() ?? "",
        input.phone?.trim() ?? "",
        "",
        today(),
    );
    const id = res.lastInsertRowId;
    const file = `shop_${id}.db`;
    await db.runAsync("UPDATE shops SET db_file = ? WHERE id = ?", file, id);
    return (await getShop(String(id)))!;
}

export async function deleteShop(id: string): Promise<void> {
    const shop = await getShop(id);
    const db = await openMeta();
    await db.runAsync("DELETE FROM shops WHERE id = ?", Number(id));
    // Best-effort removal of the shop's data file (never the shared legacy file).
    if (shop && shop.dbFile && shop.dbFile !== LEGACY_DB) {
        try {
            await SQLite.deleteDatabaseAsync(shop.dbFile);
        } catch {
            /* file may be open elsewhere — leave it */
        }
    }
}

// ---- Owner authentication (global admins) ----

const mapOwner = (r: any): AppUser => ({
    id: String(r.id),
    name: r.name,
    email: r.email ?? null,
    phone: r.phone ?? null,
    role: "admin",
    active: !!r.active,
});

export async function authenticateOwner(
    email: string,
    password: string,
): Promise<AppUser | null> {
    const db = await openMeta();
    const row = await db.getFirstAsync<any>(
        "SELECT * FROM owners WHERE email = ?",
        normEmail(email),
    );
    if (!row || !row.active) return null;
    const ok = await verifyPassword(password, row.password);
    return ok ? mapOwner(row) : null;
}

export async function countOwners(excludeId?: string): Promise<number> {
    const db = await openMeta();
    const row = excludeId
        ? await db.getFirstAsync<{ c: number }>(
              "SELECT COUNT(*) AS c FROM owners WHERE active = 1 AND id != ?",
              Number(excludeId),
          )
        : await db.getFirstAsync<{ c: number }>(
              "SELECT COUNT(*) AS c FROM owners WHERE active = 1",
          );
    return row?.c ?? 0;
}

// Owner self-registration (the "Register" link on the sign-in screen). Creates
// an active global owner and returns it.
export async function registerOwner(input: {
    name: string;
    email: string;
    phone?: string | null;
    password: string;
}): Promise<AppUser> {
    const db = await openMeta();
    const hashed = await hashPassword(input.password);
    await db.runAsync(
        `INSERT INTO owners (name, email, phone, password, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        input.name.trim(),
        normEmail(input.email),
        normPhone(input.phone),
        hashed,
        today(),
        today(),
    );
    const row = await db.getFirstAsync<any>(
        "SELECT * FROM owners WHERE email = ?",
        normEmail(input.email),
    );
    return mapOwner(row);
}
