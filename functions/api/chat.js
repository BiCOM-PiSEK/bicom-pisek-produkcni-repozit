import { checkRateLimit } from '../lib/rate-limit.js';
import { runText } from '../lib/ai/providers.js';
import { getSkill } from '../lib/ai/skills/index.js';
import { loadAiRuntimeConfig } from '../lib/ai/skills/runtime-config.js';

// Global daily cap for AI chat requests to prevent abuse (tunable)
const AI_CHAT_DAILY_CAP = 500;

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Words that must NEVER appear in AI responses (medical claims)
const FORBIDDEN_WORDS = [
  'léčí', 'vyléčí', 'zaručeně', 'garantujeme', '100%',
  'leci', 'vyleci', 'zarucene', 'garantujeme',
];

/**
 * Handles OPTIONS preflight.
 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Checks AI response for forbidden medical claims.
 * @param {string} text
 * @returns {boolean} true if response contains forbidden words
 */
function containsForbiddenWords(text) {
  const lower = text.toLowerCase();
  return FORBIDDEN_WORDS.some((word) => lower.includes(word));
}

/**
 * Censors forbidden words in AI response with safe alternatives.
 * @param {string} text
 * @returns {string}
 */
function censorResponse(text) {
  let censored = text;
  const replacements = {
    'léčí': 'podporuje',
    'vyléčí': 'pomáhá',
    'zaručeně': 'podle zkušeností klientů',
    'garantujeme': 'snažíme se',
    '100%': 'v mnoha případech',
    'leci': 'podporuje',
    'vyleci': 'pomáhá',
    'zarucene': 'podle zkušeností klientů',
  };

  for (const [forbidden, safe] of Object.entries(replacements)) {
    const regex = new RegExp(forbidden, 'gi');
    censored = censored.replace(regex, safe);
  }

  return censored;
}

/**
 * Loads service catalog from KV cache or D1 for context injection.
 * @param {Object} env
 * @returns {Promise<string>}
 */
async function loadServicesContext(env) {
  try {
    const cached = await env.CACHE.get('services:all', 'json');
    if (cached) {
      return cached
        .map((s) => `- ${s.name}: ${s.short_desc || s.long_desc || ''} (${s.price_avg || '—'} Kč)`)
        .join('\n');
    }

    const { results } = await env.DB.prepare(
      'SELECT name, short_desc, long_desc, price_avg FROM services WHERE active = 1 ORDER BY sort_order'
    ).all();

    if (results?.length) {
      return results
        .map((s) => `- ${s.name}: ${s.short_desc || s.long_desc || ''} (${s.price_avg || '—'} Kč)`)
        .join('\n');
    }
  } catch (err) {
    console.error('[chat] Failed to load services context:', err);
  }
  return '';
}

/**
 * Loads FAQ content from content_blocks table.
 * @param {Object} env
 * @returns {Promise<string>}
 */
async function loadFaqContext(env) {
  try {
    const { results } = await env.DB.prepare(
      "SELECT title, content_markdown FROM content_blocks WHERE content_type = 'faq' LIMIT 20"
    ).all();

    if (results?.length) {
      return results
        .map((faq) => `Q: ${faq.title}\nA: ${faq.content_markdown}`)
        .join('\n\n');
    }
  } catch (err) {
    console.error('[chat] Failed to load FAQ context:', err);
  }
  return '';
}

/**
 * POST /api/chat — AI chat assistant.
 */
