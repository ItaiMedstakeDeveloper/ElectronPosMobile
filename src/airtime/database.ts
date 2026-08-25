import * as SQLite from "expo-sqlite";

export interface Agent {
  id?: number;
  name: string; // legacy column, no longer collected (stored as "")
  phone_number: string; // Customer Number
  agent_id: string; // National ID / Passport Number
  signing: string; // Transaction Type (Cash In / Cash Out)
  address: string; // legacy column, no longer collected (stored as "")
  signature: string; // Drawing data (serialized SVG path or base64 data)
  txn_date?: string; // Transaction date (ISO yyyy-mm-dd)
  reference_number?: string; // Transaction / Reference number
  created_at?: string;
}

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync("scannit.db");

    // Create the agents table if it doesn't exist
    await dbInstance.execAsync(`
      CREATE TABLE IF NOT EXISTS agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        signing TEXT NOT NULL,
        address TEXT NOT NULL,
        signature TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS saved_cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_number TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ecocash_agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS usage_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        network TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mobile_agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        network TEXT NOT NULL,
        location TEXT,
        merchant_code TEXT,
        ussd_prefix TEXT,
        created_at TEXT NOT NULL,
        is_favorite INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session (
        id INTEGER PRIMARY KEY DEFAULT 1,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS saved_payees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        biller_id TEXT NOT NULL,
        label TEXT NOT NULL,
        account_number TEXT NOT NULL,
        default_amount TEXT,
        last_amount TEXT,
        last_paid_at TEXT,
        is_favorite INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inventory_stock (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        network TEXT NOT NULL,
        denomination REAL NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        unit_cost REAL NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        UNIQUE(network, denomination)
      );
      CREATE TABLE IF NOT EXISTS inventory_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        network TEXT NOT NULL,
        denomination REAL NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0,
        user_name TEXT,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS inventory_stock_additions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        network TEXT NOT NULL,
        denomination REAL NOT NULL,
        quantity INTEGER NOT NULL,
        unit_cost REAL NOT NULL DEFAULT 0,
        user_name TEXT,
        created_at TEXT NOT NULL
      );

      -- Keep dated / per-network sales lookups fast as history grows.
      CREATE INDEX IF NOT EXISTS idx_inv_sales_created
        ON inventory_sales(created_at);
      CREATE INDEX IF NOT EXISTS idx_inv_sales_network_created
        ON inventory_sales(network, created_at);
    `);

    // `user_name` was added after the first inventory release; backfill the
    // column for installs that created inventory_sales before this version.
    try {
      await dbInstance.execAsync(
        `ALTER TABLE inventory_sales ADD COLUMN user_name TEXT;`,
      );
    } catch (e) {
      // Column might already exist
    }

    try {
      await dbInstance.execAsync(
        `ALTER TABLE mobile_agents ADD COLUMN is_favorite INTEGER DEFAULT 0;`,
      );
    } catch (e) {
      // Column might already exist
    }

    try {
      await dbInstance.execAsync(
        `ALTER TABLE mobile_agents ADD COLUMN merchant_code TEXT;`,
      );
    } catch (e) {
      // Column might already exist
    }

    try {
      await dbInstance.execAsync(
        `ALTER TABLE mobile_agents ADD COLUMN ussd_prefix TEXT;`,
      );
    } catch (e) {
      // Column might already exist
    }

    try {
      await dbInstance.execAsync(
        `ALTER TABLE agents ADD COLUMN txn_date TEXT;`,
      );
    } catch (e) {
      // Column might already exist
    }

    try {
      await dbInstance.execAsync(
        `ALTER TABLE agents ADD COLUMN reference_number TEXT;`,
      );
    } catch (e) {
      // Column might already exist
    }
  }
  return dbInstance;
}

export interface AppUser {
  id?: number;
  role: "agent" | "customer";
  name: string;
  phone_number: string;
  created_at?: string;
}

