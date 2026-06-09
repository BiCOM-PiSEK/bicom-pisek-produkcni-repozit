// DataCrypt — field-level AES-GCM 256-bit encryption for sensitive data (Art. 9 GDPR).
// Runs on Cloudflare Workers (V8 isolates) — Web Crypto API only, no Node.js dependencies.
// Encryption key = 64-char hex string (256-bit) from CF Secrets (SECRET_ENCRYPTION_KEY).

// --- Base64 helpers (Workers-compatible, no atob/btoa on raw binary) ---

/**
 * Converts an ArrayBuffer to a Base64-encoded string.
 * Uses Uint8Array character mapping instead of btoa() for binary safety.
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += CHARS[a >> 2];
    result += CHARS[((a & 3) << 4) | (b >> 4)];
    result += i + 1 < bytes.length ? CHARS[((b & 15) << 2) | (c >> 6)] : '=';
    result += i + 2 < bytes.length ? CHARS[c & 63] : '=';
  }
  return result;
}

/**
 * Decodes a Base64 string to a Uint8Array.
 * Uses lookup table instead of atob() for binary safety.
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToArrayBuffer(base64) {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  // Build reverse lookup
  const lookup = new Uint8Array(128);
  for (let i = 0; i < CHARS.length; i++) {
    lookup[CHARS.charCodeAt(i)] = i;
  }

  // Strip padding and calculate output length
  let stripped = base64.replace(/=+$/, '');
  const outLen = (stripped.length * 3) >> 2;
  const out = new Uint8Array(outLen);

  let j = 0;
  for (let i = 0; i < stripped.length; i += 4) {
    const a = lookup[stripped.charCodeAt(i)];
    const b = lookup[stripped.charCodeAt(i + 1)];
    const c = lookup[stripped.charCodeAt(i + 2)];
    const d = lookup[stripped.charCodeAt(i + 3)];
    out[j++] = (a << 2) | (b >> 4);
    if (j < outLen) out[j++] = ((b & 15) << 4) | (c >> 2);
    if (j < outLen) out[j++] = ((c & 3) << 6) | d;
  }
  return out;
}

/**
 * Converts a hex string to Uint8Array.
 * @param {string} hex - Even-length hex string
 * @returns {Uint8Array}
 */
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * AES-GCM 256-bit encryption/decryption class for Cloudflare Workers.
 *
 * Usage:
 *   const crypt = new DataCrypt(env.SECRET_ENCRYPTION_KEY);
 *   const encrypted = await crypt.encrypt('sensitive data');
 *   const decrypted = await crypt.decrypt(encrypted);
 *   const hash = await DataCrypt.hash('email@example.com');
 */
class DataCrypt {
  /**
   * Creates a new DataCrypt instance.
   * @param {string} hexKey - 64-character hex string representing a 256-bit key
   */
  constructor(hexKey) {
    if (!hexKey || typeof hexKey !== 'string' || hexKey.length !== 64) {
      throw new Error('DataCrypt: hexKey must be a 64-character hex string (256-bit)');
    }
    /** @private */
    this._hexKey = hexKey;
    /** @private @type {CryptoKey|null} */
    this._cachedKey = null;
  }

  /**
   * Lazily imports and caches the CryptoKey from the hex string.
   * @private
   * @returns {Promise<CryptoKey>}
   */
  async _getKey() {
    if (this._cachedKey) return this._cachedKey;
    const rawBytes = hexToBytes(this._hexKey);
    this._cachedKey = await crypto.subtle.importKey(
      'raw',
      rawBytes,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
    return this._cachedKey;
  }

  /**
   * Encrypts a plaintext string using AES-GCM 256-bit.
   * Output format: Base64( IV[12 bytes] || ciphertext || tag[16 bytes] ).
   * @param {string} plaintext - The string to encrypt
   * @returns {Promise<string>} Base64-encoded ciphertext (IV prepended)
   */
  async encrypt(plaintext) {
    if (plaintext == null) return null;
    const key = await this._getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoded
    );

    // Concatenate IV + ciphertext (which includes the 16-byte auth tag)
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);

    return arrayBufferToBase64(combined.buffer);
  }

  /**
   * Decrypts a Base64-encoded AES-GCM ciphertext back to plaintext.
   * Expects format: Base64( IV[12 bytes] || ciphertext || tag[16 bytes] ).
   * @param {string} encryptedBase64 - Base64 string produced by encrypt()
   * @returns {Promise<string>} The original plaintext string
   */
  async decrypt(encryptedBase64) {
    if (encryptedBase64 == null) return null;
    if (encryptedBase64 === '') return '';
    const key = await this._getKey();
    const raw = base64ToArrayBuffer(encryptedBase64);

    // First 12 bytes = IV, remainder = ciphertext + auth tag
    const iv = raw.slice(0, 12);
    const ciphertext = raw.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  /**
   * Computes a SHA-256 hash of the given value.
   * Useful for deduplication (e.g. email hash) without exposing plaintext.
   * @param {string} value - The string to hash
   * @returns {Promise<string>} Lowercase hex-encoded SHA-256 digest
   */
  static async hash(value) {
    const encoded = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

export { DataCrypt };
