# CLAUDE.md — Bicom Písek (audit kontext)

## Co to je
Produkční web ordinace biorezonance. Cloudflare-first: Pages (HTML5+Tailwind+Vanilla ES6 SPA), Workers (V8), Workers AI (llama-3-8b), D1 `bicom-pisek-db` (14 tabulek), R2 `bicom-multimedia`, KV, Queues (booking-jobs, social-jobs). Workeři: bicom-booking-consumer, bicom-social-consumer, bicom-cron-worker. Doména kanonická: bicom-pisek.cz (s pomlčkou).

## Zdroj pravdy
db/schema.sql (kanonické schéma) + db/seed/ + db/migrations/NNNN_*.sql. D1 má = repo.

## REŽIM PRÁCE (důležité)
- Probíhá AUDIT. Pracuj READ-ONLY: analyzuj a reportuj, NEMĚŇ kód/konfiguraci bez mého explicitního souhlasu v chatu.
- Žádné destruktivní příkazy, žádné reálné odeslání e-mailů/SMS/zpráv.
- Výstup každého modulu ukládej do docs/audit/reports/<MODUL>.md jako tabulku nálezů 🔴/🟡/🟢.

## Kontext auditu
Viz docs/audit/00_PLAYBOOK.md a 01_SNAPSHOT.md.