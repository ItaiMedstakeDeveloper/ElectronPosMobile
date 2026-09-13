import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as SQLite from "expo-sqlite";
import * as meta from "@/db/meta";
import * as db from "@/db/db";
import { listShops } from "@/db/meta";

// When restoring, keep THIS device's own identity + licence rather than the
// backup's, so a backup file can't be used to move a licence onto another
// device (and a same-device restore keeps working). Set to false to make restore
// bring back the licence/trial that was in the backup instead.
const PRESERVE_LICENSE_ON_RESTORE = true;
const PRESERVED_KEYS = [
  "device_id",
  "license_token",
  "license_lastseen",
  "trial_started_at",
];

// Full-device backup. Every shop keeps its data in its own SQLite file plus the
// shared meta database (see src/db/meta.ts). A backup bundles all of them into a
// single JSON envelope (each database is stored as base64 of its raw file), then
// hands that file to the OS Share sheet so the user can save it to Google Drive,
// WhatsApp, email, a USB drive, etc.

const SQLITE_DIR = FileSystem.documentDirectory + "SQLite/";
const META_DB = "pos_meta.db";

export type BackupResult =
  | { ok: true; fileName: string; shops: number }
  | { ok: false; error: string };

// Fold the write-ahead log back into the main .db file so the copy we read is
// complete and consistent. Opening a second connection is safe with WAL.
async function checkpoint(name: string): Promise<void> {
  try {
    const d = await SQLite.openDatabaseAsync(name);
    await d.execAsync("PRAGMA wal_checkpoint(TRUNCATE);");
    await d.closeAsync();
  } catch {
    /* database may not exist yet — skip it */
  }
}

async function fileToBase64(name: string): Promise<string | null> {
  const uri = SQLITE_DIR + name;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return null;
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function exportBackup(): Promise<BackupResult> {
  try {
    const shops = await listShops();
    // Meta first, then every shop's data file (de-duplicated).
    const names = Array.from(new Set([META_DB, ...shops.map((s) => s.dbFile)]));

    const databases: Record<string, string> = {};
    for (const name of names) {
      await checkpoint(name);
      const b64 = await fileToBase64(name);
      if (b64 != null) databases[name] = b64;
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const tag = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;

    const envelope = {
      format: "electronpos-backup",
      version: 1,
      createdAt: now.toISOString(),
      shops: shops.map((s) => ({ id: s.id, name: s.name, dbFile: s.dbFile })),
      databases,
    };

    const fileName = `electronpos-backup-${tag}.json`;
    const uri = FileSystem.cacheDirectory + fileName;
    await FileSystem.writeAsStringAsync(uri, JSON.stringify(envelope));

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, error: "Sharing isn't available on this device." };
    }
    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      dialogTitle: "Export POS backup",
      UTI: "public.json",
    });

    return { ok: true, fileName, shops: shops.length };
  } catch (e) {
    console.error("Backup export failed", e);
    return { ok: false, error: "Could not create the backup. Please try again." };
  }
}

export type RestoreResult =
  | { ok: true; shops: number }
  | { ok: false; error: string };

// Restore from a backup file created by exportBackup(). Overwrites every local
// database with the contents of the backup. DESTRUCTIVE — the caller must
// confirm first, and must reload the app afterwards (see ShopContext.reloadAfterRestore).
export async function restoreBackup(uri: string): Promise<RestoreResult> {
  try {
    const raw = await FileSystem.readAsStringAsync(uri);
    let env: any;
    try {
      env = JSON.parse(raw);
    } catch {
      return { ok: false, error: "That file isn't a valid backup." };
    }
    if (!env || env.format !== "electronpos-backup" || !env.databases) {
      return { ok: false, error: "That file isn't an Electron POS backup." };
    }

    // Snapshot this device's identity/licence before we overwrite meta.
    const preserved: Record<string, string> = {};
    if (PRESERVE_LICENSE_ON_RESTORE) {
      const current = await meta.getMetaSettings();
      for (const k of PRESERVED_KEYS) if (current[k] != null) preserved[k] = current[k];
    }

    // Release open connections so the files can be replaced.
    await db.closeActiveDb();
    await meta.closeMeta();

    // Make sure the SQLite directory exists, then write each database back and
    // drop stale WAL/SHM sidecars so the restored file is authoritative.
    await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true }).catch(() => {});
    const databases = env.databases as Record<string, string>;
    for (const [name, b64] of Object.entries(databases)) {
      const target = SQLITE_DIR + name;
      await FileSystem.writeAsStringAsync(target, b64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.deleteAsync(target + "-wal", { idempotent: true });
      await FileSystem.deleteAsync(target + "-shm", { idempotent: true });
    }

    // Reopen meta and re-apply this device's preserved settings.
    await meta.initMeta();
    for (const [k, v] of Object.entries(preserved)) {
      await meta.setMetaSetting(k, v);
    }

    const shops = await meta.listShops();
    return { ok: true, shops: shops.length };
  } catch (e) {
    console.error("Backup restore failed", e);
    return { ok: false, error: "Could not restore the backup. Please try again." };
  }
}
