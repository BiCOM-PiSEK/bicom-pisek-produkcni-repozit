import { buildSystemPrompt, normalizeStrictness } from '../../guardrail/index.js';

const CHATBOT_BASE_STYLE = `Jsi AI rádce kliniky Bicom Písek. Tvoje role je pomáhat návštěvníkům webu s otázkami o biorezonanční terapii.

PRAVIDLA:
1. Odpovídej VŽDY česky, empaticky a srozumitelně.
2. VŽDY používej: podporuje, pomáhá, komplementární, doplněk klasické medicíny, mnozí klienti uvádějí.
3. Doporučuj konkrétní služby z katalogu Bicom Písek s orientačními cenami.
4. Pokud si nejsi jistý/á odpovědí, řekni "Na tuto otázku Vám rádi odpovíme e-mailem nebo telefonicky" a eskaluj.
5. Biorezonanční terapie je DOPLŇKOVÁ metoda, nikdy nenahrazuje lékařskou péči.
6. U dětí vždy zmiň nutnost souhlasu rodiče.`;

/**
 * Builds system+user messages for chatbot replies.
 * @param {Object} params
 * @param {string} params.message
 * @param {string} params.servicesContext
 * @param {string} params.faqContext
 * @param {Record<string,string>} params.runtimeConfig
 * @returns {{messages:{role:string,content:string}[], strictness:string}}
 */
export function buildChatbotMessages({
  message,
  servicesContext,
  faqContext,
  runtimeConfig,
}) {
  const strictness = normalizeStrictness(runtimeConfig.ai_legal_guardrail);
  const maxSentences = parseInt(runtimeConfig.ai_studio_chat_max_sentences || '4', 10);
  const promptProfile = runtimeConfig.ai_studio_prompt_profile || 'default';
  const promptsEnabled = runtimeConfig.ai_studio_prompts_enabled !== '0';

  let baseStyle = CHATBOT_BASE_STYLE;
  baseStyle += `\n7. Buď stručný/á — max ${Number.isFinite(maxSentences) ? maxSentences : 4} věty na odpověď, pokud se uživatel neptá na detail.`;
  if (promptsEnabled) {
    baseStyle += `\n8. Aktivní profil asistenta: ${promptProfile}.`;
  }

  let systemPrompt = buildSystemPrompt({
    tool: 'health',
    strictness,
    baseStyle,
  });

  if (servicesContext) {
    systemPrompt += `\n\nKATALOG SLUŽEB:\n${servicesContext}`;
  }
  if (faqContext) {
    systemPrompt += `\n\nČASTO KLADENÉ OTÁZKY:\n${faqContext}`;
  }

  return {
    strictness,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message.trim() },
    ],
  };
}