export interface AppSession {
  role: "agent" | "customer";
  name: string;
  phone_number: string;
}

export async function registerUser(
  role: "agent" | "customer",
  name: string,
  phoneNumber: string,
): Promise<void> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO users (role, name, phone_number, created_at) VALUES (?, ?, ?, ?)",
    [role, name, phoneNumber, createdAt],
  );
}

export async function checkUserExists(
  role: "agent" | "customer",
  name: string,
  phoneNumber: string,
): Promise<boolean> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: number }>(
    "SELECT id FROM users WHERE role = ? AND name = ? AND phone_number = ? LIMIT 1",
    [role, name, phoneNumber],
  );
  return rows.length > 0;
}

export async function createSession(
  role: "agent" | "customer",
  name: string,
  phoneNumber: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM session");
  await db.runAsync(
    "INSERT INTO session (id, role, name, phone_number) VALUES (1, ?, ?, ?)",
    [role, name, phoneNumber],
  );
}

export async function getSession(): Promise<AppSession | null> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<AppSession>(
    "SELECT role, name, phone_number FROM session WHERE id = 1",
  );
  return rows.length > 0 ? rows[0] : null;
}

export async function clearSession(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM session");
}

/**
 * Add a new agent to the database.
 */
export async function addAgent(agent: Omit<Agent, "id">): Promise<void> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO agents (name, phone_number, agent_id, signing, address, signature, txn_date, reference_number, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      agent.name,
      agent.phone_number,
      agent.agent_id,
      agent.signing,
      agent.address,
      agent.signature,
      agent.txn_date || "",
      agent.reference_number || "",
      createdAt,
    ],
  );
}

/**
 * Fetch all agents from the database.
 */
export async function getAgents(): Promise<Agent[]> {
  const db = await getDatabase();
  return await db.getAllAsync<Agent>("SELECT * FROM agents ORDER BY id DESC");
}

/**
 * Delete an agent by ID.
 */
export async function deleteAgent(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM agents WHERE id = ?", [id]);
}

export interface SavedCard {
  id: number;
  card_number: string;
  created_at: string;
}

export interface EcocashAgent {
  id?: number;
  name: string;
  code: string;
  created_at?: string;
}

/**
 * Save a juice card number.
 */
export async function addSavedCard(cardNumber: string): Promise<void> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO saved_cards (card_number, created_at) VALUES (?, ?)",
    [cardNumber, createdAt],
  );
}

/**
 * Fetch all saved juice cards.
 */

export async function getSavedCards(): Promise<SavedCard[]> {
  const db = await getDatabase();
  return await db.getAllAsync<SavedCard>(
    "SELECT * FROM saved_cards ORDER BY id DESC",
  );
}

/**
 * Delete a saved juice card.
 */

export async function deleteSavedCard(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM saved_cards WHERE id = ?", [id]);
}

/**
 * Add a new ecocash agent to the database.
 */
export async function addEcocashAgent(
  agent: Omit<EcocashAgent, "id">,
): Promise<void> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO ecocash_agents (name, code, created_at) VALUES (?, ?, ?)",
    [agent.name, agent.code, createdAt],
  );
}

/**
 * Fetch all ecocash agents from the database.
 */
export async function getEcocashAgents(): Promise<EcocashAgent[]> {
  const db = await getDatabase();
  return await db.getAllAsync<EcocashAgent>(
    "SELECT * FROM ecocash_agents ORDER BY id DESC",
  );
}

/**
 * Delete an ecocash agent by ID.
 */
export async function deleteEcocashAgent(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM ecocash_agents WHERE id = ?", [id]);
}

export interface UsageRecord {
  id: number;
  network: string;
  created_at: string;
}

/**
 * Log airtime usage for a network.
 */
export async function logUsage(network: string): Promise<void> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO usage_history (network, created_at) VALUES (?, ?)",
    [network, createdAt],
  );
}

/**
 * Fetch all usage history.
 */
