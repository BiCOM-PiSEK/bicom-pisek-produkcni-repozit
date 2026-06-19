# ADR-005: Admin správa rezervací + obousměrná synchronizace konzole ↔ Google

**Status:** Accepted  
**Datum:** 2026-06-14  
**Deciders:** Matěj

## Kontext
F1–F6 mají funkční veřejnou stranu (klient → systém). Chybí provozní strana:
pracovnice nemají v konzoli nástroje na správu termínů a tlačítko "Potvrdit"
mění jen DB — klient se nic nedozví. Konzole a Google kalendář jsou dnes dva
oddělené světy: Google → DB funguje (webhook calendar-hook.js), DB → Google ne.

## Rozhodnutí
Dostavět admin správu rezervací a dosynchronizovat směr konzole → Google,
s ochranou proti zpětné smyčce přes tři vrstvy obrany.

## Klíčový vzor (bezpečná obousměrná synchronizace)
Vedlejší efekty (e-mail klientovi, SMS, zápis/změna Google události) se navazují
na REÁLNÝ PŘECHOD STAVU, ne na to, kdo změnu inicioval. Tři vrstvy:
1. Guard na přechodu — UPDATE ... WHERE status = '<očekávaný>'. No-op když se stav nemění.
2. Notifikace gated timestampem — e-mail jen když confirmation_sent_at IS NULL, pak se vyplní.
3. Echo suppression na webhooku — webhook porovná Google stav s DB; pokud sedí → echo → no-op.

## Datový model (migrace 0014 + 0015)
```sql
ALTER TABLE bookings ADD COLUMN assigned_to TEXT;
ALTER TABLE bookings ADD COLUMN confirmation_sent_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN cancellation_notified_at TIMESTAMP;
ALTER TABLE bookings ADD COLUMN no_show_flag INTEGER DEFAULT 0;
```

Migrace `0015_booking_no_show.sql` tak zvolila bezpečnou additivní variantu
bez rebuildu celé tabulky.

## Rozsah (fáze G2–G5)
- G2: "Potvrdit dělá vše" (e-mail gated + Google zelená + assigned_to) — jádro
- G3: přesun termínu (kontrola kolize + update Google)
- G4: zrušení (měkké, zaškrtátko informovat klienta) + smazání (tvrdé, vč. Google) + detail + no_show
- G5: kalendářový pohled v konzoli (nice-to-have)

## Řeší se samo / odpadlo
- Uvolnění slotu po zrušení: funguje (availability počítá jen aktivní stavy)
- Denní souhrn pracovnicím: řeší Google Workspace (ranní e-mail)
- E-mail pracovnici při nové poptávce: netřeba (Telegram + kalendář + konzole)

## Důsledky
- Snazší: pracovnice spravují vše z konzole, klient vždy informován
- Náročnější: sync logika, echo prevention, nutný ruční deploy workerů
- Revidovat: pokud přibude víc operátorek, assigned_to → kapacitní model
- Aktuálně je nutné dořešit BUG-001 v `audit_log.action`, protože část G3/G4
  akcí (`reschedule`, `cancel`) může končit HTTP 500

## Rizika
- Zpětná smyčka konzole→Google→webhook — ošetřeno 3 vrstvami
- Deploy: změny v consumeru/cronu vyžadují ruční wrangler deploy

## Původně odložené rozhodnutí — nyní uzavřeno

### no_show (stav "klient nedorazil")

**Datum:** 2026-06-14

**Původní problém:** Sloupec `bookings.status` má CHECK constraint (`pending/confirmed/done/cancelled/pending_payment`). SQLite/D1 neumí změnit CHECK přes ALTER — přidání `'no_show'` by vyžadovalo REBUILD celé tabulky bookings (16 tabulek, FK vazby, ostrá data) = nepoměrné riziko.

**Řešení příště:** Buď:

- **(a)** Přidat `'no_show'` do CHECK v rámci příští migrace, kdy se tabulka bookings stejně upravuje (table rebuild s opatrností).
- **(b)** Řešit "nedorazil" bez nového statusu — samostatným boolean polem (`no_show_flag`), přidaným přes ALTER ADD COLUMN.

Původní rozhodnutí: až při realizaci G4 nebo G5, v závislosti na náročnosti ostatních sloupců.

**REALIZOVÁNO (2026-06-15) — varianta (b):** Migrace `0015_booking_no_show.sql`
přidává `no_show_flag INTEGER DEFAULT 0` přes ALTER ADD COLUMN (bez rebuildu).
Sémantika: označení „klient nedorazil" převede potvrzenou rezervaci na
`status='done'` + `no_show_flag=1`. Klient se neinformuje, Google událost se
přebarví na šedou (`colorId '8'`). Audit zapsán jako `action='update'` (kvůli
CHECK na `audit_log.action`), sémantika v `details`. UI: tlačítko „Nedorazil"
u potvrzených rezervací, badge „Nedorazil" a filtr-tab „Nedorazili" v konzoli.
