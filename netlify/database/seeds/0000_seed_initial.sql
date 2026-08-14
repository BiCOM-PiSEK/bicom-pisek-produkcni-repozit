-- Seed data for PostgreSQL (Supabase / Netlify)
-- Services catalog (11 programs), default operator, hero content

INSERT INTO services (slug, name, category, segment, short_desc, long_desc, price_avg, price_note, sessions_typ, sort_order, is_active) VALUES
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
    1,
    true
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
    2,
    true
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
    3,
    true
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
    4,
    true
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
    5,
    true
),
(
    'odvykani-koureni',
    'Odvykání kouření (Antinikotinový program)',
    'odvykani',
    'vsichni',
    'Pomoc při odvykání kouření, eliminace chuti na nikotin a zmírnění abstinenčních příznaků.',
    'Speciální antinikotinový program Bicom pomáhá potlačit fyzickou závislost na nikotinu a výrazně zmírňuje abstinenční příznaky. Často stačí jediné cílené sezení.',
    1500,
    'Jednorázový intenzivní program.',
    '1–2 sezení',
    6,
    true
),
(
    'detoxikace-a-regenerace',
    'Detoxikace a regenerace organismu',
    'detoxikace',
    'vsichni',
    'Zatížení těžkými kovy, toxiny, elektrosmogem, podpora lymfatického systému a regenerace po nemoci.',
    'Denně jsme vystaveni stovkám toxinů a stresorů. Biorezonanční detoxikační program podporuje činnost vylučovacích orgánů (játra, ledviny, lymfa) a urychluje regeneraci těla.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení.',
    '3–5 sezení',
    7,
    true
),
(
    'travici-trakt-a-mikrobiom',
    'Trávicí trakt a mikrobiom',
    'traveni',
    'vsichni',
    'Trávicí potíže, potravinové intolerance, nadýmání, syndrom dráždivého tračníku.',
    'Zdraví začíná ve střevech. Program zaměřený na harmonizaci trávicího traktu a mikrobiomu pomáhá při intolerancích, pálení žáhy a pocitech těžkosti po jídle.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení.',
    '4–8 sezení',
    8,
    true
),
(
    'kozne-problemy',
    'Kožní problémy a ekzémy',
    'kuze',
    'zeny',
    'Atopické ekzémy, akné, lupénka, alergické kožní reakce.',
    'Kůže je zrcadlem vnitřního stavu organismu. Biorezonance hledá a harmonizuje hlubší příčiny kožních obtíží — zatížení toxiny, intolerance i stres.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení.',
    '4–8 sezení',
    9,
    true
),
(
    'prevence-a-udrzba-zdravi',
    'Prevence a dlouhověkost (Longevity)',
    'prevence',
    'profesionalove',
    'Preventivní harmonizace, posílení buněčné energie, podpora vitality a dlouhodobého zdraví.',
    'Pravidelná preventivní péče o energetickou rovnováhu buněk. Pomáhá předcházet vyčerpání a udržuje tělo v optimální kondici.',
    1200,
    'Uvedená cena je průměrná cena za jedno sezení.',
    'pravidelně 1x měsíčně',
    10,
    true
),
(
    'individualni-biorezonancni-pece',
    'Individuální biorezonanční péče',
    'individualni',
    'vsichni',
    'Komplexní diagnostika a terapie na míru dle vašich specifických potřeb a obtíží.',
    'Vstupní konzultace a sestavení individuálního terapeutického plánu přesně podle potřeb vašeho organismu přístrojem Bicom Optima.',
    1500,
    'Cena zahrnuje úvodní diagnostiku a první harmonizační program.',
    'dle plánu',
    11,
    true
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    segment = EXCLUDED.segment,
    short_desc = EXCLUDED.short_desc,
    long_desc = EXCLUDED.long_desc,
    price_avg = EXCLUDED.price_avg,
    price_note = EXCLUDED.price_note,
    sessions_typ = EXCLUDED.sessions_typ,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

-- Initial Operator
INSERT INTO operators (id, email, name, role, is_active) VALUES
('op_admin_box', 'admin@bicom-pisek.cz', 'Admin Bicom Písek', 'admin', true)
ON CONFLICT (id) DO NOTHING;

-- Initial Hero Content
INSERT INTO hero_content (id, headline, subline, cta_primary_text, cta_primary_url, cta_secondary_text, cta_secondary_url, is_active) VALUES
('hero_default', 'Objevte rovnováhu a vitalitu svého těla', 'Prémiová biorezonanční péče Bicom Optima v klidném prostředí Písku. Certifikovaná metoda celostní harmonizace organismu.', 'Rezervovat termín', '#rezervace', 'Naše služby', '#sluzby', true)
ON CONFLICT (id) DO NOTHING;
