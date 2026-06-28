import { describe, it, expect } from 'vitest';
import { DataCrypt } from '../functions/lib/datacrypt.js';

describe('DataCrypt — AES-GCM Encryption and Key Rotation', () => {
  const KEY_A = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const KEY_B = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
  const PLAINTEXT = 'Hello Bicom Písek 2026!';

  it('should encrypt and decrypt using a single primary key', async () => {
    const crypt = new DataCrypt(KEY_A);
    const encrypted = await crypt.encrypt(PLAINTEXT);
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toBe(PLAINTEXT);

    const decrypted = await crypt.decrypt(encrypted);
    expect(decrypted).toBe(PLAINTEXT);
  });

  it('should support key rotation (decrypting older data with rotated key list)', async () => {
    // 1. Encrypt with old key list (only KEY_A)
    const cryptOld = new DataCrypt(KEY_A);
    const encryptedWithA = await cryptOld.encrypt(PLAINTEXT);

    // 2. Rotate keys: KEY_B is now primary, KEY_A is fallback (comma-separated list)
    const rotatedKeyList = `${KEY_B},${KEY_A}`;
    const cryptNew = new DataCrypt(rotatedKeyList);

    // 3. Decrypting old ciphertext (encrypted with A) must succeed
    const decryptedWithFallback = await cryptNew.decrypt(encryptedWithA);
    expect(decryptedWithFallback).toBe(PLAINTEXT);

    // 4. Encrypting new data must use KEY_B (primary)
    const encryptedWithB = await cryptNew.encrypt('New secrets');
    const decryptedWithB = await cryptNew.decrypt(encryptedWithB);
    expect(decryptedWithB).toBe('New secrets');

    // 5. Old crypt instance (only KEY_A) should fail to decrypt data encrypted with KEY_B
    await expect(cryptOld.decrypt(encryptedWithB)).rejects.toThrow();
  });

  it('should throw an error for invalid keys in constructor', () => {
    expect(() => new DataCrypt('')).toThrow();
    expect(() => new DataCrypt('short_key')).toThrow();
    expect(() => new DataCrypt(null)).toThrow();
  });

  it('should compute SHA-256 hashes correctly', async () => {
    const email = 'info@bicom-pisek.cz';
    const hash = await DataCrypt.hash(email);
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256 hex length
    
    const hash2 = await DataCrypt.hash(email);
    expect(hash).toBe(hash2); // deterministic
  });
});
