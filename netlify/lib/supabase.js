import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

let supabaseAdminInstance = null;
let supabaseAnonInstance = null;

/**
 * Získá URL adresu Supabase projektu z environment proměnných.
 * @returns {string}
 */
export function getSupabaseUrl() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://jzzabznikpiqxrkkdfbf.supabase.co';
  return url;
}

/**
 * Získá Supabase klienta s administrátorskými právy (service_role klíč).
 * Používá se v Netlify Serverless a Background funkcích pro bezpečný přístup k datům bez RLS omezení.
 * 
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseAdmin() {
  if (!supabaseAdminInstance) {
    const url = getSupabaseUrl();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                           process.env.SUPABASE_SECRET_KEY ||
                           process.env.SUPABASE_SERVICE_KEY || 
                           process.env.SUPABASE_KEY ||
                           process.env.SUPABASE_ANON_KEY;

    if (!serviceRoleKey) {
      throw new Error('[supabase] Chybí SUPABASE_SERVICE_ROLE_KEY (nebo SUPABASE_SECRET_KEY) v environment proměnných.');
    }

    supabaseAdminInstance = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: (...args) => fetch(...args),
        WebSocket: WebSocket
      }
    });
  }

  return supabaseAdminInstance;
}

/**
 * Získá Supabase klienta s veřejnými právy (anon klíč).
 * Vhodné pro veřejné dotazy nebo operace respektující RLS politiky.
 * 
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function getSupabaseClient() {
  if (!supabaseAnonInstance) {
    const url = getSupabaseUrl();
    const anonKey = process.env.SUPABASE_ANON_KEY || 
                    process.env.SUPABASE_PUBLISHABLE_KEY ||
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                    process.env.SUPABASE_KEY;

    if (!anonKey) {
      throw new Error('[supabase] Chybí SUPABASE_ANON_KEY v environment proměnných.');
    }

    supabaseAnonInstance = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
      global: {
        fetch: (...args) => fetch(...args),
        WebSocket: WebSocket
      }
    });
  }

  return supabaseAnonInstance;
}