export async function getUsageHistory(): Promise<UsageRecord[]> {
  const db = await getDatabase();
  return await db.getAllAsync<UsageRecord>(
    "SELECT * FROM usage_history ORDER BY id DESC",
  );
}

export interface MobileAgent {
  id?: number;
  name: string;
  phone_number: string;
  network: string;
  location?: string;
  merchant_code?: string;
  ussd_prefix?: string;
  created_at?: string;
  is_favorite?: number;
}

/**
 * Add a new mobile agent.
 */
export async function addMobileAgent(
  agent: Omit<MobileAgent, "id">,
): Promise<void> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO mobile_agents (name, phone_number, network, location, merchant_code, ussd_prefix, created_at, is_favorite) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      agent.name,
      agent.phone_number,
      agent.network,
      agent.location || "",
      agent.merchant_code || "",
      agent.ussd_prefix || "",
      createdAt,
      agent.is_favorite || 0,
    ],
  );
}

/**
 * Fetch all mobile agents.
 */
export async function getMobileAgents(): Promise<MobileAgent[]> {
  const db = await getDatabase();
  return await db.getAllAsync<MobileAgent>(
    "SELECT * FROM mobile_agents ORDER BY id DESC",
  );
}

/**
 * Update an existing mobile agent.
 */
export async function updateMobileAgent(
  id: number,
  agent: Omit<MobileAgent, "id">,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE mobile_agents SET name = ?, phone_number = ?, network = ?, location = ?, merchant_code = ?, ussd_prefix = ?, is_favorite = ? WHERE id = ?",
    [
      agent.name,
      agent.phone_number,
      agent.network,
      agent.location || "",
      agent.merchant_code || "",
      agent.ussd_prefix || "",
      agent.is_favorite || 0,
      id,
    ],
  );
}

/**
 * Toggle favorite status of a mobile agent.
 */
export async function toggleFavoriteMobileAgent(
  id: number,
  isFavorite: number,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE mobile_agents SET is_favorite = ? WHERE id = ?", [
    isFavorite,
    id,
  ]);
}

/**
 * Delete a mobile agent by ID.
 */
export async function deleteMobileAgent(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM mobile_agents WHERE id = ?", [id]);
}

/**
 * A saved bill-payment account (e.g. a ZESA meter, DSTV smartcard).
 * `biller_id` groups payees per biller ("zesa", "dstv", ...) so the same
 * table serves every biller on the Payments screen.
 */
export interface SavedPayee {
  id: number;
  biller_id: string;
  label: string; // friendly nickname e.g. "Home meter"
  account_number: string; // meter / smartcard / policy number
  default_amount?: string;
  last_amount?: string;
  last_paid_at?: string;
  is_favorite?: number;
  created_at: string;
}

/**
 * Save a payee (meter/account) for a biller so it can be reused with one tap.
 */
export async function addSavedPayee(payee: {
  biller_id: string;
  label: string;
  account_number: string;
  default_amount?: string;
}): Promise<void> {
  const db = await getDatabase();
  const createdAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO saved_payees (biller_id, label, account_number, default_amount, is_favorite, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [
      payee.biller_id,
      payee.label,
      payee.account_number,
      payee.default_amount || "",
      createdAt,
    ],
  );
}

/**
 * Fetch saved payees for a biller (favorites first, then most recent).
 */
export async function getSavedPayees(billerId: string): Promise<SavedPayee[]> {
  const db = await getDatabase();
  return await db.getAllAsync<SavedPayee>(
    "SELECT * FROM saved_payees WHERE biller_id = ? ORDER BY is_favorite DESC, id DESC",
    [billerId],
  );
}

/**
 * Record the amount/time of the most recent payment to a payee, so the UI can
 * offer a "repeat last payment" shortcut.
 */
export async function recordPayeePayment(
  id: number,
  amount: string,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE saved_payees SET last_amount = ?, last_paid_at = ? WHERE id = ?",
    [amount, new Date().toISOString(), id],
  );
}

