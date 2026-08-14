/**
 * iDoklad invoicing connector for Cloudflare Workers.
 *
 * Uses OAuth2 client_credentials flow with token caching in KV.
 * Uses only the Web Fetch API — no Node.js dependencies.
 *
 * Required secrets:
 *   - SECRET_IDOKLAD_CLIENT_ID
 *   - SECRET_IDOKLAD_CLIENT_SECRET
 *
 * Required bindings:
 *   - CACHE (KV namespace for token caching)
 *
 * @module idoklad
 */

import { fetchWithRetry } from './_fetch-retry.js';

const TOKEN_ENDPOINT = 'https://identity.idoklad.cz/server/connect/token';
const API_BASE = 'https://api.idoklad.cz/v3';
const KV_TOKEN_KEY = 'idoklad_token';

export class IDokladConnector {
  /**
   * @param {object} env - Cloudflare Worker environment bindings.
   * @param {object} [kvCache] - KV namespace for caching tokens (defaults to env.CACHE).
   */
  constructor(env, kvCache) {
    this.clientId = env.SECRET_IDOKLAD_CLIENT_ID || '';
    this.clientSecret = env.SECRET_IDOKLAD_CLIENT_SECRET || '';
    this.kvCache = kvCache || env.CACHE || null;
    this.configured = Boolean(this.clientId) && Boolean(this.clientSecret);
  }

  /**
   * Obtain an access token via client_credentials grant.
   * Checks KV cache first; if expired, requests a new token and caches it.
   *
   * @returns {Promise<string|null>} The access token or null if not configured.
   */
  async _getAccessToken() {
    if (!this.configured) {
      console.warn('[iDoklad] Missing client credentials — skipping auth.');
      return null;
    }

    // Try KV cache first
    if (this.kvCache) {
      try {
        const cached = await this.kvCache.get(KV_TOKEN_KEY);
        if (cached) return cached;
      } catch (e) {
        console.warn('[iDoklad] KV cache read error:', e.message);
      }
    }

    // Request new token
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
    const ttl = (data.expires_in || 3600) - 60; // 60s safety margin

    // Cache in KV
    if (this.kvCache && token) {
      try {
        await this.kvCache.put(KV_TOKEN_KEY, token, { expirationTtl: Math.max(ttl, 60) });
      } catch (e) {
        console.warn('[iDoklad] KV cache write error:', e.message);
      }
    }

    return token;
  }

  /**
   * Create an issued invoice.
   *
   * @param {object} customerData - Customer information.
   * @param {string} customerData.name - Customer name.
   * @param {string} customerData.email - Customer email.
   * @param {string} customerData.street - Street address.
   * @param {string} customerData.city - City.
   * @param {string} customerData.postalCode - Postal code.
   * @param {string} [customerData.ico] - Company identification number (IČO).
   * @param {object[]} items - Invoice line items.
   * @param {string} items[].name - Item name/description.
   * @param {number} items[].unitPrice - Price per unit (excl. VAT).
   * @param {number} items[].amount - Quantity.
   * @param {string} [items[].vatRateType='ReducedFirst'] - VAT rate type.
   * @returns {Promise<object|null>} Created invoice data or null on failure.
   */
  async createInvoice(customerData, items) {
    const token = await this._getAccessToken();
    if (!token) return null;

    const invoicePayload = {
      PurchaserName: customerData.name,
      PurchaserEmail: customerData.email,
      PurchaserStreet: customerData.street,
      PurchaserCity: customerData.city,
      PurchaserPostalCode: customerData.postalCode,
      ...(customerData.ico ? { PurchaserIdentificationNumber: customerData.ico } : {}),
      Items: items.map((item) => ({
        Name: item.name,
        UnitPrice: item.unitPrice,
        Amount: item.amount,
        VatRateType: item.vatRateType || 'ReducedFirst',
      })),
    };

    const res = await fetchWithRetry(`${API_BASE}/IssuedInvoices`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoicePayload),
    });

    if (!res || !res.ok) {
      console.warn('[iDoklad] createInvoice failed:', res?.status);
      return null;
    }

    return res.json();
  }

  /**
   * List issued invoices within a date range.
   *
   * @param {string} dateFrom - Start date in YYYY-MM-DD format.
   * @param {string} dateTo - End date in YYYY-MM-DD format.
   * @returns {Promise<object[]>} Array of invoice objects, or empty array on failure.
   */
  async getInvoices(dateFrom, dateTo) {
    const token = await this._getAccessToken();
    if (!token) return [];

    const filter = `DateOfIssue~gte~${dateFrom}|DateOfIssue~lte~${dateTo}`;
    const url = `${API_BASE}/IssuedInvoices?filter=${encodeURIComponent(filter)}`;

    const res = await fetchWithRetry(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res || !res.ok) {
      console.warn('[iDoklad] getInvoices failed:', res?.status);
      return [];
    }

    const data = await res.json();
    return data.Items || data.items || [];
  }

  /**
   * Get aggregate statistics from invoices (all time or recent).
   * Returns total revenue, invoice count, paid vs unpaid breakdown.
   *
   * @returns {Promise<object|null>} Stats object or null on failure.
   */
  async getStats() {
    const token = await this._getAccessToken();
    if (!token) return null;

    // Fetch recent invoices (last 365 days) for stats
    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const dateFrom = yearAgo.toISOString().slice(0, 10);
    const dateTo = now.toISOString().slice(0, 10);

    const invoices = await this.getInvoices(dateFrom, dateTo);

    let totalRevenue = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let paidRevenue = 0;
    let unpaidRevenue = 0;

    for (const inv of invoices) {
      // iDoklad uses DocumentTotalWithVat or similar field
      const amount = inv.DocumentTotalWithVat || inv.TotalWithVat || 0;
      totalRevenue += amount;

      // PaymentStatus: 1 = unpaid, 2 = partially paid, 3 = paid
      if (inv.PaymentStatus === 3) {
        paidCount++;
        paidRevenue += amount;
      } else {
        unpaidCount++;
        unpaidRevenue += amount;
      }
    }

    return {
      totalRevenue,
      invoiceCount: invoices.length,
      paidCount,
      paidRevenue,
      unpaidCount,
      unpaidRevenue,
    };
  }
}
