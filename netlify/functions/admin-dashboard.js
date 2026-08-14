// netlify/functions/admin-dashboard.js
// Statistiky a souhrnné metriky pro Virtual Office dashboard.

import { authenticateOperator } from '../lib/admin-auth.js';
import { getSupabaseAdmin } from '../lib/supabase.js';
import { DataCrypt } from '../lib/datacrypt.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

  try {
    const supabase = getSupabaseAdmin();
    const encryptionKey = process.env.SECRET_ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const crypt = new DataCrypt(encryptionKey);

    const [
      pendingRes,
      confirmedRes,
      subscribersRes,
      servicesRes,
      recentBookingsRes,
      geoLeadsRes,
    ] = await Promise.all([
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
      supabase.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('services').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('bookings').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('geo_leads').select('city').not('city', 'is', null).limit(100),
    ]);

    // Dešifrování posledních rezervací
    const recentBookings = await Promise.all(
      (recentBookingsRes.data || []).map(async (b) => {
        try {
          const [name, email, phone] = await Promise.all([
            crypt.decrypt(b.name_enc),
            crypt.decrypt(b.email_enc),
            crypt.decrypt(b.phone_enc),
          ]);
          return {
            id: b.id,
            name,
            email,
            phone,
            service: b.service,
            preferred_date: b.preferred_date,
            status: b.status,
            created_at: b.created_at,
          };
        } catch {
          return {
            id: b.id,
            name: 'Šifrované jméno',
            email: '***',
            phone: '***',
            service: b.service,
            preferred_date: b.preferred_date,
            status: b.status,
            created_at: b.created_at,
          };
        }
      })
    );

    // Agregace měst
    const cityCounts = {};
    (geoLeadsRes.data || []).forEach((lead) => {
      if (lead.city) {
        cityCounts[lead.city] = (cityCounts[lead.city] || 0) + 1;
      }
    });

    const topCities = Object.entries(cityCounts)
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return new Response(
      JSON.stringify({
        ok: true,
        stats: {
          pending_bookings: pendingRes.count || 0,
          confirmed_bookings: confirmedRes.count || 0,
          active_subscribers: subscribersRes.count || 0,
          active_services: servicesRes.count || 0,
        },
        recent_bookings: recentBookings,
        top_cities: topCities,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    console.error('[admin-dashboard] Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: 'Chyba při načítání dashboardu.', details: err.message }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export const config = {
  path: '/admin/dashboard',
};
