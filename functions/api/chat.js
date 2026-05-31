// POST /api/chat
// AI-powered chat assistant for Bicom Písek.
// Uses Workers AI (Llama 3), with Groq and Gemini API fallbacks.
// Enforces medical-legal language filters.

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

// System prompt — Quiet Luxury tone, empathetic, legally compliant
const SYSTEM_PROMPT = `Jsi AI rádce kliniky Bicom Písek. Tvoje role je pomáhat návštěvníkům webu s otázkami o biorezonanční terapii.

PRAVIDLA:
1. Odpovídej VŽDY česky, empaticky a srozumitelně.
2. NIKDY nepoužívej slova: léčí, vyléčí, zaručeně, garantujeme, 100%.
3. VŽDY používej: podporuje, pomáhá, komplementární, doplněk klasické medicíny, mnozí klienti uvádějí.
4. Doporučuj konkrétní služby z katalogu Bicom Písek s orientačními cenami.
5. Pokud si nejsi jistý/á odpovědí, řekni "Na tuto otázku Vám rádi odpovíme e-mailem nebo telefonicky" a eskaluj.
6. Biorezonanční terapie je DOPLŇKOVÁ metoda, nikdy nenahrazuje lékařskou péči.
7. U dětí vždy zmiň nutnost souhlasu rodiče.
8. Buď stručný/á — max 3-4 věty na odpověď, pokud se uživatel neptá na detail.`;

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
        .map((s) => `- ${s.name}: ${s.description || ''} (${s.price || '—'} Kč)`)
        .join('\n');
    }

    const { results } = await env.DB.prepare(
      'SELECT name, description, price FROM services WHERE active = 1 ORDER BY sort_order'
    ).all();

    if (results?.length) {
      return results
        .map((s) => `- ${s.name}: ${s.description || ''} (${s.price || '—'} Kč)`)
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
      "SELECT title, body FROM content_blocks WHERE type = 'faq' AND active = 1 LIMIT 20"
    ).all();

    if (results?.length) {
      return results
        .map((faq) => `Q: ${faq.title}\nA: ${faq.body}`)
        .join('\n\n');
    }
  } catch (err) {
    console.error('[chat] Failed to load FAQ context:', err);
  }
  return '';
}

/**
 * Calls Workers AI inference.
 * @param {Object} env
 * @param {Array} messages
 * @returns {Promise<string|null>}
 */
async function callWorkersAI(env, messages) {
  try {
    const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', { messages });
    return result?.response || null;
  } catch (err) {
    console.error('[chat] Workers AI error:', err);
    return null;
  }
}

/**
 * Fallback: Groq API inference.
 * @param {Object} env
 * @param {Array} messages
 * @returns {Promise<string|null>}
 */
async function callGroqAPI(env, messages) {
  if (!env.SECRET_GROQ_API_KEY) return null;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.SECRET_GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages,
        max_tokens: 512,
        temperature: 0.7,
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[chat] Groq API error:', err);
    return null;
  }
}

/**
 * Fallback: Gemini API inference.
 * @param {Object} env
 * @param {Array} messages
 * @returns {Promise<string|null>}
 */
async function callGeminiAPI(env, messages) {
  if (!env.SECRET_GEMINI_API_KEY) return null;

  try {
    // Convert OpenAI-style messages to Gemini format
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const systemInstruction = messages.find((m) => m.role === 'system');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.SECRET_GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction.content }] }
            : undefined,
          generationConfig: {
            maxOutputTokens: 512,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) return null;
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.error('[chat] Gemini API error:', err);
    return null;
  }
}

/**
 * POST /api/chat — AI chat assistant.
 */
export async function onRequestPost({ request, env, waitUntil }) {
  try {
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

    // 2. Load context (services catalog + FAQ)
    const [servicesCtx, faqCtx] = await Promise.all([
      loadServicesContext(env),
      loadFaqContext(env),
    ]);

    // 3. Build messages array with system prompt + context
    let systemContent = SYSTEM_PROMPT;

    if (servicesCtx) {
      systemContent += `\n\nKATALOG SLUŽEB:\n${servicesCtx}`;
    }

    if (faqCtx) {
      systemContent += `\n\nČASTO KLADENÉ OTÁZKY:\n${faqCtx}`;
    }

    const messages = [
      { role: 'system', content: systemContent },
      { role: 'user', content: message.trim() },
    ];

    // 4. Call AI with cascade fallback: Workers AI → Groq → Gemini
    let reply = await callWorkersAI(env, messages);

    if (!reply) {
      reply = await callGroqAPI(env, messages);
    }

    if (!reply) {
      reply = await callGeminiAPI(env, messages);
    }

    // If all providers failed
    if (!reply) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Omlouváme se, momentálně nemůžeme odpovědět. Kontaktujte nás prosím přímo.',
        }),
        { status: 503, headers: CORS_HEADERS }
      );
    }

    // 5. Check for forbidden words and censor if needed
    let escalate = false;
    if (containsForbiddenWords(reply)) {
      reply = censorResponse(reply);
      escalate = true;
    }

    // Generate conversation ID if not provided
    const convId = conversationId || crypto.randomUUID();

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
              provider: reply ? 'ai' : 'none',
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
