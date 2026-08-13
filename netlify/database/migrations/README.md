# netlify/database/migrations/

Postgres migrace pro Netlify větev projektu Bicom Písek.

## Struktura

- `0000_initial_schema.sql` — Celé schéma převedené z `db/schema.sql` (SQLite/D1 → PostgreSQL)

## Postup aplikace (Fáze 1A)

```bash
# Po provisioning Netlify DB:
psql $NETLIFY_DATABASE_URL -f netlify/database/migrations/0000_initial_schema.sql
# nebo:
npm run netlify:db:apply
```

## Vztah k Cloudflare migraci

- `db/migrations/` (0001–0029) jsou **Cloudflare D1 migrace** — historické, slouží jen pro CF linii
- `netlify/database/migrations/` obsahuje **jedinou iniciální migraci** pro čistý PostgreSQL start
- Tyto dvě linie jsou oddělené a nesdílí historii migrací
