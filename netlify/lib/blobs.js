import { getStore } from '@netlify/blobs';

/**
 * Získá instanci Netlify Blobs store.
 * @param {string} [storeName='bicom-media']
 * @returns {ReturnType<typeof getStore>}
 */
export function getBlobStore(storeName = 'bicom-media') {
  return getStore(storeName);
}

/**
 * Uloží JSON objekt nebo text do Netlify Blobs.
 * @param {string} key
 * @param {any} data
 * @param {string} [storeName='bicom-media']
 * @param {Object} [metadata]
 */
export async function setBlob(key, data, storeName = 'bicom-media', metadata = {}) {
  const store = getBlobStore(storeName);
  const value = typeof data === 'object' && !(data instanceof ArrayBuffer) ? JSON.stringify(data) : data;
  await store.set(key, value, { metadata });
}

/**
 * Načte data z Netlify Blobs.
 * @param {string} key
 * @param {'json'|'text'|'arrayBuffer'|'blob'} [type='json']
 * @param {string} [storeName='bicom-media']
 * @returns {Promise<any|null>}
 */
export async function getBlob(key, type = 'json', storeName = 'bicom-media') {
  try {
    const store = getBlobStore(storeName);
    const data = await store.get(key, { type });
    return data;
  } catch (err) {
    console.error(`[netlify-blobs] Chyba při čtení klíče ${key}:`, err);
    return null;
  }
}

/**
 * Smaže klíč z Netlify Blobs.
 * @param {string} key
 * @param {string} [storeName='bicom-media']
 */
export async function deleteBlob(key, storeName = 'bicom-media') {
  const store = getBlobStore(storeName);
  await store.delete(key);
}

/**
 * Vypíše seznam klíčů v daném store.
 * @param {string} [prefix]
 * @param {string} [storeName='bicom-media']
 * @returns {Promise<Array>}
 */
export async function listBlobs(prefix = '', storeName = 'bicom-media') {
  const store = getBlobStore(storeName);
  const { blobs } = await store.list({ prefix });
  return blobs || [];
}
