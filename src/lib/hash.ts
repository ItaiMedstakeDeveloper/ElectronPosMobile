import * as Crypto from 'expo-crypto';

// Password hashing for the local SQLite user store. This is a device-local
// auth (no server, no interop with the web app's bcrypt hashes), so a salted
// SHA-256 is sufficient. Stored format is `salt$hash`.

async function makeSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function digest(password: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`
  );
}

// Produce a `salt$hash` string to persist for a new/changed password.
export async function hashPassword(password: string): Promise<string> {
  const salt = await makeSalt();
  const hash = await digest(password, salt);
  return `${salt}$${hash}`;
}

// Constant-shape comparison of a plaintext password against a stored `salt$hash`.
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split('$');
  if (!salt || !hash) return false;
  const candidate = await digest(password, salt);
  return candidate === hash;
}
