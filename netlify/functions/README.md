# netlify/functions/

Netlify Serverless Functions (Node.js runtime) pro Bicom Písek.

Tento adresář bude naplněn v průběhu migrace:
- **Fáze 3A**: 30 veřejných API handlerů (kopie z `functions/api/` s Netlify API)
- **Fáze 3B**: 24 admin handlerů (kopie z `functions/admin/` s Netlify API + bezpečnostní opravy)
- **Fáze 5**: 7 scheduled funkcí + background funkce pro async zpracování

## Konvence

- Soubory `.mts` pro TypeScript (Edge Functions)
- Soubory `.js` pro CommonJS/ESM serverless funkce
- Každý handler exportuje `export const config = { path: '/api/...' }`
