// Zdroj pravdy je Claude skill pravni-kontroling/rulebook.md;
// tento soubor je jeho runtime projekce. Při změně pravidel aktualizovat oba.

export const RULES_HEALTH = {
  forbidden: [
    'léčí', 'vyléčí', 'uzdraví', 'diagnostikuje',
    'zaručeně', '100%', 'nahradí lékaře',
    'rakovina', 'borelióza', 'cukrovka', 'deprese', // konkrétní nemoci
    'tachyony', 'přepisuje imunitu', // pseudověda
    'lepší než lékař', 'účinnější než medicína', // nadřazenost nad lékařem
    'vyléčení dětí', 'léčíme dětské nemoci' // dětské zdraví
  ],
  risky: [
    'pomáhá', 'podporuje', // bez kontextu
    'výsledek do', 'zlepšení za', // sliby výsledku v čase
    'absolutní detox', 'kompletní očista' // absolutní detox
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
