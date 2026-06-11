/**
 * BICOM PÍSEK — AI Copywriter Admin API
 * POST /admin/copywriter — generování obsahu
 */

import { buildSystemPrompt, normalizeStrictness } from '../lib/guardrail/index.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const MAX_TOKENS_BLOG = 6144;
const MAX_TOKENS_SOCIAL = 600;

/** Base style prompt for AI — Quiet Luxury tone and formatting guidelines */
const BASE_STYLE_PROMPT = `Jsi AI copywriter pro Bicom Písek — centrum biorezonanční metody BICOM.
Píšeš v češtině, tónem "Quiet Luxury" — vřelý, profesionální, empatický, nikdy ne klinický.
Jazyk je jako náruč, která obejme — ne medicínský text.

STYL:
- Krátké odstavce (max 3 věty)
- Emoce + fakta v rovnováze
- CTA na konci (objednávka, kontakt)
- Pro blog: 800-1200 slov, pro social: max 80 slov
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

    const maxTokens = type === 'social' ? MAX_TOKENS_SOCIAL : MAX_TOKENS_BLOG;

    // Build user prompt
    let userPrompt = `Napiš ${type === 'blog' ? 'blog článek' : type === 'social' ? 'příspěvek na sociální sítě' : 'newsletter'} na téma: ${prompt}`;
    if (service) userPrompt += `\nKontext služby: ${service}`;

    userPrompt += '\n\nSTRUKTURA A FORMÁT:';
    if (type === 'blog') {
      userPrompt += `
- Rozsah článku: 800–1200 slov v češtině.
- Úvodní odstavec: BEZ nadpisu (2-3 věty pro vtažení čtenáře do tématu).
- Hlavní část: 3-5 sekcí uvozených nadpisy '## '. V případě potřeby detailnějšího členění použij podnadpisy '### '.
- Povinné prvky: alespoň jeden seznam s odrážkami (každý řádek začíná na '- ') a alespoň jeden zvýrazněný tip nebo citace (každý řádek začíná na '> ').
- Závěr: jemná, nenásilná pozvánka k rezervaci konzultace (žádný agresivní ani tvrdý prodej).
- Styl psaní: konkrétně, prakticky, žádná vata ani prázdné fráze. Odstavce odděluj výhradně prázdným řádkem.
- Povolená markdown syntaxe: ##, ###, **, *, "- ", "> ". Žádná jiná (např. nepoužívej #, ####, atd.).`;
    } else if (type === 'social') {
      userPrompt += `
- Rozsah příspěvku: velmi stručný, maximálně cca 80 slov.
- Formátování: zcela bez nadpisů, bez markdown nadpisů.
- Emoji: maximálně 1-2 emoji v celém textu.
- Hashtagy: nepoužívej záplavu hashtagů, maximálně 3 hashtagy na konci.`;
    } else {
      userPrompt += `
- Rozsah newsletteru: 200–400 slov.
- Styl: informativní, osobní, s jasným CTA.`;
    }

    userPrompt += `
- Excerpt (pouták): 150–200 znaků dlouhý prostý text bez jakéhokoliv markdown formátování.

DŮLEŽITÉ POKYNY PRO FORMÁT ODPOVĚDI:
Odpověz PŘESNĚ v tomto formátu, bez jakéhokoli textu navíc:
===TITLE===
(titulek na jeden řádek)
===EXCERPT===
(perex 150-200 znaků, prostý text, jeden odstavec)
===CONTENT===
(celý obsah v markdownu)
===END===`;

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
          max_tokens: maxTokens,
        });
        const text = aiRes?.response || '';
        if (text) {
          rawResponseText = text;
          generated = parseDelimited(text);
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
            max_tokens: maxTokens,
            temperature: 0.7,
          }),
        });
        const groqData = await groqRes.json();
        const text = groqData.choices?.[0]?.message?.content || '';
        if (text) {
          rawResponseText = text;
          generated = parseDelimited(text);
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
            generationConfig: {
              maxOutputTokens: maxTokens
            }
          }),
        });
        const gemData = await gemRes.json();
        const text = gemData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (text) {
          rawResponseText = text;
          generated = parseDelimited(text);
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

function parseDelimited(text) {
  if (!text) return null;

  // Odstraň případné ```markdown nebo ``` na úplném začátku/konci
  const cleaned = text
    .replace(/^```[a-z]*\s*\n?/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const titleRegex = /===\s*TITLE\s*===/i;
  const excerptRegex = /===\s*EXCERPT\s*===/i;
  const contentRegex = /===\s*CONTENT\s*===/i;
  const endRegex = /===\s*END\s*===/i;

  const titleMatch = cleaned.match(titleRegex);
  const excerptMatch = cleaned.match(excerptRegex);
  const contentMatch = cleaned.match(contentRegex);
  const endMatch = cleaned.match(endRegex);

  // Musíme mít aspoň TITLE a CONTENT
  if (!titleMatch || !contentMatch) return null;

  const titleIdx = titleMatch.index + titleMatch[0].length;
  let excerptStartIdx = -1;
  let excerptEndIdx = -1;
  let contentStartIdx = contentMatch.index + contentMatch[0].length;
  let contentEndIdx = -1;

  if (excerptMatch) {
    excerptStartIdx = excerptMatch.index + excerptMatch[0].length;
  }

  let titleEndIdx = -1;
  if (excerptMatch && excerptMatch.index > titleMatch.index) {
    titleEndIdx = excerptMatch.index;
  } else {
    titleEndIdx = contentMatch.index;
  }

  const title = cleaned.slice(titleIdx, titleEndIdx).trim();

  let excerpt = '';
  if (excerptMatch) {
    excerptEndIdx = contentMatch.index;
    excerpt = cleaned.slice(excerptStartIdx, excerptEndIdx).trim();
  }

  if (endMatch && endMatch.index > contentMatch.index) {
    contentEndIdx = endMatch.index;
  } else {
    contentEndIdx = cleaned.length;
  }

  let content = cleaned.slice(contentStartIdx, contentEndIdx).trim();

  // Validace
  if (!title || !content) return null;

  // Oříznutí neúplné věty při chybějícím ===END===
  if (!endMatch) {
    const lastPunctuation = Math.max(
      content.lastIndexOf('.'),
      content.lastIndexOf('!'),
      content.lastIndexOf('?')
    );
    if (lastPunctuation !== -1 && lastPunctuation < content.length - 1) {
      const trailingPart = content.slice(lastPunctuation + 1).trim();
      if (/[a-zA-Zá-žÁ-Ž0-9]/.test(trailingPart)) {
        content = content.slice(0, lastPunctuation + 1).trim();
      }
    }
  }

  // Fallback pro chybějící excerpt
  if (!excerpt) {
    let cleanText = content
      .replace(/#+\s+/g, '')
      .replace(/[*_`]/g, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*>\s+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanText.length > 180) {
      let cutIdx = cleanText.indexOf(' ', 175);
      if (cutIdx === -1 || cutIdx > 200) {
        cutIdx = 180;
      }
      excerpt = cleanText.slice(0, cutIdx).trim() + '...';
    } else {
      excerpt = cleanText;
    }
  }

  return { title, excerpt, content };
}

function slugify(text) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}
