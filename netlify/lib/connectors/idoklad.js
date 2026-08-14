/**
 * iDoklad invoicing connector for Netlify Functions / Cloudflare Workers.
 *
 * Uses OAuth2 client_credentials flow with in-memory & Blobs token caching.
 * Uses only the Web Fetch API — no heavy external dependencies.
 *
 * Required secrets:
 *   - IDOKLAD_CLIENT_ID (nebo SECRET_IDOKLAD_CLIENT_ID)
 *   - IDOKLAD_CLIENT_SECRET (nebo SECRET_IDOKLAD_CLIENT_SECRET)
 *
 * @module idoklad
 */

import { fetchWithRetry } from './_fetch-retry.js';
import { getBlob, setBlob } from '../blobs.js';

const TOKEN_ENDPOINT = 'https://identity.idoklad.cz/connect/token';
const API_BASE = 'https://api.idoklad.cz/v3';
const BLOB_TOKEN_KEY = 'idoklad_token';

let _memoryToken = null;
let _memoryTokenExpiresAt = 0;

export class IDokladConnector {
  /**
   * @param {object} [env=process.env] - Environment bindings.
   */
  constructor(env = process.env) {
    this.clientId = env.IDOKLAD_CLIENT_ID || env.SECRET_IDOKLAD_CLIENT_ID || '';
    this.clientSecret = env.IDOKLAD_CLIENT_SECRET || env.SECRET_IDOKLAD_CLIENT_SECRET || '';
    this.configured = Boolean(this.clientId) && Boolean(this.clientSecret);
  }

  /**
   * Obtain an access token via client_credentials grant.
   * Checks memory & Blobs cache first; if expired, requests a new token.
   *
   * @returns {Promise<string|null>} The access token or null if not configured.
   */
  async _getAccessToken() {
    if (!this.configured) {
      console.warn('[iDoklad] Missing client credentials — skipping auth.');
      return null;
    }

    // 1. Zkusíme in-memory cache
    if (_memoryToken && Date.now() < _memoryTokenExpiresAt) {
      return _memoryToken;
    }

    // 2. Zkusíme Netlify Blobs cache
    try {
      const cached = await getBlob(BLOB_TOKEN_KEY, 'bicom-cache');
      if (cached && cached.token && cached.expires_at > Date.now()) {
        _memoryToken = cached.token;
        _memoryTokenExpiresAt = cached.expires_at;
        return _memoryToken;
      }
    } catch {
      // Blobs fallback fail silent
    }

    // 3. Požádáme o nový token přes OAuth2 Client Credentials
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'idoklad_api',
    });

    const res = await fetchWithRetry(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res || !res.ok) {
      console.warn('[iDoklad] Token request failed:', res?.status);
      return null;
    }

    const data = await res.json();
    const token = data.access_token;
    const expiresInSec = data.expires_in || 3600;
    const expiresAt = Date.now() + (expiresInSec - 120) * 1000; // 2 min rezerva

    _memoryToken = token;
    _memoryTokenExpiresAt = expiresAt;

    // Uložíme do Netlify Blobs
    try {
      await setBlob(BLOB_TOKEN_KEY, { token, expires_at: expiresAt }, 'bicom-cache');
    } catch {
      // Blobs fallback
    }

    return token;
  }

  /**
   * Create an issued invoice.
   *
   * @param {object} customerData - Customer information.
   * @param {string} customerData.name - Customer name.
   * @param {string} customerData.email - Customer email.
   * @param {string} [customerData.street] - Street address.
   * @param {string} [customerData.city] - City.
   * @param {string} [customerData.postalCode] - Postal code.
   * @param {string} [customerData.ico] - Company identification number (IČO).
   * @param {object[]} [items] - Invoice line items.
   * @returns {Promise<object|null>} Created invoice data or null on failure.
   */
  async createInvoice(customerData, items = []) {
    const token = await this._getAccessToken();
    if (!token) return null;

    const lineItems = items.length > 0 ? items : [
      {
        name: customerData.serviceName || 'Biorezonanční harmonizační sezení',
        unitPrice: Number(customerData.priceCzk || 1200),
        amount: 1,
        vatRateType: 'Zero',
      }
    ];

    const invoicePayload = {
      PurchaserName: customerData.name || 'Klient Bicom Písek',
      PurchaserEmail: customerData.email || '',
      PurchaserStreet: customerData.street || 'Písek',
      PurchaserCity: customerData.city || 'Písek',
      PurchaserPostalCode: customerData.postalCode || '39701',
      ...(customerData.ico ? { PurchaserIdentificationNumber: customerData.ico } : {}),
      Items: lineItems.map((item) => ({
        Name: item.name || item.Name,
        UnitPrice: item.unitPrice || item.UnitPrice,
        Amount: item.amount || item.Amount || 1,
        PriceType: 1, // s DPH / bez DPH
        VatRateType: 0, // Neplátce DPH / Zero
      })),
      Description: `Rezervace Bicom: ${customerData.bookingId || ''}`,
      PaymentOptionId: 1, // Převod / Hotovost
    };

    const res = await fetchWithRetry(`${API_BASE}/IssuedInvoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!res || !res.ok) {
      console.warn('[iDoklad] Create invoice failed:', res?.status);
      return null;
    }

    return await res.json();
  }
}
