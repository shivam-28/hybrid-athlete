import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ENCRYPTION_KEY_VERSION, decryptSecret, encryptSecret } from "./crypto";

const key = randomBytes(32).toString("base64");
const secret = "sk-ant-api03-example-secret-value";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a secret", () => {
    const sealed = encryptSecret(secret, key);
    expect(sealed.key_version).toBe(ENCRYPTION_KEY_VERSION);
    expect(decryptSecret(sealed, key)).toBe(secret);
  });

  it("never stores the plaintext in the sealed payload", () => {
    const sealed = encryptSecret(secret, key);
    expect(JSON.stringify(sealed)).not.toContain(secret);
  });

  it("uses a fresh IV for every encryption", () => {
    const a = encryptSecret(secret, key);
    const b = encryptSecret(secret, key);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("Given a tampered ciphertext, Then decryption throws", () => {
    const sealed = encryptSecret(secret, key);
    const bytes = Buffer.from(sealed.ciphertext, "base64");
    bytes[0] = bytes[0]! ^ 0xff;
    expect(() => decryptSecret({ ...sealed, ciphertext: bytes.toString("base64") }, key)).toThrow();
  });

  it("Given a tampered auth tag, Then decryption throws", () => {
    const sealed = encryptSecret(secret, key);
    const tag = Buffer.from(sealed.auth_tag, "base64");
    tag[0] = tag[0]! ^ 0xff;
    expect(() => decryptSecret({ ...sealed, auth_tag: tag.toString("base64") }, key)).toThrow();
  });

  it("Given a different instance key (database copied without the secret), Then decryption throws", () => {
    const sealed = encryptSecret(secret, key);
    expect(() => decryptSecret(sealed, randomBytes(32).toString("base64"))).toThrow();
  });

  it("Given an unknown key_version, Then it fails with a clear message", () => {
    const sealed = encryptSecret(secret, key);
    expect(() => decryptSecret({ ...sealed, key_version: 99 }, key)).toThrow(/key version 99/i);
  });

  it("Given an instance key that is not 32 bytes, Then it refuses to encrypt", () => {
    expect(() => encryptSecret(secret, Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
  });
});
