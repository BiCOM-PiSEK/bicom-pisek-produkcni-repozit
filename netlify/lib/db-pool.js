import { neon } from '@neondatabase/serverless';

// Singleton pro databázový connection (pooling zajišťuje Neon HTTP driver a Cloudflare edge)
let sqlInstance = null;

/**
 * Inicializuje nebo vrátí existující připojení do PostgreSQL.
 * Očekává NETLIFY_DATABASE_URL v environment proměnných.
 *
 * @returns {import('@neondatabase/serverless').NeonQueryFunction<any, any>} SQL tagged template function
 */
export function getDb() {
  if (!sqlInstance) {
    const connectionString = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('[db-pool] Chybí připojovací řetězec do databáze (NETLIFY_DATABASE_URL nebo DATABASE_URL).');
    }
    
    // Používáme connection pooling HTTP endpoint neonu
    sqlInstance = neon(connectionString);
  }
  
  return sqlInstance;
}
