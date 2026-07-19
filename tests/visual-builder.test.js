import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const repoRoot = process.cwd();
const cmsClientScript = readFileSync(join(repoRoot, 'public', 'assets', 'js', 'cms-client.js'), 'utf8');

function collectBlocks(relativePath) {
  const html = readFileSync(join(repoRoot, relativePath), 'utf8');
  const dom = new JSDOM(html, {
    url: `https://bicom-pisek.cz/${relativePath.replace(/^public[\\/]/, '')}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  dom.window.fetch = async () => ({ ok: false, json: async () => ({}) });
  dom.window.console = { ...console, warn() {} };
  dom.window.eval(cmsClientScript);
  return dom.window.CMS.visualBuilder.collectBlocks();
}

describe('Visual Builder block manifest', () => {
  it('maps the homepage as a full page outline, not only legacy CMS fields', () => {
    const blocks = collectBlocks(join('public', 'index.html'));
    const types = new Set(blocks.map((block) => block.type));

    expect(blocks.length).toBeGreaterThanOrEqual(90);
    expect(Array.from(types)).toEqual(expect.arrayContaining(['structure', 'component', 'action', 'section', 'media', 'dynamic']));
    expect(blocks.some((block) => block.label === 'Rezervační formulář' && block.status === 'locked')).toBe(true);
    expect(blocks.some((block) => block.mediaKind === 'video' && block.actions.includes('replaceMedia'))).toBe(true);
  });

  it('keeps landing pages above the old incomplete 36-block ceiling', () => {
    const pages = ['pisek', 'strakonice', 'vodnany', 'milevsko', 'protivin'];

    for (const city of pages) {
      const blocks = collectBlocks(join('public', `biorezonance-${city}.html`));
      const types = new Set(blocks.map((block) => block.type));

      expect(blocks.length).toBeGreaterThan(36);
      expect(Array.from(types)).toEqual(expect.arrayContaining(['structure', 'component', 'action', 'landingField']));
      expect(blocks.some((block) => block.type === 'landing' && block.sectionKey === `landing-${city}`)).toBe(true);
    }
  });

  it('generates stable block ids across repeated manifest builds', () => {
    const first = collectBlocks(join('public', 'index.html')).map((block) => block.id);
    const second = collectBlocks(join('public', 'index.html')).map((block) => block.id);

    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(first.length);
  });
});
