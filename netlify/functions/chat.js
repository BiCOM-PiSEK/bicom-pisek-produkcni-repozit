import { runText } from '../lib/ai/providers.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const SYSTEM_PROMPT = `
Jsi „AI Rádce" praxe Bicom Písek. Mluvíš česky, klidně, empaticky,
v tónu „Quiet Luxury". NIKDY neslibuješ léčbu ani konkrétní výsledek. Používáš slova
„podpora, komplementární, doplněk klasické medicíny". Při dotazech na vážné nemoci
(onkologie, infekční, psychiatrické dg.) doporučíš lékaře a nenabízíš biorezonanci jako
řešení. Vždy nabídneš objednání na konzultaci. Odpovídáš stručně a výstižně (2–5 vět). Zdroj faktů: katalog certifikovaných programů biorezonance Bicom Optima v Písku.
`;

const FORBIDDEN_WORDS = [
  'léčí', 'vyléčí', 'zaručeně', 'garantujeme', '100%',
  'leci', 'vyleci', 'zarucene', 'garantujeme',
];

function sanitizeAiResponse(text) {
  let censored = text;
  const replacements = {
    'léčí': 'podporuje',
    'vyléčí': 'pomáhá',
    'zaručeně': 'podle zkušeností klientů',
    'garantujeme': 'usilujeme o',
    '100%': 've většině případů',
  };

  for (const [forbidden, safe] of Object.entries(replacements)) {
    const regex = new RegExp(forbidden, 'gi');
    censored = censored.replace(regex, safe);
  }

  return censored;
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: CORS_HEADERS,
    });
  }

  try {
    const body = await request.json();
    const userMessage = (body.message || '').trim();

    if (!userMessage || userMessage.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Zadejte prosím dotaz pro AI Rádce.' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT.trim() },
      ...(Array.isArray(body.history) ? body.history.slice(-6) : []),
      { role: 'user', content: userMessage },
    ];

    const result = await runText({
      env: process.env,
      messages,
      maxTokens: 512,
      temperature: 0.6,
    });

    const cleanText = sanitizeAiResponse(result.text);

    return new Response(
      JSON.stringify({
        reply: cleanText,
        provider: result.provider,
        model: result.model,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[api/chat] Error:', err);
    return new Response(
      JSON.stringify({
        reply: 'Omlouváme se, náš AI Rádce je momentálně nedostupný. Pro dotazy nás prosím kontaktujte přímo přes formulář nebo telefon.',
        error: err.message,
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/api/chat',
};
