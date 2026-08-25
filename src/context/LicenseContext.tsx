import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as db from '@/db/db';
import { getDeviceId } from '@/lib/device';
import { verifyLicense, type LicenseCheck } from '@/lib/license/verify';

// Enforces the offline monthly licence. On boot it verifies the stored key and
// exposes the result; the app chrome gates access on `status === 'active'`.

type Status = 'loading' | 'active' | 'expired' | 'wrong-device' | 'invalid' | 'none';

type ActivateResult = { ok: true } | { ok: false; error: string };

type LicenseState = {
  status: Status;
  deviceId: string | null;
  expiresAt: Date | null;
  daysLeft: number | null;
  customer: string | null;
  activate: (token: string) => Promise<ActivateResult>;
  refresh: () => Promise<void>;
};

const LicenseContext = createContext<LicenseState | null>(null);

// Allow up to a day of backwards clock drift (timezone/NTP jitter) before we
// treat a rolled-back clock as tampering.
const CLOCK_SKEW_SEC = 86400;

function messageFor(check: LicenseCheck): string {
  switch (check.status) {
    case 'expired':
      return `This licence expired on ${check.expiresAt.toLocaleDateString()}. Please renew to continue.`;
    case 'wrong-device':
      return 'This licence was issued for a different device. Send us this device\'s ID for a new key.';
    default:
      return 'That licence key is not valid. Check for typos and try again.';
  }
}

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [customer, setCustomer] = useState<string | null>(null);

  // Read the clock, but never let it appear to run backwards past the recorded
  // high-water mark (defeats setting the phone date back to dodge expiry).
  const monotonicNowSec = async (): Promise<number> => {
    const nowSec = Math.floor(Date.now() / 1000);
    let lastSeen = 0;
    try {
      const settings = await db.getAppSettings();
      lastSeen = Number(settings['license_lastseen']) || 0;
    } catch {
      /* ignore */
    }
    const effective = Math.max(nowSec, lastSeen);
    // Advance the high-water mark.
    if (effective > lastSeen) {
      try {
        await db.setAppSetting('license_lastseen', String(effective));
      } catch {
        /* ignore */
      }
    }
    // Real tampering: wall clock is well behind what we've already seen.
    const tampered = nowSec < lastSeen - CLOCK_SKEW_SEC;
    return tampered ? effective : nowSec;
  };

  const applyCheck = (check: LicenseCheck) => {
    if (check.status === 'active') {
      setStatus('active');
      setExpiresAt(check.expiresAt);
      setDaysLeft(check.daysLeft);
      setCustomer(check.payload.cid ?? null);
    } else if (check.status === 'expired') {
      setStatus('expired');
      setExpiresAt(check.expiresAt);
      setDaysLeft(0);
      setCustomer(check.payload.cid ?? null);
    } else if (check.status === 'wrong-device') {
      setStatus('wrong-device');
      setExpiresAt(null);
      setDaysLeft(null);
      setCustomer(check.payload.cid ?? null);
    } else {
      setStatus('invalid');
      setExpiresAt(null);
      setDaysLeft(null);
      setCustomer(null);
    }
  };

  const refresh = async () => {
    const id = await getDeviceId();
    setDeviceId(id);
    let token = '';
    try {
      const settings = await db.getAppSettings();
      token = settings['license_token'] || '';
    } catch {
      /* ignore */
    }
    if (!token) {
      setStatus('none');
      setExpiresAt(null);
      setDaysLeft(null);
      setCustomer(null);
      return;
    }
    const nowSec = await monotonicNowSec();
    applyCheck(verifyLicense(token, id, nowSec));
  };

  useEffect(() => {
    refresh().catch(() => setStatus('none'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activate = async (token: string): Promise<ActivateResult> => {
    const id = deviceId || (await getDeviceId());
    setDeviceId(id);
    const nowSec = await monotonicNowSec();
    const check = verifyLicense(token, id, nowSec);
    if (check.status !== 'active') {
      // Reflect why it failed in the UI, but do not persist a bad/expired key.
      applyCheck(check);
      return { ok: false, error: messageFor(check) };
    }
    try {
      await db.setAppSetting('license_token', token.trim());
    } catch {
      return { ok: false, error: 'Could not save the licence on this device. Please try again.' };
    }
    applyCheck(check);
    return { ok: true };
  };

  const value = useMemo<LicenseState>(
    () => ({ status, deviceId, expiresAt, daysLeft, customer, activate, refresh }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, deviceId, expiresAt, daysLeft, customer],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense(): LicenseState {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within a LicenseProvider');
  return ctx;
}
