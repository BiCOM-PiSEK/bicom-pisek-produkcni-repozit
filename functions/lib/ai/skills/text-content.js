import { buildSystemPrompt, normalizeStrictness } from '../../guardrail/index.js';

const COPYWRITER_STYLE = `Jsi AI copywriter pro Bicom Písek — centrum biorezonanční metody BICOM.
Píšeš v češtině, tónem "Quiet Luxury" — vřelý, profesionální, empatický, nikdy ne klinický.
Jazyk je jako náruč, která obejme — ne medicínský text.

STYL:
- Krátké odstavce (max 3 věty)
- Emoce + fakta v rovnováze
- CTA na konci (objednávka, kontakt)
- Pro blog: 800-1200 slov, pro social: max 80 slov
- Pro newsletter: 200-400 slov`;

function buildOutputContract(type) {
  let structure = '\n\nSTRUKTURA A FORMÁT:';
  if (type === 'blog') {
    structure += `
- Rozsah článku: 800-1200 slov v češtině.
- Úvodní odstavec: BEZ nadpisu (2-3 věty).
- Hlavní část: 3-5 sekcí uvozených nadpisy '## '.
- Povinné prvky: aspoň jeden odrážkový seznam a jeden zvýrazněný tip/citace.
- Závěr: jemná pozvánka k rezervaci konzultace.
- Povolená markdown syntaxe: ##, ###, **, *, "- ", "> ".`;
  } else if (type === 'social') {
    structure += `
- Rozsah: max cca 80 slov.
- Bez markdown nadpisů.
- Emoji: max 1-2.
- Hashtagy: max 3 na konci.`;
  } else {
    structure += `
- Rozsah newsletteru: 200-400 slov.
- Styl: informativní, osobní, s jasným CTA.`;
  }

  return `${structure}
- Excerpt (pouták): 150-200 znaků, prostý text.

DULEZITE POKYNY PRO FORMAT ODPOVEDI:
Odpovez PRESNE v tomto formatu, bez textu navic:
===TITLE===
(titulek na jeden radek)
===EXCERPT===
(perex 150-200 znaku)
===CONTENT===
(cely obsah v markdownu)
===END===`;
}

/**
 * Builds system+user messages for text generation.
 * @param {Object} params
 * @param {'blog'|'social'|'newsletter'} params.type
 * @param {string} params.prompt
 * @param {string} [params.service]
 * @param {Record<string,string>} params.runtimeConfig
 * @returns {{messages: {role:string,content:string}[], strictness:string}}
 */
export function buildTextContentMessages({ type, prompt, service, runtimeConfig }) {
  const strictness = normalizeStrictness(runtimeConfig.ai_legal_guardrail);
  const promptProfile = runtimeConfig.ai_studio_prompt_profile || 'default';
  const promptsEnabled = runtimeConfig.ai_studio_prompts_enabled !== '0';
  const tone = runtimeConfig.ai_copywriter_tone || 'quiet_luxury';

  const baseStyle = promptsEnabled
    ? `${COPYWRITER_STYLE}\n\nPROMPT_PROFILE: ${promptProfile}\nTONE: ${tone}`
    : COPYWRITER_STYLE;

  const systemPrompt = buildSystemPrompt({
    tool: 'health',
    strictness,
    baseStyle,
  });

  let userPrompt = `Napiš ${type === 'blog' ? 'blog článek' : type === 'social' ? 'příspěvek na sociální sítě' : 'newsletter'} na téma: ${prompt}`;
  if (service) userPrompt += `\nKontext služby: ${service}`;
  userPrompt += buildOutputContract(type);

  return {
    strictness,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };
}

