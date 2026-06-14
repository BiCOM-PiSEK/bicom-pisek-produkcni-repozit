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

## Datový model (migrace 0014)
ALTER TABLE bookings ADD COLUMN: assigned_to TEXT (Jana/Tereza/NULL),
confirmation_sent_at TIMESTAMP, cancellation_notified_at TIMESTAMP. Stav no_show jen
aplikačně (žádný sloupec navíc). ALTER ADD COLUMN, nikdy remake.

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

## Rizika
- Zpětná smyčka konzole→Google→webhook — ošetřeno 3 vrstvami
- Deploy: změny v consumeru/cronu vyžadují ruční wrangler deploy
