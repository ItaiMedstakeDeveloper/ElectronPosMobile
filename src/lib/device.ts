import * as Crypto from 'expo-crypto';
import * as db from '@/db/db';

// A stable per-install identifier used to bind a licence to this device so one
// key can't unlock unlimited installs. Persisted in SQLite settings; it survives
// app restarts (but resets on reinstall / clearing app data, which then needs a
// re-issued licence — acceptable for the offline model).

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const settings = await db.getAppSettings();
    let id = settings['device_id'];
    if (!id) {
      id = Crypto.randomUUID();
      await db.setAppSetting('device_id', id);
    }
    cached = id;
    return id;
  } catch {
    // If SQLite is unavailable, fall back to an ephemeral id for this session.
    if (!cached) cached = Crypto.randomUUID();
    return cached;
  }
}
