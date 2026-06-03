# ADR-001: Produkční výseč zůstává čistě na Cloudflare

**Status:** Přijato
**Datum:** 2026-06-03
**Rozhoduje:** Matěj (MEVERIK STUDIO / WHC)
**Kontext vzniku:** Sprint S1 (oživování produkce), při opravě /admin redirectu (C-24)

## Kontext

Bicom Písek je vědomě postavený jako „produkční výseč" — levná, edge-first,
předatelná klientce. Komplexní vývoj (Vue/Nuxt, FastAPI, AI orchestrace) zůstává
v MEVERIK dev repu. Během oživování produkce vznikla otázka, zda u citlivých
částí (zejména admin autentizace) zatáhnout do produkční výseče i další služby
z MEVERIK stacku — Google Cloud Run, Firebase Auth apod. — nebo zůstat čistě
na Cloudflare.

Spouštěčem byla oprava /admin redirectu. Důležité zjištění: ten problém je
ROUTOVACÍ (Cloudflare Pages uvnitř Functions ignoruje _redirects), NE problém
auth providera. Žádná externí služba by ho neopravila.

## Rozhodnutí

Celá produkční výseč zůstává na čistém Cloudflare (Pages + Workers + D1 + R2 + KV
+ Queues + Workers AI). Admin autentizace zůstává na Cloudflare Access. Nepřidáváme
Firebase Auth, Cloud Run ani jiný externí backend.

## Zvážené varianty

### A — Čistý Cloudflare (zvoleno)
Nízká složitost, ~zero-cost, auth blokovaná na hraně sítě (CF Access ověří dřív,
než se spustí jakýkoli kód), vše předatelné v jednom CF dashboardu.
Mínus: Workers mají CPU limity — ale ty se projeví jen u těžkého compute, který
tento web nemá.

### B — Firebase Auth pro admin
Vyšší složitost (SDK, správa tokenů, kód k údržbě), druhý vendor, a paradoxně
NIŽŠÍ bezpečnost — request dorazí až do workeru, teprve pak se ověřuje (ztráta
edge blokace). Pro ordinaci s jedním–dvěma operátory masivní overkill. Zamítnuto.

### C — Cloud Run (externí compute) vedle CF
Relevantní jen pro těžký/dlouhý compute (>30s CPU: generování IFC/PENB, LiDAR
pipeline). Bicom nic takového nemá — patří jiným MEVERIK produktům. Pro tento web
zbytečné. Zamítnuto.

## Trade-off

Jádro: u jedno-admin ordinace je CF Access BEZPEČNĚJŠÍ než vlastní Firebase Auth,
protože ověření proběhne na hraně dřív než kód. Přidat Firebase by auth oslabilo
a přidalo závislost. Cloud Run řeší problém, který tu neexistuje. Obě externí
varianty platíš složitostí a horší předatelností za schopnost, kterou nepotřebuješ.

## Důsledky

- Snazší: jeden vendor, jeden účet, hladké předání klientce, žádná auth logika k údržbě.
- Bonus: tento projekt je důkazem, že vzor „Cloudflare-first zero-cost produkční výseč"
  funguje — stává se opakovatelnou šablonou pro další malé klienty (obce do 10k obyvatel).
- K revizi zůstává: JWKS ověření podpisu JWT (hardening, plánováno na S2) — i to
  zůstává čistě v CF (stažení CF JWKS endpointu, ověření ve workeru, žádná externí služba).

## Kdy v budoucnu sáhnout mimo Cloudflare (rozhodovací mapa)

- Workers AI dojde / je drahé → nejdřív CF AI Gateway, pak Groq/Gemini fallback
  (už zapojeno); Cloud Run + NVIDIA NIM až u těžké inference.
- D1 narazí na limity → Neon Postgres (zdokumentovaný fallback).
- Potřeba dlouhého compute (IFC/PENB/LiDAR) → Cloud Run (ale to je jiný MEVERIK produkt).
- Bicom by zavedl KLIENTSKÉ účty (pacient se přihlašuje ke svým záznamům) → teprve
  tehdy znovu otevřít otázku auth.

Dokument může být v budoucnu nahrazen (Superseded), pokud se některý ze spouštěčů
výše naplní.
