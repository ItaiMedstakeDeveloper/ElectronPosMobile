#!/usr/bin/env node
/*
 * Offline licence generator (VENDOR-SIDE — keep this and the private key secret).
 *
 * The mobile app only carries the PUBLIC key and can verify licences but never
 * mint them. You run this on your own computer to issue a signed, time-limited
 * key after a customer pays for the month.
 *
 * Setup (once):
 *   node scripts/license/generate-license.mjs keygen
 *     -> creates scripts/license/keys/private.key (SECRET, never share/commit)
 *        and prints the PUBLIC key to embed in the app.
 *
 * Issue a key each month (after payment):
 *   node scripts/license/generate-license.mjs mint --device <DEVICE_ID> --name "Shop Name" --days 30
 *     -> prints the licence key the customer pastes into the app.
 *
 * The customer reads their Device ID off the app's "Licence" screen and sends
 * it to you; you paste it into --device.
 */
import nacl from 'tweetnacl';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = join(HERE, 'keys');
const PRIV_PATH = join(KEYS_DIR, 'private.key');
const PUB_PATH = join(KEYS_DIR, 'public.key');

const b64 = (u8) => Buffer.from(u8).toString('base64');
const b64url = (u8) => Buffer.from(u8).toString('base64url');
const fromB64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    }
  }
  return out;
}

function keygen() {
  if (existsSync(PRIV_PATH)) {
    console.error(`Refusing to overwrite existing private key at ${PRIV_PATH}`);
    console.error('Delete it manually first if you really want a NEW keypair (invalidates all issued licences).');
    process.exit(1);
  }
  const kp = nacl.sign.keyPair();
  mkdirSync(KEYS_DIR, { recursive: true });
  writeFileSync(PRIV_PATH, b64(kp.secretKey), 'utf8');
  writeFileSync(PUB_PATH, b64(kp.publicKey), 'utf8');
  console.log('Keypair created.');
  console.log(`  Private key -> ${PRIV_PATH}  (SECRET — keep safe, never commit/share)`);
  console.log(`  Public key  -> ${PUB_PATH}`);
  console.log('\nPublic key (base64) to embed in the app:\n');
  console.log(b64(kp.publicKey));
}

function mint(args) {
  if (!existsSync(PRIV_PATH)) {
    console.error('No private key found. Run: node scripts/license/generate-license.mjs keygen');
    process.exit(1);
  }
  const device = args.device;
  const days = Number(args.days || 30);
  const name = args.name || 'Customer';
  const plan = args.plan || 'monthly';
  if (!device || device === true) {
    console.error('Missing --device <DEVICE_ID> (read it from the app\'s Licence screen).');
    process.exit(1);
  }
  if (!(days > 0)) { console.error('--days must be a positive number'); process.exit(1); }

  const secretKey = fromB64(readFileSync(PRIV_PATH, 'utf8').trim());
  const now = Math.floor(Date.now() / 1000);
  const exp = now + Math.round(days * 86400);
  const payload = { v: 1, cid: String(name), did: String(device), plan: String(plan), iat: now, exp };
  const msg = Buffer.from(JSON.stringify(payload), 'utf8');
  const sig = nacl.sign.detached(new Uint8Array(msg), secretKey);
  const token = `${b64url(msg)}.${b64url(sig)}`;

  console.log('\nLicence issued:');
  console.log(`  Customer : ${name}`);
  console.log(`  Device   : ${device}`);
  console.log(`  Plan     : ${plan}`);
  console.log(`  Expires  : ${new Date(exp * 1000).toString()}  (${days} days)`);
  console.log('\nLicence key (give this to the customer to paste into the app):\n');
  console.log(token);
  console.log('');
}

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
if (cmd === 'keygen') keygen();
else if (cmd === 'mint') mint(args);
else {
  console.log('Usage:');
  console.log('  node scripts/license/generate-license.mjs keygen');
  console.log('  node scripts/license/generate-license.mjs mint --device <DEVICE_ID> --name "Shop Name" --days 30');
}
