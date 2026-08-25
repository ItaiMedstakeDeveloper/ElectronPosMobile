import nacl from 'tweetnacl';
import { LICENSE_PUBLIC_KEY_B64 } from './publicKey';

// Offline licence verification. A licence is `base64url(payloadJSON).base64url(sig)`
// where `sig` is an Ed25519 signature over the payload bytes, made by the vendor's
// private key. The app embeds only the public key, so it can verify but never forge.

export type LicensePayload = {
  v: number;
  cid: string; // customer label
  did: string; // device id the licence is bound to
  plan: string;
  iat: number; // issued at (epoch seconds)
  exp: number; // expiry (epoch seconds)
};

export type LicenseCheck =
  | { status: 'active'; payload: LicensePayload; expiresAt: Date; daysLeft: number }
  | { status: 'expired'; payload: LicensePayload; expiresAt: Date }
  | { status: 'wrong-device'; payload: LicensePayload }
  | { status: 'invalid' };

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(input: string): Uint8Array {
  // Accept both standard and url-safe base64, with or without padding.
  let s = input.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const ch of s) {
    const val = B64.indexOf(ch);
    if (val < 0) continue;
    buffer = (buffer << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return Uint8Array.from(bytes);
}

function bytesToUtf8(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i++];
    if (b < 0x80) {
      out += String.fromCharCode(b);
    } else if (b >= 0xc0 && b < 0xe0) {
      const b2 = bytes[i++] & 0x3f;
      out += String.fromCharCode(((b & 0x1f) << 6) | b2);
    } else if (b >= 0xe0 && b < 0xf0) {
      const b2 = bytes[i++] & 0x3f;
      const b3 = bytes[i++] & 0x3f;
      out += String.fromCharCode(((b & 0x0f) << 12) | (b2 << 6) | b3);
    } else {
      const b2 = bytes[i++] & 0x3f;
      const b3 = bytes[i++] & 0x3f;
      const b4 = bytes[i++] & 0x3f;
      let cp = ((b & 0x07) << 18) | (b2 << 12) | (b3 << 6) | b4;
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}

const DAY = 86400;

// Verify a licence token for a device at a given time (epoch seconds).
export function verifyLicense(token: string, deviceId: string, nowSec: number): LicenseCheck {
  try {
    const trimmed = (token || '').trim();
    const dot = trimmed.indexOf('.');
    if (dot <= 0) return { status: 'invalid' };
    const msg = base64ToBytes(trimmed.slice(0, dot));
    const sig = base64ToBytes(trimmed.slice(dot + 1));
    const pub = base64ToBytes(LICENSE_PUBLIC_KEY_B64);
    if (msg.length === 0 || sig.length !== 64 || pub.length !== 32) return { status: 'invalid' };

    const ok = nacl.sign.detached.verify(msg, sig, pub);
    if (!ok) return { status: 'invalid' };

    const payload = JSON.parse(bytesToUtf8(msg)) as LicensePayload;
    if (!payload || typeof payload.exp !== 'number' || typeof payload.did !== 'string') {
      return { status: 'invalid' };
    }
    if (payload.did !== deviceId) return { status: 'wrong-device', payload };

    const expiresAt = new Date(payload.exp * 1000);
    if (nowSec > payload.exp) return { status: 'expired', payload, expiresAt };

    const daysLeft = Math.max(0, Math.ceil((payload.exp - nowSec) / DAY));
    return { status: 'active', payload, expiresAt, daysLeft };
  } catch {
    return { status: 'invalid' };
  }
}
