import { RULES_HEALTH } from './rules-health.js';

// Registr rulebooků pro různé nástroje/domény.
// Pro přidání nových stačí naimportovat a zaregistrovat zde:
// e.g. brand: RULES_BRAND, finance: RULES_FINANCE
const RULEBOOKS = {
  health: RULES_HEALTH,
};

/**
 * Normalizuje hodnotu přísnosti na jednu ze 4 podporovaných hodnot.
 * @param {string} value 
 * @returns {string} 'off' | 'mild' | 'optimal' | 'strict'
 */
export function normalizeStrictness(value) {
  const allowed = ['off', 'mild', 'optimal', 'strict'];
  return allowed.includes(value) ? value : 'optimal';
}

/**
 * Sestaví systémový prompt na základě vybraného nástroje, úrovně přísnosti a základního stylu.
 * @param {Object} params
 * @param {string} params.tool - Název nástroje/rulebooku ('health', ...)
 * @param {string} params.strictness - Úroveň přísnosti ('off', 'mild', 'optimal', 'strict')
 * @param {string} params.baseStyle - Základní tón, délka a styl promptu
 * @returns {string} Výsledný systémový prompt
 */
export function buildSystemPrompt({ tool, strictness = 'optimal', baseStyle = '' }) {
  const normStrictness = normalizeStrictness(strictness);

  if (normStrictness === 'off') {
    return baseStyle;
  }

  const rulebook = RULEBOOKS[tool];
  if (!rulebook) {
    console.warn(`[guardrail] Rulebook for tool '${tool}' not found. Returning baseStyle.`);
    return baseStyle;
  }

  let prompt = `${baseStyle}\n\n=== PRÁVNÍ OCHRANNÉ BARIÉRY (GUARDRAIL: ${normStrictness.toUpperCase()}) ===\n`;

  if (normStrictness === 'mild') {
    prompt += `PRÁVNÍ FILTR (přísně dodržuj):
- NIKDY nepoužívej tato zakázaná slova/tvrzení: ${rulebook.forbidden.join(', ')}
- Snaž se do textu zahrnout informaci, že biorezonance nenahrazuje lékařskou péči.`;
  } 
  
  else if (normStrictness === 'optimal') {
    prompt += `PRÁVNÍ FILTR (přísně dodržuj):
- NIKDY nepoužívej tato zakázaná slova/tvrzení (červená zóna): ${rulebook.forbidden.join(', ')}
- Vyhni se následujícím rizikovým formulacím (oranžová zóna), zejména nepoužívej obecné sliby bez kontextu nebo časové záruky: ${rulebook.risky.join(', ')}
- Používej bezpečná synonyma a opisy:
${Object.entries(rulebook.safe_alternatives).map(([bad, good]) => `  * místo "${bad}" napiš "${good}"`).join('\n')}
- Zajisti, aby z textu PŘIROZENĚ a vkusně vyplynulo, že biorezonance je doplňková metoda nenahrazující lékařskou péči — ideálně jednou decentní větou vhodně zakomponovanou do textu. NEZAHLCUJ text právními formulacemi, nedělej seznam doložek, nesnižuj ani nekaz tím obsah. U krátkých formátů (social) drž toto sdělení na naprostém minimu (klidně vynech, pokud by kazilo krátký post).`;
  } 
  
  else if (normStrictness === 'strict') {
    prompt += `PRÁVNÍ FILTR (ABSOLUTNÍ PŘÍSNOST - DODRŽUJ BEZ VÝJIMKY):
- NIKDY nepoužívej tato zakázaná slova/tvrzení (červená zóna): ${rulebook.forbidden.join(', ')}
- Zcela se vyhni jakýmkoli rizikovým nebo slibujícím formulacím (oranžová zóna): ${rulebook.risky.join(', ')}
- Přísně používej bezpečná synonyma a opisy:
${Object.entries(rulebook.safe_alternatives).map(([bad, good]) => `  * místo "${bad}" napiš "${good}"`).join('\n')}
- Pokud je nějaké téma nebo tvrzení na hraně nebo rizikové, RADĚJI JEJ ZCELA VYNECH, než abys riskoval/a porušení právních předpisů. Bezpečnost a legálnost má absolutní přednost před marketingovou atraktivitou.
- Zajisti, aby z textu PŘIROZENĚ a vkusně vyplynulo, že biorezonance je doplňková metoda nenahrazující lékařskou péči — ideálně jednou decentní větou vhodně zakomponovanou do textu. NEZAHLCUJ text právními formulacemi, nedělej seznam doložek, nesnižuj ani nekaz tím obsah. U krátkých formátů (social) drž toto sdělení na naprostém minimu (klidně vynech, pokud by kazilo krátký post).`;
  }

  // Upozornění na budoucí napojení detekčního enginu (detect.js)
  // TODO: Detekční engine v detect.js bude ověřovat výstupy proti RULES_HEALTH na backendu.

  return prompt;
}
