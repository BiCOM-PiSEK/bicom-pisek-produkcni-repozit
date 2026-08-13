/**
 * netlify/edge-functions/platform-guard.ts
 *
 * Bezpečnostní guard pro Netlify větev (Fáze 0–2).
 * Blokuje přístup na /admin/* a /api/* dokud není backend plně nasazen.
 *
 * Důvod existence:
 * - /admin/* : functions/admin/_middleware.js (CF auth) na Netlify neběží.
 *   Bez tohoto guardu by se public/admin/index.html servírovalo BEZ přihlášení.
 * - /api/*   : Netlify Functions neexistují dokud neproběhne Fáze 3A.
 *   Lepší 503 než výchozí Netlify 404 bez těla.
 *
 * Guard se odstraní / upraví:
 * - /api/*  → odstraní se po Fázi 3A (API handlery nasazeny)
 * - /admin/* → nahradí se admin-auth.ts po Fázi 3B (auth middleware nasazen)
 *
 * Runtime: Deno (Netlify Edge Functions)
 * Dokumentace: https://docs.netlify.com/edge-functions/overview/
 */

import type { Config, Context } from '@netlify/edge-functions';

export default async function handler(
  request: Request,
  context: Context
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Blokace /admin/* — ochrana před neautentizovaným přístupem
  // Admin konzole (public/admin/index.html) by bez guardu šla přečíst bez přihlášení
  if (path.startsWith('/admin')) {
    // Výjimka: Netlify deploy preview kontrolní endpointy (interní)
    if (path.startsWith('/admin/__netlify')) {
      return context.next();
    }

    return new Response(
      JSON.stringify({
        error: 'not_available',
        message: 'Admin konzole není na tomto prostředí dostupná.',
        note: 'Backend není na Netlify ještě nasazen. Přístup bude dostupný po Fázi 3B migrace.',
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'X-Guard': 'platform-guard-v1',
        },
      }
    );
  }

  // Blokace /api/* — backend ještě neexistuje
  if (path.startsWith('/api')) {
    return new Response(
      JSON.stringify({
        error: 'service_unavailable',
        message: 'API není na tomto prostředí dostupné.',
        note: 'Backend není na Netlify ještě nasazen. Přístup bude dostupný po Fázi 3A migrace.',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Retry-After': '3600',
          'X-Guard': 'platform-guard-v1',
        },
      }
    );
  }

  // Ostatní cesty — předat dál (statické soubory, SPA)
  return context.next();
}

// Tato edge funkce se aktivuje pro /admin/* a /api/* (konfigurace v netlify.toml)
// Změna paths se provádí v netlify.toml [[edge_functions]] sekci, ne zde.
export const config: Config = {
  // Path je konfigurován přes netlify.toml [[edge_functions]]
  // Necháváme prázdné — netlify.toml má přednost
};
