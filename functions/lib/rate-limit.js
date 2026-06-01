/**
 * Simple KV-based Rate Limiter for Cloudflare Workers.
 * Prevents spam on public endpoints like bookings or newsletter subscriptions.
 * 
 * @param {Object} kv - KV Namespace binding
 * @param {string} ip - Client IP address
 * @param {string} endpoint - Endpoint identifier (e.g. 'book', 'newsletter')
 * @param {number} limit - Maximum requests allowed in the window
 * @param {number} windowSeconds - Expiration window in seconds (default 60)
 * @returns {Promise<boolean>} - True if request is allowed, false if rate limited
 */
export async function checkRateLimit(kv, ip, endpoint, limit, windowSeconds = 60) {
  if (!kv) return true; // Fallback if KV binding is missing

  const key = `rl:${ip}:${endpoint}`;
  try {
    const current = await kv.get(key);
    if (current === null) {
      // First request in this window
      await kv.put(key, '1', { expirationTtl: windowSeconds });
      return true;
    }

    const count = parseInt(current, 10);
    if (count >= limit) {
      return false; // Rate limited
    }

    // Increment count
    await kv.put(key, (count + 1).toString(), { expirationTtl: windowSeconds });
    return true;
  } catch (err) {
    console.error(`[rate-limit] Error checking limit for IP ${ip} on endpoint ${endpoint}:`, err);
    return true; // Graceful fallback: allow request if KV fails
  }
}
