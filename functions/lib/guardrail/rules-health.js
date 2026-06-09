// Zdroj pravdy je Claude skill pravni-kontroling/rulebook.md;
// tento soubor je jeho runtime projekce. Při změně pravidel aktualizovat oba.

export const RULES_HEALTH = {
  forbidden: [
    'léčí', 'vyléčí', 'uzdraví', 'diagnostikuje',
    'zaručeně', '100%', 'nahradí lékaře',
    'nahradí léky', 'bez léků', 'nemusíte k lékaři',
    'odstraní příčinu nemoci',
    'rakovina', 'borelióza', 'cukrovka', 'deprese', 'alergie', 'astma', 'ekzém', // konkrétní nemoci jmenované jako cíl léčby = 🔴; plný seznam přijde do detect.js
    'tachyony', 'přepisuje imunitu', // pseudověda
    'lepší než lékař', 'účinnější než medicína', // nadřazenost nad lékařem
    'vyléčení dětí', 'léčíme dětské nemoci' // dětské zdraví
  ],
  risky: [
    // Závažnost/váhy a kontextové vyhodnocení (skórovací model 9/1) řeší detekční engine detect.js v Kroku 2 — zde jen hrubý výběr pro prompt
    'výsledek do', 'zlepšení za', // sliby výsledku v čase
    'absolutní detox', 'kompletní očista', // absolutní detox
    'vyřeší váš problém', 'zbavíte se [nemoci]' // sliby a odstraňování nemocí
  ],
  safe_alternatives: {
    'léčí': 'podporuje',
    'vyléčí': 'napomáhá harmonizovat',
    'uzdraví': 'přispívá k rovnováze',
    'diagnostikuje': 'testuje energetickou rovnováhu',
    'zaručeně': 'podle zkušeností klientů',
    '100%': 'významně',
    'nahradí lékaře': 'doplňuje lékařskou péči',
    'detox': 'podpora přirozených čistících procesů',
    'léčba': 'komplementární harmonizace'
  },
  required_disclaimers: [
    'Biorezonanční metoda Bicom Optima je doplňková (komplementární) metoda. Nenahrazuje standardní lékařskou péči, diagnostiku ani klinickou léčbu.',
    'Provozovatel neposkytuje zdravotní služby ve smyslu zákona č. 372/2011 Sb., o zdravotních službách.',
    'Při jakýchkoli zdravotních potížích se vždy poraďte se svým lékařem.'
  ]
};
