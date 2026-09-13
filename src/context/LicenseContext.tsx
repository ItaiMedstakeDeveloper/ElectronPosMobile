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
  // Free trial ("familiarisation period"). Self-serve: the user starts it once
  // per device; it counts down independently of any signed licence.
  trialStarted: boolean;
  trialActive: boolean;
  trialDaysLeft: number | null;
  startTrial: () => Promise<void>;
};

const LicenseContext = createContext<LicenseState | null>(null);

// Length of the free familiarisation period, in days. Single source of truth —
// change this one number to change the trial length everywhere.
export const TRIAL_DAYS = 27;

const DAY_SEC = 86400;

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
  const [trialStarted, setTrialStarted] = useState(false);
  const [trialActive, setTrialActive] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

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

  // Load the trial's remaining days from the stored start time, guarding against
  // a rolled-back clock via the same monotonic time source as the licence.
  const loadTrial = async () => {
    let startedRaw = 0;
    try {
      const settings = await db.getAppSettings();
      startedRaw = Number(settings['trial_started_at']) || 0;
    } catch {
      /* ignore */
    }
    if (startedRaw <= 0) {
      setTrialStarted(false);
      setTrialActive(false);
      setTrialDaysLeft(null);
      return;
    }
    const nowSec = await monotonicNowSec();
    const endSec = startedRaw + TRIAL_DAYS * DAY_SEC;
    const left = Math.max(0, Math.ceil((endSec - nowSec) / DAY_SEC));
    setTrialStarted(true);
    setTrialActive(left > 0);
    setTrialDaysLeft(left);
  };

  const refresh = async () => {
    const id = await getDeviceId();
    setDeviceId(id);
    await loadTrial();
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

  // Begin the free trial once. No-op if it was already started (the start time
  // is fixed on first call so the counter can't be reset by tapping again).
  const startTrial = async () => {
    try {
      const settings = await db.getAppSettings();
      if (Number(settings['trial_started_at']) > 0) {
        await loadTrial();
        return;
      }
      const nowSec = await monotonicNowSec();
      await db.setAppSetting('trial_started_at', String(nowSec));
    } catch (e) {
      console.error('Could not start trial', e);
    }
    await loadTrial();
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
    () => ({
      status,
      deviceId,
      expiresAt,
      daysLeft,
      customer,
      activate,
      refresh,
      trialStarted,
      trialActive,
      trialDaysLeft,
      startTrial,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, deviceId, expiresAt, daysLeft, customer, trialStarted, trialActive, trialDaysLeft],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense(): LicenseState {
  const ctx = useContext(LicenseContext);
  if (!ctx) throw new Error('useLicense must be used within a LicenseProvider');
  return ctx;
}
