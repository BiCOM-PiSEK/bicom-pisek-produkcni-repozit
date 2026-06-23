/**
 * Shared AI providers chain for text generation.
 * Single source of truth for model selection and fallback behavior.
 */

function base64ToUint8Array(base64) {
  if (!base64 || typeof base64 !== 'string') return null;
  const cleaned = base64.includes(',') ? base64.split(',').pop() : base64;

  if (typeof atob === 'function') {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  // Fallback for environments exposing Buffer (e.g. local node tools).
  // eslint-disable-next-line no-undef
  if (typeof Buffer !== 'undefined') {
    // eslint-disable-next-line no-undef
    return new Uint8Array(Buffer.from(cleaned, 'base64'));
  }
  return null;
}

function toGeminiContents(messages) {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
}

/**
 * Runs text inference with provider fallback: Workers AI -> Groq -> Gemini.
 * Throws when all providers fail.
 *
 * @param {Object} params
 * @param {Object} params.env
 * @param {{role:string,content:string}[]} params.messages
 * @param {number} [params.maxTokens=1024]
 * @param {number} [params.temperature=0.7]
 * @returns {Promise<{text:string, provider:string, model:string}>}
 */
export async function runText({
  env,
  messages,
  maxTokens = 1024,
  temperature = 0.7,
}) {
  const failures = [];

  if (env.AI) {
    const model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    try {
      const result = await env.AI.run(model, {
        messages,
        max_tokens: maxTokens,
      });
      const text = result?.response?.trim();
      if (text) {
        return { text, provider: 'workers-ai', model };
      }
      failures.push({ provider: 'workers-ai', reason: 'empty_response' });
    } catch (err) {
      failures.push({ provider: 'workers-ai', reason: err?.message || 'request_failed' });
    }
  } else {
    failures.push({ provider: 'workers-ai', reason: 'binding_missing' });
  }

  if (env.SECRET_GROQ_API_KEY) {
    const model = 'llama-3.1-8b-instant';
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SECRET_GROQ_API_KEY}`,
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

  if (env.SECRET_GEMINI_API_KEY) {
    const model = 'gemini-2.0-flash';
    try {
      const systemInstruction = messages.find((m) => m.role === 'system');
      const contents = toGeminiContents(messages);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.SECRET_GEMINI_API_KEY}`,
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

  const error = new Error('No AI provider returned a response');
  error.details = failures;
  throw error;
}

function tryExtractImageFromWorkersResult(result) {
  if (!result) return null;

  // Direct binary response
  if (result instanceof ArrayBuffer) {
    return { bytes: new Uint8Array(result), mimeType: 'image/png' };
  }
  if (result instanceof Uint8Array) {
    return { bytes: result, mimeType: 'image/png' };
  }

  // Common payload shapes
  const b64 =
    result?.image ||
    result?.result?.image ||
    result?.data?.[0]?.b64_json ||
    result?.output?.[0]?.image ||
    result?.images?.[0]?.b64_json ||
    null;

  if (b64) {
    const bytes = base64ToUint8Array(b64);
    if (bytes?.length) {
      const mimeType = result?.mimeType || result?.type || 'image/png';
      return { bytes, mimeType };
    }
  }
  return null;
}

async function callWorkersImage(env, model, { prompt, negativePrompt, width, height, steps }) {
  const result = await env.AI.run(model, {
    prompt,
    negative_prompt: negativePrompt,
    width,
    height,
    num_inference_steps: steps,
  });
  const extracted = tryExtractImageFromWorkersResult(result);
  if (!extracted) throw new Error(`empty_image:${model}`);
  return extracted;
}

async function callGeminiImage(env, { prompt }) {
  if (!env.SECRET_GEMINI_API_KEY) throw new Error('gemini_key_missing');
  const model = 'gemini-2.0-flash-preview-image-generation';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.SECRET_GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    }
  );
  if (!response.ok) throw new Error(`gemini_http_${response.status}`);
  const data = await response.json();
  const inlineData = data?.candidates?.[0]?.content?.parts?.find((p) => p?.inlineData)?.inlineData;
  if (!inlineData?.data) throw new Error('gemini_empty_image');
  const bytes = base64ToUint8Array(inlineData.data);
  if (!bytes?.length) throw new Error('gemini_decode_failed');
  return { bytes, mimeType: inlineData.mimeType || 'image/png', model };
}

/**
 * Runs image inference with provider fallback:
 * Workers AI Lucid Origin -> Workers AI Flux -> Gemini image model.
 *
 * @param {Object} params
 * @param {Object} params.env
 * @param {string} params.prompt
 * @param {string} [params.negativePrompt]
 * @param {number} [params.width=1024]
 * @param {number} [params.height=1024]
 * @param {number} [params.steps=28]
 * @returns {Promise<{bytes:Uint8Array, mimeType:string, provider:string, model:string}>}
 */
export async function runImage({
  env,
  prompt,
  negativePrompt = '',
  width = 1024,
  height = 1024,
  steps = 28,
}) {
  const failures = [];

  if (env.AI) {
    const lucidModel = '@cf/leonardo/lucid-origin';
    try {
      const extracted = await callWorkersImage(env, lucidModel, {
        prompt,
        negativePrompt,
        width,
        height,
        steps,
      });
      return { ...extracted, provider: 'workers-ai', model: lucidModel };
    } catch (err) {
      failures.push({ provider: 'workers-ai', model: lucidModel, reason: err?.message || 'request_failed' });
    }

    const fluxModel = '@cf/black-forest-labs/flux-1-schnell';
    try {
      const extracted = await callWorkersImage(env, fluxModel, {
        prompt,
        negativePrompt,
        width,
        height,
        steps,
      });
      return { ...extracted, provider: 'workers-ai', model: fluxModel };
    } catch (err) {
      failures.push({ provider: 'workers-ai', model: fluxModel, reason: err?.message || 'request_failed' });
    }
  } else {
    failures.push({ provider: 'workers-ai', reason: 'binding_missing' });
  }

  try {
    const geminiResult = await callGeminiImage(env, { prompt });
    return {
      bytes: geminiResult.bytes,
      mimeType: geminiResult.mimeType,
      provider: 'gemini',
      model: geminiResult.model,
    };
  } catch (err) {
    failures.push({ provider: 'gemini', reason: err?.message || 'request_failed' });
  }

  const error = new Error('No image provider returned a response');
  error.details = failures;
  throw error;
}
