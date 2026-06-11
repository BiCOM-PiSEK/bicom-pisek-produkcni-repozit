/**
 * BICOM PÍSEK — AI Copywriter Admin API
 * POST /admin/copywriter — generování obsahu
 */

import { buildSystemPrompt, normalizeStrictness } from '../lib/guardrail/index.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

/** Base style prompt for AI — Quiet Luxury tone and formatting guidelines */
const BASE_STYLE_PROMPT = `Jsi AI copywriter pro Bicom Písek — centrum biorezonanční metody BICOM.
Píšeš v češtině, tónem "Quiet Luxury" — vřelý, profesionální, empatický, nikdy ne klinický.
Jazyk je jako náruč, která obejme — ne medicínský text.

STYL:
- Krátké odstavce (max 3 věty)
- Emoce + fakta v rovnováze
- CTA na konci (objednávka, kontakt)
- Pro blog: 400-600 slov, pro social: 150-250 slov
- Pro newsletter: 200-400 slov`;

export async function onRequestPost({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const body = await request.json();
    const { prompt, type = 'blog', service } = body;

    if (!prompt?.trim()) return json({ ok: false, error: 'Zadejte téma.' }, 400);

    // Read strictness from process_states
    const rowGuardrail = await env.DB.prepare(
      "SELECT value FROM process_states WHERE key = 'ai_legal_guardrail'"
    ).first();
    const strictness = normalizeStrictness(rowGuardrail?.value);

    const systemPrompt = buildSystemPrompt({
      tool: 'health',
      strictness,
      baseStyle: BASE_STYLE_PROMPT,
    });

    // Build user prompt
    let userPrompt = `Napiš ${type === 'blog' ? 'blog článek' : type === 'social' ? 'příspěvek na sociální sítě' : 'newsletter'} na téma: ${prompt}`;
    if (service) userPrompt += `\nKontext služby: ${service}`;
    userPrompt += '\nVrať JSON: { "title": "...", "content": "...", "excerpt": "..." }';

    let generated = null;
    let rawResponseText = null;

    // Chain: Workers AI → fallback
    if (env.AI) {
      try {
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1500,
        });
        const text = aiRes?.response || '';
        if (text) {
          rawResponseText = text;
          generated = tryParseJSON(text);
        }
      } catch (err) {
        console.warn('[copywriter] Workers AI failed:', err.message);
      }
    }

    // Groq fallback
    if (!generated && env.SECRET_GROQ_API_KEY) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.SECRET_GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 1500,
            temperature: 0.7,
          }),
        });
        const groqData = await groqRes.json();
        const text = groqData.choices?.[0]?.message?.content || '';
        if (text) {
          rawResponseText = text;
          generated = tryParseJSON(text);
        }
      } catch (err) {
        console.warn('[copywriter] Groq fallback failed:', err.message);
      }
    }

    // Gemini fallback
    if (!generated && env.SECRET_GEMINI_API_KEY) {
      try {
        const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.SECRET_GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
          }),
        });
        const gemData = await gemRes.json();
        const text = gemData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          rawResponseText = text;
          generated = tryParseJSON(text);
        }
      } catch (err) {
        console.warn('[copywriter] Gemini fallback failed:', err.message);
      }
    }

    if (!generated) {
      if (rawResponseText) {
        return json({ ok: false, error: 'AI vrátila neplatný formát, zkuste generovat znovu.' }, 400);
      }
      return json({ ok: false, error: 'Žádný AI provider nedostupný. Zkontrolujte API klíče.' }, 503);
    }

    // Save as draft to blog_posts
    const postId = crypto.randomUUID();
    const slug = slugify(generated.title);

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO blog_posts (id, slug, title, excerpt, content, source, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'ai_copywriter', 'draft', datetime('now'))`
      ).bind(postId, slug, generated.title, generated.excerpt || '', generated.content),
      env.DB.prepare(
        `INSERT INTO audit_log (id, entity, entity_id, action, actor, details)
         VALUES (?, 'blog_posts', ?, 'create', ?, 'AI-generated draft')`
      ).bind(crypto.randomUUID(), postId, `operator:${data.operator.id}`),
    ]);

    return json({
      ok: true,
      data: {
        id: postId,
        title: generated.title,
        content: generated.content,
        excerpt: generated.excerpt,
        slug,
      },
    });
  } catch (err) {
    console.error('[admin/copywriter] Error:', err);
    return json({ ok: false, error: 'Interní chyba.' }, 500);
  }
}

function tryParseJSON(text) {
  if (!text) return null;
  // Odstraň případné ```json / ``` ploty
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed && typeof parsed === 'object' && parsed.title && parsed.content) {
        return parsed;
      }
    }
  } catch { /* noop */ }
  return null;
}

function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
