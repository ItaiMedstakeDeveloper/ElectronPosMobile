// Ed25519 PUBLIC key (base64) for verifying offline licences. Safe to ship — it
// can only VERIFY signatures, never create them. The matching PRIVATE key lives
// only in scripts/license/keys/private.key on the vendor's machine.
//
// If you ever regenerate the keypair (scripts/license/generate-license.mjs
// keygen), replace this value — every previously issued licence becomes invalid.
export const LICENSE_PUBLIC_KEY_B64 = 'T7r3+mtzNgyGcnG6oR2ontSkAcWDDTDBBQ9WX9zN+mU=';
