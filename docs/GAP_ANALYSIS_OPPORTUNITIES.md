# Bicom Písek — Gap analýza a přehlédnuté příležitosti

> Stav k 2026-06-01. Vychází z reálné kontroly Cloudflare (D1/R2/KV/Workers) a repa `bicom-pisek-produkcni-repozit`.
> Priorita: 🔴 kritické · 🟠 důležité · 🟢 příležitost (nice-to-have).

## A. Vývoj / infrastruktura

| # | Mezera / příležitost | Prio | Dopad | Doporučení |
|---|---|---|---|---|
| A1 | **D1 schéma nebylo nasazené** (0 tabulek) | 🔴 | Web/admin neměl kam ukládat data | ✅ **VYŘEŠENO dnes** — kanonické `db/schema.sql` (14 tabulek) + 11 služeb + 6 článků nasazeno naživo. Přidej `npm run db:init:prod` do CI. |
| A2 | **Bez automatické zálohy D1** | 🔴 | Ztráta dat = nevratná | Denní `wrangler d1 export` → R2 `bicom-multimedia/backups/` přes `bicom-cron-worker`. |
| A3 | **GDPR anonymizační cron neověřen** | 🔴 | Riziko porušení čl. 9 GDPR (retence) | Implementovat a otestovat anonymizaci po 30 dnech (SQL je v DB management doc), logovat do `audit_log`. |
| A4 | **Migrace bez verzování stavu** | 🟠 | Drift mezi repo a produkcí | Tabulka/řádek `schema_version`, každá migrace `migrations/NNNN_*.sql` + zápis do `audit_log`. |
| A5 | **Šifrovací klíč — rotace a fallback** | 🟠 | Kompromitace klíče = vše čitelné | Plán rotace klíče v CF Secrets, verze klíče v poli (`enc_key_id`). |
| A6 | **Rate limiting / WAF u API endpointů** | 🟠 | Spam rezervací, scraping | Potvrdit pravidla na `/api/book`, `/api/newsletter` (100 req/min/IP dle architektury). |
| A7 | **Monitoring/alerting** | 🟠 | Tichý výpadek Workerů/cronů | Sentry (zmíněn v architektuře) + healthcheck cronu; alert při chybě fronty. |
| A8 | **Sdílení limitů s kódovacím agentem** | 🟠 | Nečekané vyčerpání tarifu | Nastavit rozpočet/oddělit účty Workers AI; logovat spotřebu (viz tvoje priorita kontroly limitů). |
| A9 | **Idempotence front (booking/social consumer)** | 🟢 | Dvojité rezervace při retry | Dedup klíč (idempotency key) na vstupu fronty. |

## B. Produkt / obsah / SEO-GEO

| # | Mezera / příležitost | Prio | Dopad | Doporučení |
|---|---|---|---|---|
| B1 | **Lokální landing stránky chybí** | 🔴 | Ztráta transakčních dotazů „biorezonance {město}" | Vytvořit 5 stránek (Písek, Strakonice, Vodňany, Milevsko, Protivín) — keyword mapa je hotová. |
| B2 | **Žádný `FAQPage` JSON-LD** | 🟠 | Ztráta featured snippets + AI citací | Doplnit FAQ blok do každého pilíře i `blog_posts.jsonld`. |
| B3 | **Chybí E-E-A-T autor (`Person`)** | 🟠 | Slabý signál důvěry pro zdravotní obsah (YMYL) | Profil terapeuta s kvalifikací, `author` v JSON-LD. |
| B4 | **`Service`/`Offer` JSON-LD na webu** | 🟠 | Ceny už jsou v DB (`services`, 11 položek), ale chybí jejich vystavení jako strukturovaná data | Generovat `Service`+`Offer` JSON-LD z tabulky `services` (pole `jsonld` zatím prázdné). |
| B5 | **Magazín = jen 6 článků** | 🟢 | Tenká topická autorita | Plán 1–2 článků/měsíc; využít admin AI copywriter (hlas→článek). |
| B6 | **Newsletter bez sekvence** | 🟢 | Leady „vychladnou" | Welcome sekvence (3–5 e-mailů) přes Resend; možno řídit z `newsletter_subscribers`. |
| B7 | **Recenze / sociální důkaz** | 🟠 | Konverze i lokální SEO | `Review`/`AggregateRating` (právně bezpečně), sběr přes Google Business. |
| B8 | **Seznam.cz / Firmy.cz** | 🟠 | CZ trh = Seznam stále silný | Založit a sladit NAP; nezůstávat jen u Google. |
| B9 | **Instagram→blog sync nevyužitý** | 🟢 | Bezúdržbový obsah leží ladem | Aktivovat tok C z architektury (`source='instagram'`). |

## C. Byznys / strategie (MEVERIK kontext)

| # | Příležitost | Prio | Poznámka |
|---|---|---|---|
| C1 | **Šablonizace „light BIM&CDE" přístupu na health-web** | 🟢 | Bicom je čistý referenční „předatelný" produkt — zabalit jako opakovatelnou MEVERIK SOLUTION šablonu pro další klienty (lékaři, wellness). |
| C2 | **Reálná data místo dema** | 🟠 | Smazat `DEMO_ENC::%` řádky před ostrým provozem (SQL v DB management doc). |
| C3 | **Handover checklist vs. realita** | 🟠 | Ověřit, že `docs/HANDOVER.md` sedí na aktuální CF účet/secrets před předáním klientce. |
| C4 | **Měření AI viditelnosti** | 🟢 | Pravidelný (měsíční) manuální audit citací v Perplexity / AI Overviews — žádný nástroj to dnes nesleduje. |

## D. Doporučené pořadí kroků (next 2 sprinty)

1. 🔴 A2 záloha D1 + A3 GDPR anonymizace (právní + datové riziko).
2. 🔴 B1 lokální landing stránky (největší růst trafiku, mapa je hotová).
3. 🟠 B2+B3 FAQ + autor JSON-LD (rychlá výhra pro AEO/GEO).
4. 🟠 B4 cenník + B8 Seznam/Firmy.cz (konverze + lokální SEO).
5. 🟢 B5/B6/B9 obsahový a newsletter motor (dlouhodobá autorita).

## E. Token/limit poznámka (tvoje priorita)
Tento balík (živé nasazení DB + 3 dokumenty) byl jeden středně náročný odběr. Pro další kroky doporučuju **dávkovat po jednom bodu** z pořadí výše — každý je samostatný, menší úkol, takže udržíš kontrolu nad spotřebou tarifu. Nejnáročnější budou položky generující hodně obsahu (B1 landing stránky, B5 články); ty si raději rozděl na jednotlivé stránky.
