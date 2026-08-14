/**
 * Netlify AI providers chain for text generation.
 * Multi-tier fallback: Groq (Llama 3.3/3.1) -> Gemini (2.0 Flash) -> Cloudflare Workers AI (REST API).
 */

function toGeminiContents(messages) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

/**
 * Runs text inference with provider fallback: Groq -> Gemini -> Cloudflare REST.
 * Throws when all providers fail.
 *
 * @param {Object} params
 * @param {Object} [params.env] - Optional env object (falls back to process.env)
 * @param {{role:string,content:string}[]} params.messages
 * @param {number} [params.maxTokens=1024]
 * @param {number} [params.temperature=0.7]
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
export async function runText({
  env = {},
  messages,
  maxTokens = 1024,
  temperature = 0.7,
}) {
  const getEnv = (key) => env[key] || process.env[key];
  const failures = [];

  // 1. Primární vrstva: GROQ (Llama 3.3 70B / Llama 3.1 8B) — extrémně rychlé REST API
  const groqApiKey = getEnv('SECRET_GROQ_API_KEY') || getEnv('GROQ_API_KEY');
  if (groqApiKey) {
    const model = getEnv('GROQ_MODEL') || 'llama-3.3-70b-versatile';
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content?.trim();
        if (text) {
          return { text, provider: 'groq', model };
        }
        failures.push({ provider: 'groq', reason: 'empty_response' });
      } else {
        failures.push({ provider: 'groq', reason: `http_${response.status}` });
      }
    } catch (err) {
      failures.push({ provider: 'groq', reason: err?.message || 'request_failed' });
    }
  } else {
    failures.push({ provider: 'groq', reason: 'key_missing' });
  }

  // 2. Záložní vrstva: GOOGLE GEMINI (gemini-2.0-flash / gemini-1.5-flash)
  const geminiApiKey = getEnv('SECRET_GEMINI_API_KEY') || getEnv('GEMINI_API_KEY');
  if (geminiApiKey) {
    const model = getEnv('GEMINI_MODEL') || 'gemini-2.0-flash';
    try {
      const systemInstruction = messages.find((m) => m.role === 'system');
      const contents = toGeminiContents(messages);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            systemInstruction: systemInstruction
              ? { parts: [{ text: systemInstruction.content }] }
              : undefined,
            generationConfig: {
              maxOutputTokens: maxTokens,
              temperature,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) {
          return { text, provider: 'gemini', model };
        }
        failures.push({ provider: 'gemini', reason: 'empty_response' });
      } else {
        failures.push({ provider: 'gemini', reason: `http_${response.status}` });
      }
    } catch (err) {
      failures.push({ provider: 'gemini', reason: err?.message || 'request_failed' });
    }
  } else {
    failures.push({ provider: 'gemini', reason: 'key_missing' });
  }

  // 3. Terciární vrstva: Cloudflare Workers AI přes REST API (volitelně, pokud jsou zadány tokeny)
  const cfAccountId = getEnv('CLOUDFLARE_ACCOUNT_ID');
  const cfApiToken = getEnv('CLOUDFLARE_API_TOKEN');
  if (cfAccountId && cfApiToken) {
    const model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/${model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            max_tokens: maxTokens,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.result?.response?.trim();
        if (text) {
          return { text, provider: 'workers-ai-rest', model };
        }
        failures.push({ provider: 'workers-ai-rest', reason: 'empty_response' });
      } else {
        failures.push({ provider: 'workers-ai-rest', reason: `http_${response.status}` });
      }
    } catch (err) {
      failures.push({ provider: 'workers-ai-rest', reason: err?.message || 'request_failed' });
    }
  }

  const reasons = failures.map((f) => `${f.provider}:${f.reason}`).join(', ');
  throw new Error(`[ai-providers] Všichni AI provideři selhali: ${reasons}`);
}
