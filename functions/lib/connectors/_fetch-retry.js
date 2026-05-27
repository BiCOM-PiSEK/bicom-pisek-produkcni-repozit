/**
 * Shared fetch helper with exponential backoff retry logic.
 * Uses only the Web Fetch API — no Node.js dependencies.
 *
 * Retry schedule: attempt 0 → immediate, 1 → 1s, 2 → 2s, 3 → 4s
 * Only retries on network errors or HTTP 5xx responses.
 * Client errors (4xx) are returned immediately without retry.
 *
 * @module _fetch-retry
 */

/**
 * Sleep for the given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Perform a fetch request with exponential backoff retries.
 *
 * @param {string} url - The URL to fetch.
 * @param {RequestInit} [options={}] - Standard fetch options (method, headers, body, etc.).
 * @param {number} [retries=3] - Maximum number of retry attempts after the initial request.
 * @returns {Promise<Response>} The fetch Response object.
 * @throws {Error} If all retry attempts are exhausted due to network errors.
 */
export async function fetchWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);

      // Return immediately for success or client errors (non-retryable)
      if (res.ok || res.status < 500) {
        return res;
      }

      // Server error (5xx) — retry if attempts remain
      if (attempt < retries) {
        await sleep(1000 * Math.pow(2, attempt));
      }
    } catch (err) {
      // Network error — retry if attempts remain, otherwise rethrow
      if (attempt === retries) {
        throw err;
      }
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
}
