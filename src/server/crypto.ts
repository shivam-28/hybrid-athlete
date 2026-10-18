import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Bump when rotating APP_ENCRYPTION_KEY; decrypt with the old key, re-encrypt with the new one. */
export const ENCRYPTION_KEY_VERSION = 1;

export type SealedSecret = { ciphertext: string; iv: string; auth_tag: string; key_version: number };

function loadKey(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== 32) throw new Error("APP_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return key;
}

export function encryptSecret(plaintext: string, base64Key = process.env.APP_ENCRYPTION_KEY ?? ""): SealedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", loadKey(base64Key), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
    key_version: ENCRYPTION_KEY_VERSION,
  };
}

export function decryptSecret(sealed: SealedSecret, base64Key = process.env.APP_ENCRYPTION_KEY ?? ""): string {
  if (sealed.key_version !== ENCRYPTION_KEY_VERSION) {
    throw new Error(`Secret was encrypted with key version ${sealed.key_version}; current is ${ENCRYPTION_KEY_VERSION}`);
  }
  const decipher = createDecipheriv("aes-256-gcm", loadKey(base64Key), Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.auth_tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
