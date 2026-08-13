# netlify/lib/

Sdílená business logika pro Netlify serverless funkce.

## Vztah k `functions/lib/`

`functions/lib/` (Cloudflare linie) **se nesdílí přímo** — import přes hranice adresářů
v Netlify bundleru způsobuje problémy. Místo toho `netlify/lib/` obsahuje:

1. **Adaptéry** — nové verze módulů s Netlify-kompatibilními API
2. **Kopie** — platformně-nezávislé moduly kopírované z `functions/lib/`

## Plán (Fáze 1B a 2)

- `db-postgres.js` — DB adaptér (Neon PostgreSQL místo D1)
- `db-pool.js` — Connection pool management
- `cache.js` — KV adaptér (Netlify Blobs místo Cloudflare KV)
- `media.js` — R2 adaptér (Netlify Blobs místo Cloudflare R2)
- Ostatní moduly z `functions/lib/` — sdíleny nebo kopírovány dle potřeby
