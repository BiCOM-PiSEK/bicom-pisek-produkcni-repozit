/**
 * BICOM PÍSEK — AI Copywriter Admin API
 * POST /admin/copywriter — generování obsahu
 */

import { runText } from '../lib/ai/providers.js';
import { getSkill } from '../lib/ai/skills/index.js';
import { loadAiRuntimeConfig } from '../lib/ai/skills/runtime-config.js';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

const MAX_TOKENS_BLOG = 6144;
const MAX_TOKENS_SOCIAL = 600;

export async function onRequestPost({ env, data, request }) {
  if (!data.operator) return json({ ok: false, error: 'Neoprávněný přístup' }, 401);

  try {
    const body = await request.json();
    const { prompt, type = 'blog', service } = body;

    if (!prompt?.trim()) return json({ ok: false, error: 'Zadejte téma.' }, 400);

    const runtimeConfig = await loadAiRuntimeConfig(env);

    const maxTokens = type === 'social' ? MAX_TOKENS_SOCIAL : MAX_TOKENS_BLOG;

    const buildTextSkill = getSkill('text-content');
    const { messages, strictness } = buildTextSkill({
      type,
      prompt,
      service,
      runtimeConfig,
    });

    let generated = null;
    let providerInfo = null;
    try {
      const result = await runText({
        env,
        messages,
        maxTokens,
        temperature: 0.7,
      });
      providerInfo = { provider: result.provider, model: result.model };
      generated = parseDelimited(result.text);
    } catch (err) {
      console.warn('[copywriter] All providers failed:', err?.details || err?.message || err);
    }

    if (!generated) {
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
         VALUES (?, 'blog_posts', ?, 'create', ?, ?)`
      ).bind(
        crypto.randomUUID(),
        postId,
        `operator:${data.operator.id}`,
        `AI-generated draft ${JSON.stringify({
         provider: providerInfo?.provider || 'unknown',
         model: providerInfo?.model || 'unknown',
         type,
         strictness,
         prompt_profile: runtimeConfig.ai_studio_prompt_profile || 'default',
        })}`
      ),
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