/**
 * Toggle favorite status of a saved payee.
 */
export async function toggleFavoritePayee(
  id: number,
  isFavorite: number,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE saved_payees SET is_favorite = ? WHERE id = ?", [
    isFavorite,
    id,
  ]);
}

/**
 * Delete a saved payee by ID.
 */
export async function deleteSavedPayee(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM saved_payees WHERE id = ?", [id]);
}

/* ------------------------------------------------------------------ */
/* Airtime inventory (mini POS)                                        */
/* ------------------------------------------------------------------ */

/** Networks an airtime reseller stocks cards for. */
export const INVENTORY_NETWORKS = ["econet", "netone"] as const;
export type InventoryNetwork = (typeof INVENTORY_NETWORKS)[number];

/** Face-value denominations cards can be added/sold in (USD). */
export const DENOMINATIONS = [0.5, 1, 2, 5, 10, 20] as const;

export interface StockRow {
  id: number;
  network: string;
  denomination: number;
  quantity: number;
  /** Weighted-average buy price per card, used for profit reporting. */
  unit_cost: number;
  updated_at: string;
}

export interface SaleRow {
  id: number;
  network: string;
  denomination: number;
  quantity: number;
  /** Price the card was sold at (defaults to face value). */
  unit_price: number;
  /** Snapshot of the card's cost at sale time, for profit reporting. */
  unit_cost: number;
  /** Name of the user who recorded the sale (from the active session). */
  user_name: string | null;
  created_at: string;
}

export interface StockAddition {
  id: number;
  network: string;
  denomination: number;
  quantity: number;
  unit_cost: number;
  /** Name of the user who added the stock (from the active session). */
  user_name: string | null;
  created_at: string;
}

/**
 * Add (restock) cards. Upserts the (network, denomination) row, increasing the
 * quantity and rolling the buy price into a weighted-average unit cost so that
 * profit stays accurate across restocks bought at different prices. Every
 * addition is also written to `inventory_stock_additions` as an audit record.
 */
export async function addStock(
  network: string,
  denomination: number,
  quantity: number,
  unitCost: number = 0,
  userName: string | null = null,
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  // Audit trail of every addition (for stock-addition reports / history).
  await db.runAsync(
    "INSERT INTO inventory_stock_additions (network, denomination, quantity, unit_cost, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    [network, denomination, quantity, unitCost, userName, now],
  );

  const existing = await db.getAllAsync<StockRow>(
    "SELECT * FROM inventory_stock WHERE network = ? AND denomination = ? LIMIT 1",
    [network, denomination],
  );
  if (existing.length === 0) {
    await db.runAsync(
      "INSERT INTO inventory_stock (network, denomination, quantity, unit_cost, updated_at) VALUES (?, ?, ?, ?, ?)",
      [network, denomination, quantity, unitCost, now],
    );
    return;
  }
  const row = existing[0];
  const newQty = row.quantity + quantity;
  const newCost =
    newQty > 0
      ? (row.quantity * row.unit_cost + quantity * unitCost) / newQty
      : unitCost;
  await db.runAsync(
    "UPDATE inventory_stock SET quantity = ?, unit_cost = ?, updated_at = ? WHERE id = ?",
    [newQty, newCost, now, row.id],
  );
}

/** Fetch the stock-addition audit history, newest first. */
export async function getStockAdditions(
  network?: string,
): Promise<StockAddition[]> {
  const db = await getDatabase();
  if (network) {
    return db.getAllAsync<StockAddition>(
      "SELECT * FROM inventory_stock_additions WHERE network = ? ORDER BY id DESC",
      [network],
    );
  }
  return db.getAllAsync<StockAddition>(
    "SELECT * FROM inventory_stock_additions ORDER BY id DESC",
  );
}

