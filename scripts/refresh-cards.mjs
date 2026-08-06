/**
 * Re-downloads the GitSkins section cards and reapplies the local customizations,
 * so the numbers stay in sync with the live GitHub profile.
 *
 * assets/about.svg and assets/about-light.svg are hand-written and never touched here.
 */

import { writeFile, mkdir } from 'node:fs/promises';

const USERNAME = 'neelavradutta';
const THEME = 'github-dark';
const SECTIONS = ['hero', 'stack', 'heatmap', 'stats', 'social'];
const OUT_DIR = 'assets';

const HERO_HEIGHT = 176;
const HERO_SHIFT = 6;

function url(section, light) {
  const base = `https://www.gitskins.com/api/section/${section}?username=${USERNAME}&theme=${THEME}`;
  return light ? `${base}&mode=light` : base;
}

async function download(section, light) {
  const response = await fetch(url(section, light));
  if (!response.ok) throw new Error(`${section}${light ? '-light' : ''}: HTTP ${response.status}`);
  const svg = await response.text();
  if (!svg.includes('<svg') || svg.includes('section unavailable')) {
    throw new Error(`${section}${light ? '-light' : ''}: response is not a valid card`);
  }
  return svg;
}

/** Applies to every card: drop the watermark, the branded subtitle, and the branded aria-label. */
function removeBranding(svg) {
  return svg
    .replace(/[ \t]*<text[^>]*>gitskins\.com<\/text>\r?\n?/gi, '')
    .replace(/Live GitHub stats styled by GitSkins/g, 'Live GitHub stats')
    .replace(/aria-label="GitSkins gs-([a-z]+)-[^"]*section"/g, (_m, name) => `aria-label="${name} section"`);
}

/** Drops the bio line and language chips, then closes the gap they leave behind. */
function trimHero(svg) {
  const scale = HERO_HEIGHT / 240;
  const shift = (value) => value - HERO_SHIFT;

  return svg
    .replace(/[ \t]*<text x="168" y="150"[^>]*>[^<]*<\/text>\r?\n?/, '')
    .replace(/<g class="aura-chip"[\s\S]*?<\/g>\n(?=\s*<path)/, '')
    .replace('width="860" height="240" viewBox="0 0 860 240"', `width="860" height="${HERO_HEIGHT}" viewBox="0 0 860 ${HERO_HEIGHT}"`)
    .replace(/<rect width="860" height="240"/, `<rect width="860" height="${HERO_HEIGHT}"`)
    .replace(/<rect x="0.5" y="0.5" width="859" height="239"/, `<rect x="0.5" y="0.5" width="859" height="${HERO_HEIGHT - 1}"`)
    .replace(/(<rect x="26" y="26" width="808" height=")188"/, `$1${HERO_HEIGHT - 52}"`)
    .replace(/<ellipse([^>]*?)cy="(\d+)"([^>]*?)ry="(\d+)"/g, (_m, a, cy, b, ry) =>
      `<ellipse${a}cy="${Math.round(cy * scale)}"${b}ry="${Math.round(ry * scale)}"`)
    .replace(/cx="735" cy="118"/g, 'cx="735" cy="88"')
    .replace(/rotate\(-32 735 118\)/, 'rotate(-32 735 88)')
    .replace(/cx="788.32" cy="118"/, 'cx="788.32" cy="88"')
    .replace(/(<text x="735" y=")112"/, '$182"')
    .replace(/(<text x="735" y=")134"/, '$1104"')
    .replace(/cx="96" cy="94"/g, `cx="96" cy="${shift(94)}"`)
    .replace(/x="51" y="49"/, `x="51" y="${shift(49)}"`)
    .replace(/(<text x="166" y=")69"/, `$1${shift(69)}"`)
    .replace(/(<text x="166" y=")122"/, `$1${shift(122)}"`)
    .replace('d="M166 76 C246 50 330 50 410 77"', 'd="M166 70 C246 44 330 44 410 71"');
}

/** Shrinks the label and figure inside each stat box. */
function shrinkStats(svg) {
  return svg
    .replace(/(<text x="\d+" y="126"[^>]*?)font-size="12"/g, '$1font-size="11"')
    .replace(/(<text x="\d+" y=")166("[^>]*?)font-size="35"/g, '$1162$2font-size="28"');
}

/** Drops the "> stack.scan" terminal flourish and its blinking cursor. */
function trimStack(svg) {
  return svg
    .replace(/[ \t]*<text[^>]*>&gt; stack\.scan<\/text>\r?\n?/, '')
    .replace(/[ \t]*<text class="aura-cursor" x="786"[^>]*>_<\/text>\r?\n?/, '');
}

const CUSTOMIZE = {
  hero: trimHero,
  stats: shrinkStats,
  stack: trimStack,
};

async function refresh(section, light) {
  const name = `${section}${light ? '-light' : ''}.svg`;
  let svg = removeBranding(await download(section, light));
  const customize = CUSTOMIZE[section];
  if (customize) svg = customize(svg);

  if (/gitskins/i.test(svg)) throw new Error(`${name}: branding survived the cleanup`);
  if (section === 'hero' && /<g class="aura-chip"/.test(svg)) throw new Error(`${name}: language chips survived the cleanup`);

  await writeFile(`${OUT_DIR}/${name}`, svg);
  console.log('updated', name);
}

await mkdir(OUT_DIR, { recursive: true });

const failures = [];
for (const section of SECTIONS) {
  for (const light of [false, true]) {
    try {
      await refresh(section, light);
    } catch (error) {
      failures.push(error.message);
      console.error('failed', error.message);
    }
  }
}

if (failures.length) process.exit(1);