export async function onRequestPost({ request, env, waitUntil }) {
  try {
    // 0. Rate limiting (max 20 requests per IP per minute) to protect Workers AI credits
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const allowed = await checkRateLimit(env.CACHE, ip, 'chat', 20);
    if (!allowed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Posíláte zprávy příliš rychle, zkuste to prosím za chvíli.' }),
        { status: 429, headers: CORS_HEADERS }
      );
    }

    // 1. Parse request body
    let data;
    try {
      data = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Neplatný formát požadavku.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { message, conversationId } = data;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Zpráva nesmí být prázdná.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Limit message length to prevent abuse
    if (message.length > 1000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Zpráva je příliš dlouhá (max 1000 znaků).' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const convId = conversationId || crypto.randomUUID();

    // 1.b Global daily cap check (max AI_CHAT_DAILY_CAP requests per day)
    // POZN.: Denní strop je BEST-EFFORT (přibližný), ne transakční rozpočet.
    // KV get+put není atomické, takže při vysoké souběžnosti může reálný počet mírně
    // přesáhnout AI_CHAT_DAILY_CAP (~o desítky). To je vědomě akceptováno: jde o měkkou
    // pojistku proti runaway/zneužití, ne o tvrdý finanční limit. První obrana je IP-limit.
    // Tvrdě atomická varianta (Durable Object / D1 UPDATE...RETURNING) je úmyslně odložena
    // — viz ADR-001 (drž produkční výseč jednoduchou).
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const dailyKey = `ai_chat_daily:${todayStr}`;
      const dailyCountStr = await env.CACHE.get(dailyKey);
      const dailyCount = dailyCountStr ? parseInt(dailyCountStr, 10) : 0;

      if (dailyCount >= AI_CHAT_DAILY_CAP) {
        // Soft fail: return a polite automated message under HTTP 200 so the chat widget does not break
        return new Response(
          JSON.stringify({
            success: true,
            reply: 'Pro dnešek je AI poradna vytížená — napište nám prosím přes kontaktní formulář nebo zavolejte, rádi vám odpovíme osobně.',
            conversationId: convId
          }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      // Increment daily count in KV cache (with a 48h TTL)
      await env.CACHE.put(dailyKey, (dailyCount + 1).toString(), { expirationTtl: 172800 });
    } catch (err) {
      console.warn('[chat] daily cap KV error — fail-open:', err);
    }

    // 2. Load context (services catalog + FAQ)
    const [servicesCtx, faqCtx] = await Promise.all([
      loadServicesContext(env),
      loadFaqContext(env),
    ]);

    // 3. Build skill-based messages from runtime config + contexts
    const runtimeConfig = await loadAiRuntimeConfig(env);
    const buildChatSkill = getSkill('chatbot');
    const { messages } = buildChatSkill({
      message,
      servicesContext: servicesCtx,
      faqContext: faqCtx,
      runtimeConfig,
    });

    // 4. Call shared AI providers chain
    let aiResult;
    try {
      aiResult = await runText({
        env,
        messages,
        maxTokens: 512,
        temperature: 0.7,
      });
    } catch (err) {
      console.error('[chat] AI providers failed:', err?.details || err?.message || err);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Omlouváme se, momentálně nemůžeme odpovědět. Kontaktujte nás prosím přímo.',
        }),
        { status: 503, headers: CORS_HEADERS }
      );
    }

    let reply = aiResult.text;

    // 5. Check for forbidden words and censor if needed
    let escalate = false;
    if (containsForbiddenWords(reply)) {
      reply = censorResponse(reply);
      escalate = true;
    }

    // 6. Audit log (non-blocking)
    waitUntil(
      (async () => {
        try {
          await env.DB.prepare(
            `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
             VALUES (?, 'chat', ?, 'create', 'user', ?)`
          ).bind(
            crypto.randomUUID(),
            convId,
            JSON.stringify({
              message_length: message.length,
              provider: aiResult?.provider || 'none',
              model: aiResult?.model || 'none',
              censored: escalate,
            })
          ).run();

          // If escalation needed, notify via Telegram
          if (escalate) {
            const { TelegramConnector } = await import('../lib/connectors/telegram.js');
            const telegram = new TelegramConnector(env);
            await telegram.sendMessage(
              `⚠️ <b>AI Chat Eskalace</b>\n\nAI odpověď obsahovala zakázaná slova a byla automaticky cenzurována.\n\nPůvodní dotaz: ${message.substring(0, 200)}`
            );
          }
        } catch (err) {
          console.error('[chat] Audit log error:', err);
        }
      })()
    );

    // 7. Return response
    return new Response(
      JSON.stringify({ success: true, reply, conversationId: convId }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[chat] Unexpected error:', err);
    return new Response(
      JSON.stringify({ success: false, error: 'Interní chyba serveru.' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
