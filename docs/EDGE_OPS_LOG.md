# 🛰️ EDGE OPS LOG — provozní deník zásahů mimo Git (Cloudflare edge)

> **Účel:** Evidovat KAŽDÝ živý zásah na Cloudflare (D1, KV, R2, Workers, deploy),
> který NENÍ zachycen v git historii kódu. Aby šel každý krok dohledat a vrátit.
>
> **Pravidla spolupráce (potvrzeno 2026-06-15):**
> - Agent na produkci **NIC nemaže** a **nepřepisuje bez konzultace**.
> - Povolené je **read-only** čtení/diagnostika; zápisy/DDL/mazání jen po výslovném pokynu pro daný běh.
> - Ke každému zásahu: datum · kdo · co · proti které resource · SQL/akce · vratnost · výsledek.
> - Deploy (`wrangler`) a CF Zero Trust / DNS dělá majitel účtu (kontejner agenta není k wrangleru přihlášen).
>
> Formát záznamu níže (nejnovější nahoře).

---

## 2026-06-15 · Claude Code · READ-ONLY inspekce geo_leads (příprava GEO úklidu)

- **Resource:** D1 `bicom-pisek-db` (uuid `c04cb289-2ff4-45d7-9fa0-3243c34c3abe`)
- **Akce (read-only, žádný zápis):**
  - `SELECT COUNT(*), demo_like, with_city FROM geo_leads` → **total=2, demo_like=0, with_city=2**
  - `SELECT id,psc,city,service,source,created_at FROM geo_leads` →
    - `680bfc3a…` PSČ 39701 · Písek · metabolismus · web · 2026-06-15 00:48
    - `387ac501…` PSČ 39701 · Písek · bolest-a-pohybovy-aparat · web · 2026-06-14 18:50
- **Závěr:** Žádná seedovaná demo data (`gl_demo%` = 0). Dva reálné testovací leady z testování rezervací.
- **Vratnost:** N/A (jen čtení, `rows_written=0`).
- **Doporučení (ČEKÁ na pokyn majitele):** Před ostrým spuštěním smazat 2 testovací leady.
  Navržený příkaz (NEPROVEDENO agentem):
  `DELETE FROM geo_leads WHERE id IN ('680bfc3a-fa56-4ac8-911b-adcf84a162c5','387ac501-8afa-4387-8867-382b105781e2');`
  (nebo přes `npm run db:clean-demo` po označení testovacích dat prefixem).

---

## 2026-06-15 · Claude Code · READ-ONLY ověření přístupu

- **Akce:** `d1_databases_list` → účet obsahuje `bicom-pisek-db`, `cralis-db`, `Cloudflare-D1-DATABAZE-GitHubREPO`.
- **Wrangler:** v kontejneru NEpřihlášen (`wrangler whoami` → not authenticated) → deploy provádí majitel účtu.
- **Závěr:** Agent má přes konektor read-only dosah na D1 (a inspekci Workers/KV/R2). Zápisy jen po konzultaci.
