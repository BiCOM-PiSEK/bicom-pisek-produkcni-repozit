// scripts/generate-service-jsonld.js
// Dynamically generates structured Schema.org (Service + Offer) JSON-LD for each program
// in the services database table and uploads it to D1.

import { execSync } from 'child_process';

const DB_NAME = 'bicom-pisek-db';
const BASE_URL = 'https://bicom-pisek.cz';

function runQuery(sql) {
  try {
    const output = execSync(
      `npx wrangler d1 execute ${DB_NAME} --remote --json --command="${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    const jsonStart = output.indexOf('[');
    if (jsonStart === -1) {
      return JSON.parse(output.substring(output.indexOf('{')));
    }
    return JSON.parse(output.substring(jsonStart));
  } catch (err) {
    console.error(`[error] Query failed: "${sql}"`);
    console.error(err.message);
    return null;
  }
}

async function generateJsonLd() {
  console.log('Generating rich JSON-LD schemas for active services...');

  // 1. Fetch all services
  const queryRes = runQuery('SELECT slug, name, short_desc, price_avg, price_note FROM services WHERE active = 1;');
  const services = queryRes[0]?.results || queryRes || [];

  if (!services.length) {
    console.error('❌ No active services found in database. Seed D1 services first.');
    process.exit(1);
  }

  console.log(`Found ${services.length} active services. Building JSON-LD schemas...\n`);

  for (const s of services) {
    const { slug, name, short_desc, price_avg, price_note } = s;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': `${BASE_URL}/sluzby/${slug}#service`,
      'name': name,
      'description': short_desc,
      'provider': {
        '@type': ['HealthAndBeautyBusiness', 'LocalBusiness'],
        '@id': `${BASE_URL}/#business`,
        'name': 'Bicom Písek',
        'legalName': 'BIO ONE LIFE s.r.o.',
        'taxID': '23950978',
        'address': {
          '@type': 'PostalAddress',
          'streetAddress': 'Vladislavova 201 (Technologický park)',
          'addressLocality': 'Písek',
          'postalCode': '39701',
          'addressCountry': 'CZ'
        }
      },
      'areaServed': [
        { '@type': 'AdministrativeArea', 'name': 'Písecko' },
        { '@type': 'AdministrativeArea', 'name': 'Strakonicko' },
        { '@type': 'City', 'name': 'Písek' },
        { '@type': 'City', 'name': 'Strakonice' }
      ],
      'offers': {
        '@type': 'Offer',
        'priceCurrency': 'CZK',
        'price': price_avg,
        'priceMode': 'https://schema.org/AveragePrice',
        'description': price_note
      }
    };

    const schemaStr = JSON.stringify(schema);
    
    // Update D1 services table
    console.log(`Updating JSON-LD for: ${slug}`);
    const updateSql = `UPDATE services SET jsonld = '${schemaStr.replace(/'/g, "''")}' WHERE slug = '${slug}';`;
    runQuery(updateSql);
  }

  console.log('\n✅ All service JSON-LD schemas successfully generated and updated in D1 database.');
}

generateJsonLd();
