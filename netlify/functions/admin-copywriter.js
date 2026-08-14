// netlify/functions/admin-copywriter.js
// AI Copywriter pro generování odborných článků a sociálních postů v tónu Quiet Luxury.

import { authenticateOperator } from '../lib/admin-auth.js';
import { runText } from '../lib/ai/providers.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { recordAuditLog } from '../lib/db-supabase.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

const COPYWRITER_SYSTEM_PROMPT = `
Jsi špičkový medicínsko-wellness copywriter pro praxi Bicom Písek.
Píšeš v elegantním tónu „Quiet Luxury":
- Klidný, autoritativní, srozumitelný a věcný tón.
- Žádné ezoterické klišé, žádné senzacechtivé sliby, žádné vykřičníky.
- NIKDY nepoužívej zakázaná slova: léčí, vyléčí, zaručeně, 100%, garantujeme.
- Používej formulace: harmonizace, podpora přirozených procesů těla, biorezonanční technologie Bicom Optima, komplementární přístup k celostnímu zdraví.
`;

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const operator = await authenticateOperator(request);
  if (!operator) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Neautorizovaný přístup.' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const body = await request.json();
    const { topic, target_segment, format } = body;

    if (!topic || topic.length < 3) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Zadejte téma článku nebo příspěvku.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const prompt = `
Vytvoř ${format || 'článek na blog'} na téma: "${topic}".
Cílová skupina: ${target_segment || 'všichni klienti hledající rovnováhu a prevenci'}.

Struktura výstupu ve formátu JSON:
{
  "title": "Chytlavý a důstojný titulek",
  "excerpt": "Stručný perex (2 věty)",
  "content_markdown": "Plné tělo článku v přehledném Markdownu s mezititulky",
  "instagram_caption": "Text pro Instagram post včetně 5 relevantních hashtagů"
}
Vrať POUZE validní JSON bez markdownových backticků okolo.
`;

    const result = await runText({
      env: process.env,
      messages: [
        { role: 'system', content: COPYWRITER_SYSTEM_PROMPT.trim() },
        { role: 'user', content: prompt.trim() },
      ],
      maxTokens: 1500,
      temperature: 0.7,
    });

    let generatedJson;
    try {
      const clean = result.text.replace(/```json/g, '').replace(/```/g, '').trim();
      generatedJson = JSON.parse(clean);
    } catch {
      generatedJson = {
        title: topic,
        excerpt: '',
        content_markdown: result.text,
        instagram_caption: '',
      };
    }

    const supabase = getSupabaseAdmin();
    await recordAuditLog(supabase, 'ai_jobs', crypto.randomUUID(), 'create', `operator:${operator.id}`, `AI Copywriter vygeneroval článek na téma: ${topic}`);

    return new Response(
      JSON.stringify({
        ok: true,
        article: generatedJson,
        provider: result.provider,
        model: result.model,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[admin-copywriter] Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Chyba při generování textu.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/admin/copywriter',
};
