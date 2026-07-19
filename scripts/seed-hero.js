// scripts/seed-hero.js
// Seeds the hero_config table in the Cloudflare D1 database (bicom-pisek-db) using Wrangler.
// This activates the CMS editor for the homepage hero section.
//
// Usage:
//   node scripts/seed-hero.js

import { execFileSync } from 'child_process';
import path from 'path';

const DB_NAME = 'bicom-pisek-db';
const WRANGLER_JS = path.resolve('node_modules/wrangler/bin/wrangler.js');

function runQuery(sql) {
  try {
    const args = [WRANGLER_JS, 'd1', 'execute', DB_NAME, '--remote', '--json', `--command=${sql}`];
    const output = execFileSync('node', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
    const jsonStart = output.indexOf('[');
    if (jsonStart === -1) {
      const match = output.match(/\{.*\}/s);
      return match ? JSON.parse(match[0]) : null;
    }
    return JSON.parse(output.substring(jsonStart));
  } catch (err) {
    console.error(`[error] Query failed: "${sql}"`);
    console.error(err.message);
    return null;
  }
}

async function seedHero() {
  console.log('========================================================');
  console.log('       BICOM PÍSEK — SEEDING HERO CONFIG                ');
  console.log('========================================================\n');

  const homepageHero = {
    id: 'hero-home-' + Math.random().toString(36).substring(2, 10),
    page_key: 'home',
    headline: 'Ulevte svému tělu bez chemie',
    subheadline: 'Biorezonanční metoda Bicom Optima v Písku. Citlivě, neinvazivně a s respektem k vašemu jedinečnému příběhu.',
    cta_text: 'Objednat se online',
    cta_link: '#rezervace',
    background_image_url: '/assets/img/hero-lifestyle.webp',
    overlay_color: 'rgba(0,0,0,0.3)',
  };

  console.log(`Checking if hero config for page "${homepageHero.page_key}" already exists...`);
  const checkSql = `SELECT id FROM hero_config WHERE page_key = '${homepageHero.page_key}' LIMIT 1;`;
  const checkRes = runQuery(checkSql);

  const exists = checkRes?.[0]?.results?.length > 0 || checkRes?.length > 0;

  if (exists) {
    console.log(`✓ Hero config for page "${homepageHero.page_key}" already exists. Skipping seed.`);
    process.exit(0);
  }

  console.log(`Seeding homepage hero configuration...`);
  const insertSql = `
    INSERT INTO hero_config (id, page_key, headline, subheadline, cta_text, cta_link, background_image_url, overlay_color)
    VALUES (
      '${homepageHero.id}',
      '${homepageHero.page_key}',
      '${homepageHero.headline.replace(/'/g, "''")}',
      '${homepageHero.subheadline.replace(/'/g, "''")}',
      '${homepageHero.cta_text.replace(/'/g, "''")}',
      '${homepageHero.cta_link.replace(/'/g, "''")}',
      '${homepageHero.background_image_url.replace(/'/g, "''")}',
      '${homepageHero.overlay_color}'
    );
  `;

  const res = runQuery(insertSql);
  if (res) {
    console.log('✅ Homepage hero configuration successfully seeded in D1 database.');
  } else {
    console.error('❌ Failed to seed hero configuration.');
  }
}

seedHero();
