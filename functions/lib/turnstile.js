const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function isTurnstileConfigured(env) {
  return Boolean(env?.TURNSTILE_SITEKEY && env?.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstile({ env, token, remoteIp }) {
  if (!isTurnstileConfigured(env)) {
    return { ok: true, configured: false };
  }

  if (!token || typeof token !== 'string') {
    return { ok: false, configured: true, reason: 'missing_token' };
  }

  const form = new URLSearchParams();
  form.set('secret', env.TURNSTILE_SECRET_KEY);
  form.set('response', token);
  if (remoteIp) {
    form.set('remoteip', remoteIp);
  }

  try {
    const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    if (!verifyResponse.ok) {
      return { ok: false, configured: true, reason: 'verification_http_error' };
    }

    const verifyJson = await verifyResponse.json();
    if (!verifyJson?.success) {
      return {
        ok: false,
        configured: true,
        reason: 'verification_rejected',
        errorCodes: Array.isArray(verifyJson?.['error-codes']) ? verifyJson['error-codes'] : [],
      };
    }

    return { ok: true, configured: true };
  } catch (err) {
    console.error('[turnstile] Verification request failed:', err);
    return { ok: false, configured: true, reason: 'verification_exception' };
  }
}
