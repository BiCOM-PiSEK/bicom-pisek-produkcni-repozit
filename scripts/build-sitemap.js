// scripts/build-sitemap.js
// Generates a static sitemap.xml for SEO and search engine indexing.

import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://bicom-pisek.cz';

const STATIC_ROUTES = [
  '/',
  '/gdpr',
  '/sluzby/imunita-a-obranyschopnost',
  '/sluzby/energie-a-vitalita',
  '/sluzby/bolest-a-pohybovy-aparat',
  '/sluzby/psychika-a-emocni-rovnovaha',
  '/sluzby/hormonalni-system',
  '/sluzby/metabolismus',
  '/sluzby/organy-a-detoxikace',
  '/sluzby/patogeny',
  '/sluzby/prostredi-a-zateze',
  '/sluzby/podpora-pri-onkologii',
  '/sluzby/prevence-a-rekonvalescence',
  '/biorezonance-pisek',
  '/biorezonance-strakonice',
  '/biorezonance-vodnany',
  '/biorezonance-milevsko',
  '/biorezonance-protivin'
];

function generateSitemap() {
  console.log('[sitemap] Starting sitemap.xml generation...');
  
  const today = new Date().toISOString().split('T')[0];
  
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  for (const route of STATIC_ROUTES) {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}${route}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${route === '/' ? 'daily' : 'monthly'}</changefreq>\n`;
    xml += `    <priority>${route === '/' ? '1.0' : '0.8'}</priority>\n`;
    xml += '  </url>\n';
  }
  
  xml += '</urlset>\n';
  
  const destPath = path.resolve('public/sitemap.xml');
  fs.writeFileSync(destPath, xml, 'utf8');
  console.log(`[sitemap] Successfully generated sitemap.xml at ${destPath}`);
}

generateSitemap();
