// netlify/functions/cron-backup.js
// Netlify Scheduled Function (spouští se denně ve 2:00 ráno: 0 2 * * *)
// Vytváří automatickou denní zálohu databáze do Netlify Blobs.

import { getSupabaseAdmin } from '../lib/supabase.js';
import { setBlob } from '../lib/blobs.js';
import { recordAuditLog } from '../lib/db-supabase.js';

export default async function handler() {
  const supabase = getSupabaseAdmin();
  const dateKey = new Date().toISOString().slice(0, 10);
  console.log(`[cron-backup] Spouštím zálohování databáze pro datum ${dateKey}...`);

  try {
    const [servicesRes, heroRes, rulesRes, exceptionsRes, blogRes, subscribersRes] = await Promise.all([
      supabase.from('services').select('*'),
      supabase.from('hero_content').select('*'),
      supabase.from('availability_rules').select('*'),
      supabase.from('availability_exceptions').select('*'),
      supabase.from('blog_posts').select('*'),
      supabase.from('newsletter_subscribers').select('id, email_hash, status, source, created_at'),
    ]);

    const backupPayload = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      date: dateKey,
      data: {
        services: servicesRes.data || [],
        hero_content: heroRes.data || [],
        availability_rules: rulesRes.data || [],
        availability_exceptions: exceptionsRes.data || [],
        blog_posts: blogRes.data || [],
        newsletter_subscribers: subscribersRes.data || [],
      },
    };

    // Uložíme do Netlify Blobs store 'bicom-backups'
    await setBlob(`backup_${dateKey}.json`, backupPayload, 'bicom-backups', {
      created_at: new Date().toISOString(),
    });

    await recordAuditLog(
      supabase,
      'database',
      dateKey,
      'export',
      'system:cron-backup',
      `Denní záloha backup_${dateKey}.json uložena do Netlify Blobs`
    );

    console.log(`[cron-backup] Záloha backup_${dateKey}.json úspěšně dokončena.`);
    return new Response(JSON.stringify({ status: 'success', date: dateKey }), { status: 200 });
  } catch (err) {
    console.error('[cron-backup] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export const config = {
  schedule: '0 2 * * *',
};
