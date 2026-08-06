/**
 * Re-downloads the GitSkins section cards and reapplies the local customizations,
 * so the numbers stay in sync with the live GitHub profile.
 *
 * Hand-written / locally customized — never overwritten here:
 * - assets/about.svg, assets/about-light.svg
 * - assets/social.svg, assets/social-light.svg
 */

import { writeFile, mkdir } from 'node:fs/promises';

const USERNAME = 'neelavradutta';
const THEME = 'github-dark';
const SECTIONS = ['hero', 'stack', 'heatmap', 'stats'];
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

/**
 * Motion layer. Every rule below animates transform, opacity or stroke-dashoffset only,
 * so the palette GitSkins renders stays untouched.
 *
 * The `.aura-*` rules restate the card's own entrance animation because a bare
 * `animation:` shorthand on an equally specific selector would cancel it.
 */
function motionStyles(prefix) {
  return `
    @media (prefers-reduced-motion: no-preference) {
      #${prefix} .nx-rise { animation: nx-rise 1s cubic-bezier(0.16,1,0.3,1) both; }
      #${prefix} .nx-rise-late { animation-delay: 160ms; }
      #${prefix} .nx-pop { animation: nx-pop 900ms cubic-bezier(0.34,1.56,0.64,1) both 320ms; transform-box: fill-box; transform-origin: center bottom; }
      #${prefix} .nx-halo { animation: nx-halo 4.5s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
      #${prefix} .nx-orbit { animation: nx-orbit 32s linear infinite; transform-box: view-box; transform-origin: 735px 88px; }
      #${prefix} .nx-sweep { animation: nx-sweep 4.2s cubic-bezier(0.45,0,0.55,1) infinite 900ms; }
      #${prefix} .aura-chip.nx-float { animation: ${prefix}-chip 650ms ease-out both, nx-float 7s ease-in-out infinite 1s; }
      #${prefix} .aura-bar.nx-glow { animation: ${prefix}-bar 1.15s ease-out both, nx-glow 3.4s ease-in-out infinite 1.3s; }
      @keyframes nx-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes nx-pop { 0% { opacity: 0; transform: scale(0.6); } 60% { opacity: 1; transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes nx-halo { 0%,100% { transform: scale(1); opacity: 0.92; } 50% { transform: scale(1.045); opacity: 0.62; } }
      @keyframes nx-orbit { to { transform: rotate(360deg); } }
      @keyframes nx-sweep { 0% { stroke-dashoffset: 340; } 55%,100% { stroke-dashoffset: -260; } }
      @keyframes nx-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3.5px); } }
      @keyframes nx-glow { 0%,100% { opacity: 0.95; } 50% { opacity: 0.62; } }
    }
`;
}

const FLOAT_CHIPS = (svg) => svg.replace(/<g class="aura-chip"/g, '<g class="aura-chip nx-float"');
const GLOW_BARS = (svg) => svg.replace(/class="aura-bar"/g, 'class="aura-bar nx-glow"');

const ANIMATE = {
  hero: (svg) => svg
    .replace('<circle cx="96" cy="88" r="48"', '<circle class="nx-halo" cx="96" cy="88" r="48"')
    .replace('<circle class="aura-ring" cx="735" cy="88" r="86"', '<circle class="aura-ring nx-orbit" stroke-dasharray="7 11" cx="735" cy="88" r="86"')
    .replace('<path d="M166 70 C246 44 330 44 410 71"', '<path class="nx-sweep" stroke-dasharray="80 260" d="M166 70 C246 44 330 44 410 71"')
    .replace('<text x="166" y="63"', '<text class="nx-rise" x="166" y="63"')
    .replace('<text x="166" y="116"', '<text class="nx-rise nx-rise-late" x="166" y="116"')
    .replace('<text x="735" y="82"', '<text class="nx-pop" x="735" y="82"'),

  stats: (svg) => GLOW_BARS(FLOAT_CHIPS(svg))
    .replace(/<text x="(\d+)" y="162"/g, '<text class="nx-pop" x="$1" y="162"'),

  stack: (svg) => GLOW_BARS(FLOAT_CHIPS(svg))
    .replace(/<circle cx="54" cy="(\d+)" r="5"/g, '<circle class="nx-halo" cx="54" cy="$1" r="5"'),
};

function addMotion(svg, section) {
  const enhance = ANIMATE[section];
  if (!enhance) return svg;

  const prefix = svg.match(/<g id="(gs-[^"]+)"/)?.[1];
  if (!prefix) throw new Error('could not find the card id needed to scope the motion styles');

  return enhance(svg).replace('  </style>', `${motionStyles(prefix)}  </style>`);
}

async function refresh(section, light) {
  const name = `${section}${light ? '-light' : ''}.svg`;
  let svg = removeBranding(await download(section, light));
  const customize = CUSTOMIZE[section];
  if (customize) svg = customize(svg);
  svg = addMotion(svg, section);

  if (/gitskins/i.test(svg)) throw new Error(`${name}: branding survived the cleanup`);
  if (section === 'hero' && /<g class="aura-chip"/.test(svg)) throw new Error(`${name}: language chips survived the cleanup`);
  if (ANIMATE[section] && !svg.includes('@keyframes nx-')) throw new Error(`${name}: motion layer was not applied`);

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
