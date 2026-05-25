// DataCrypt — field-level šifrování pro citlivá zdravotní data (čl. 9 GDPR).
// AES-GCM 256, Web Crypto API. Bez Node.js závislostí (běží na CF Workers).
// Vstup ENCRYPTION_KEY = 64-znakový hex (256 bit) z CF Secrets.

function hexToBytes(hex) {
  const b = new Uint8Array(hex.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(hex.substr(i * 2, 2), 16);
  return b;
}
async function importKey(keyHex) {
  return crypto.subtle.importKey('raw', hexToBytes(keyHex), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));

export const DataCrypt = {
  // -> Base64( IV[12] || ciphertext )
  async encryptText(plainText, keyHex) {
    if (plainText == null) return null;
    const key = await importKey(keyHex);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key,
      new TextEncoder().encode(plainText));
    const out = new Uint8Array(iv.length + ct.byteLength);
    out.set(iv, 0); out.set(new Uint8Array(ct), iv.length);
    return b64(out.buffer);
  },
  async decryptText(cipherB64, keyHex) {
    if (cipherB64 == null) return null;
    const key = await importKey(keyHex);
    const raw = unb64(cipherB64);
    const iv = raw.slice(0, 12), data = raw.slice(12);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(pt);
  },
  // SHA-256 hex (pro deduplikaci e-mailů bez plaintextu)
  async sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text.toLowerCase()));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
};