/** Fetch current stock, optionally for a single network. */
export async function getStock(network?: string): Promise<StockRow[]> {
  const db = await getDatabase();
  if (network) {
    return db.getAllAsync<StockRow>(
      "SELECT * FROM inventory_stock WHERE network = ? ORDER BY denomination ASC",
      [network],
    );
  }
  return db.getAllAsync<StockRow>(
    "SELECT * FROM inventory_stock ORDER BY network ASC, denomination ASC",
  );
}

/**
 * Sell airtime: deduct from stock and record the sale. Throws if there is not
 * enough stock of that denomination to cover the quantity.
 */
export async function sellStock(
  network: string,
  denomination: number,
  quantity: number,
  unitPrice: number,
  userName: string | null = null,
): Promise<void> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<StockRow>(
    "SELECT * FROM inventory_stock WHERE network = ? AND denomination = ? LIMIT 1",
    [network, denomination],
  );
  const row = rows[0];
  if (!row || row.quantity < quantity) {
    throw new Error("Not enough stock for this sale.");
  }
  const now = new Date().toISOString();
  await db.runAsync(
    "UPDATE inventory_stock SET quantity = ?, updated_at = ? WHERE id = ?",
    [row.quantity - quantity, now, row.id],
  );
  await db.runAsync(
    "INSERT INTO inventory_sales (network, denomination, quantity, unit_price, unit_cost, user_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [network, denomination, quantity, unitPrice, row.unit_cost, userName, now],
  );
}

/**
 * Fetch recorded sales, newest first. All filters are optional and applied at
 * the SQL level so the caller never has to pull the whole table into memory:
 *   - `network`  restrict to one network
 *   - `sinceIso` / `untilIso` inclusive created_at bounds (ISO strings)
 *   - `limit`    cap the number of rows returned (for the "recent" view)
 * Called with no options it returns every sale (used by the reports screen).
 */
export async function getSales(opts: {
  network?: string;
  sinceIso?: string;
  untilIso?: string;
  limit?: number;
} = {}): Promise<SaleRow[]> {
  const db = await getDatabase();
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.network) {
    where.push("network = ?");
    params.push(opts.network);
  }
  if (opts.sinceIso) {
    where.push("created_at >= ?");
    params.push(opts.sinceIso);
  }
  if (opts.untilIso) {
    where.push("created_at <= ?");
    params.push(opts.untilIso);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const limitSql =
    opts.limit && opts.limit > 0 ? `LIMIT ${Math.floor(opts.limit)}` : "";
  return db.getAllAsync<SaleRow>(
    `SELECT * FROM inventory_sales ${whereSql} ORDER BY id DESC ${limitSql}`.trim(),
    params,
  );
}

/**
 * Void a recorded sale: delete the sales row and return its cards to stock.
 * Runs in a transaction so stock and sales never drift apart. Unlike a restock
 * this does NOT write a stock-addition audit row — it is a correction, not new
 * inventory. Throws if the sale no longer exists.
 */
export async function voidSale(id: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<SaleRow>(
      "SELECT * FROM inventory_sales WHERE id = ? LIMIT 1",
      [id],
    );
    const sale = rows[0];
    if (!sale) {
      throw new Error("This sale no longer exists.");
    }
    const now = new Date().toISOString();
    const existing = await db.getAllAsync<StockRow>(
      "SELECT * FROM inventory_stock WHERE network = ? AND denomination = ? LIMIT 1",
      [sale.network, sale.denomination],
    );
    if (existing.length === 0) {
      await db.runAsync(
        "INSERT INTO inventory_stock (network, denomination, quantity, unit_cost, updated_at) VALUES (?, ?, ?, ?, ?)",
        [sale.network, sale.denomination, sale.quantity, sale.unit_cost, now],
      );
    } else {
      const row = existing[0];
      await db.runAsync(
        "UPDATE inventory_stock SET quantity = ?, updated_at = ? WHERE id = ?",
        [row.quantity + sale.quantity, now, row.id],
      );
    }
    await db.runAsync("DELETE FROM inventory_sales WHERE id = ?", [id]);
  });
}
