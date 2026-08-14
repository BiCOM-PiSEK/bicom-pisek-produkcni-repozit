// netlify/functions/admin-invoices.js
// Správa a vystavování faktur (iDoklad) pro administraci.

import { authenticateOperator } from '../lib/admin-auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { IDokladConnector } from '../lib/connectors/idoklad.js';
import { recordAuditLog } from '../lib/db-supabase.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true',
};

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const operator = await authenticateOperator(request);
  if (!operator) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Neautorizovaný přístup.' }),
      { status: 401, headers: CORS_HEADERS }
    );
  }

  const supabase = getSupabaseAdmin();
  const idoklad = new IDokladConnector(process.env);

  // ─── GET: Seznam faktur z procesních stavů nebo Supabase ───────
  if (request.method === 'GET') {
    try {
      const { data: invoices, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('table_name', 'invoices')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(
        JSON.stringify({
          ok: true,
          configured: idoklad.configured,
          invoices: invoices || [],
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při načítání faktur.', details: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  // ─── POST: Vystavení faktury ───────────────────────────────────
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { booking_id, amount, description, client_name } = body;

      if (!booking_id || !amount) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Chybí ID rezervace nebo částka.' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }

      let result = { simulated: true, invoice_id: `INV-${Date.now()}` };

      if (idoklad.configured) {
        result = await idoklad.createInvoice({
          bookingId: booking_id,
          clientName: client_name || 'Klient Bicom',
          serviceName: description || 'Biorezonanční sezení',
          priceCzk: Number(amount),
        });
      }

      await recordAuditLog(
        supabase,
        'invoices',
        booking_id,
        'create',
        `operator:${operator.id}`,
        `Vystavena faktura na částku ${amount} Kč pro ${client_name || 'klienta'}`
      );

      return new Response(
        JSON.stringify({
          ok: true,
          message: 'Faktura byla úspěšně vytvořena.',
          invoice: result,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Chyba při vystavování faktury.', details: err.message }),
        { status: 500, headers: CORS_HEADERS }
      );
    }
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: CORS_HEADERS,
  });
}

export const config = {
  path: '/admin/invoices',
};
