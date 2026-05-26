-- Seed: Real Bicom Písek services catalog
-- Source: Official service list from Lenka Limpouchová
-- Note: price_avg is approximate, individual pricing determined during booking flow.

INSERT OR REPLACE INTO services (slug, name, category, segment, short_desc, long_desc, price_avg, price_note, sessions_typ, sort_order) VALUES
(
    'imunita-a-obranyschopnost',
    'Imunita a obranyschopnost',
    'imunita',
    'vsichni',
    'Poruchy imunitního systému, oslabená imunita, autoimunitní onemocnění a alergie.',
    'Biorezonanční terapie pomáhá harmonizovat imunitní systém a podporuje přirozenou obranyschopnost organismu. Metoda je vhodná při opakovaných infekcích, alergiích, autoimunitních obtížích i jako prevence v období zvýšené zátěže.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení. Vaše individuální cena se může lišit a zjistíte ji během procesu objednávky.',
    '3–8 sezení',
    1
),
(
    'energie-a-vitalita',
    'Energie & Vitalita',
    'energie',
    'profesionalove',
    'Chronická únava, syndrom chronické únavy, fibromyalgie, celková revitalizace a obnova energie organismu.',
    'Cítíte vyčerpání, které neodbourá ani odpočinek? Biorezonanční terapie podporuje obnovu energetické rovnováhy organismu. Pomáhá při chronické únavě, fibromyalgii i celkovém pocitu vyhoření — jemně a bez vedlejších účinků.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení. Vaše individuální cena se může lišit a zjistíte ji během procesu objednávky.',
    '4–6 sezení',
    2
),
(
    'bolest-a-pohybovy-aparat',
    'Bolest a pohybový aparát',
    'bolest',
    'vsichni',
    'Bolesti svalů, kloubů a hlavy včetně migrén.',
    'Bolest je signál, že tělo potřebuje pomoc. Biorezonanční terapie podporuje přirozené regenerační procesy a pomáhá zmírnit bolesti svalů, kloubů i chronické migrény — jako komplementární doplněk ke klasické léčbě.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení. Vaše individuální cena se může lišit a zjistíte ji během procesu objednávky.',
    '3–6 sezení',
    3
),
(
    'psychika-a-emocni-rovnovaha',
    'Psychika a emoční rovnováha',
    'psychika',
    'zeny',
    'Úzkosti, deprese, psychická nevyrovnanost, podpora duševního klidu a emoční harmonie.',
    'Někdy stačí málo, aby se vnitřní svět dostal z rovnováhy. Biorezonanční terapie jemně podporuje emoční harmonii a pomáhá při úzkostech, napětí a psychické nevyrovnanosti — v klidném a bezpečném prostředí.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení. Vaše individuální cena se může lišit a zjistíte ji během procesu objednávky.',
    '5–10 sezení',
    4
),
(
    'hormonalni-system',
    'Hormonální systém',
    'hormony',
    'zeny',
    'Hormonální nerovnováha, menopauza, andropauza, návaly horka, studené končetiny.',
    'Hormonální změny provázejí ženy i muže v různých životních fázích. Biorezonanční terapie podporuje harmonizaci hormonálního systému a pomáhá zmírnit projevy menopauzy, andropauzy i dalších hormonálních obtíží.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení. Vaše individuální cena se může lišit a zjistíte ji během procesu objednávky.',
    '4–8 sezení',
    5
),
(
    'metabolismus',
    'Metabolismus',
    'metabolismus',
    'vsichni',
    'Poruchy metabolismu — cukrovka, vysoký cholesterol, nadváha.',
    'Metabolismus je základem fungování celého organismu. Biorezonanční terapie podporuje správné metabolické procesy a může pomáhat jako doplněk při řešení nadváhy, vysokého cholesterolu i metabolických poruch.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení. Vaše individuální cena se může lišit a zjistíte ji během procesu objednávky.',
    '5–10 sezení',
    6
),
(
    'organy-a-detoxikace',
    'Orgány a detoxikace',
    'organy',
    'vsichni',
    'Zatížení vnitřních orgánů (játra, ledviny, slinivka, žaludek, plíce, srdce, lymfa), detoxikace organismu.',
    'Moderní životní styl zatěžuje vnitřní orgány toxiny z potravy, prostředí i stresu. Biorezonanční terapie podporuje přirozenou detoxikaci a harmonizaci orgánových systémů — jemně a neinvazivně.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení. Vaše individuální cena se může lišit a zjistíte ji během procesu objednávky.',
    '3–6 sezení',
    7
),
(
    'patogeny',
    'Patogeny',
    'patogeny',
    'vsichni',
    'Odstranění zatížení viry, bakteriemi (borelie, chlamydie, mykoplasmata), kvasinkami, plísněmi a parazity.',
    'Skrytá zatížení patogeny mohou být příčinou chronických obtíží. Biorezonanční terapie pomáhá identifikovat a harmonizovat zatížení viry, bakteriemi, kvasinkami i parazity — bez antibiotik a chemických preparátů.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení. Vaše individuální cena se může lišit a zjistíte ji během procesu objednávky.',
    '4–8 sezení',
    8
),
(
    'prostredi-a-zateze',
    'Prostředí a zátěže',
    'prostredi',
    'biohackeri',
    'Eliminace geopatogenních zón a elektrosmogu, ochrana před vlivem Wi-Fi, 5G, rentgenu.',
    'Žijeme v prostředí plném elektromagnetického záření a geopatogenních zátěží. Biorezonanční terapie pomáhá eliminovat jejich vliv na organismus a podporuje přirozenou odolnost těla vůči moderním technologickým vlivům.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení. Vaše individuální cena se může lišit a zjistíte ji během procesu objednávky.',
    '2–4 sezení',
    9
),
(
    'podpora-pri-onkologii',
    'Podpora při onkologické léčbě',
    'onkologie',
    'vsichni',
    'Detoxikace a harmonizace u onkologických pacientů, zmírnění zátěže pro lepší snášenlivost chemoterapie a radioterapie.',
    'Biorezonanční terapie slouží jako komplementární doplněk klasické onkologické léčby. Pomáhá s detoxikací organismu a zmírněním vedlejších účinků chemoterapie a radioterapie — vždy po konzultaci s ošetřujícím lékařem.',
    1500,
    'Uvedená cena je průměrná cena za jedno sezení. Vaše individuální cena se může lišit a zjistíte ji během procesu objednávky.',
    '6–12 sezení',
    10
),
(
    'prevence-a-rekonvalescence',
    'Prevence a rekonvalescence',
    'prevence',
    'vsichni',
    'Posílení organismu a prevence nemocí, rychlejší zotavení po nemoci či náročných léčebných procedurách.',
    'Nejlepší léčba je ta, která není potřeba. Biorezonanční terapie podporuje přirozené obranné mechanismy organismu a urychluje rekonvalescenci po nemoci, operaci nebo náročné léčbě.',
    1000,
    'Uvedená cena je průměrná cena za jedno sezení. Vaše individuální cena se může lišit a zjistíte ji během procesu objednávky.',
    '2–4 sezení',
    11
);
