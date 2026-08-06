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
    .replace(/aria-label="GitSkins gs-([a-z]+)-[^"]*section"/g, (_m, name) => `aria-label="${name} section"`)
    // The small pulsing dot GitSkins parks on the decorative rings.
    .replace(/[ \t]*<g transform="rotate\([^"]*\)">\s*<circle [^>]*r="4"[^>]*>\s*<animateTransform[\s\S]*?<\/g>\r?\n?/g, '');
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

/**
 * Re-spaces the four stat boxes so they sit a uniform 18px from the outer frame
 * (GitSkins renders them only 6px from the left/right edges) with even 16px gaps.
 * Box x: 34/238/442/646 -> 46/242/438/634; inner content keeps its 22px inset.
 */
function alignStatBoxes(svg) {
  const boxes = { 34: 46, 238: 242, 442: 438, 646: 634 };
  for (const [from, to] of Object.entries(boxes)) {
    svg = svg
      .replace(new RegExp(`x="${from}" y="92"`, 'g'), `x="${to}" y="92"`)
      .replace(new RegExp(`x="${Number(from) + 22}"`, 'g'), `x="${Number(to) + 22}"`);
  }
  return svg;
}

/** Drops the "> stack.scan" terminal flourish and its blinking cursor. */
function trimStack(svg) {
  return svg
    .replace(/[ \t]*<text[^>]*>&gt; stack\.scan<\/text>\r?\n?/, '')
    .replace(/[ \t]*<text class="aura-cursor" x="786"[^>]*>_<\/text>\r?\n?/, '');
}

/**
 * Soften every card / panel corner, then clip the whole group to that rounded
 * rect so glow orbs cannot paint sharp square corners outside the bg curve.
 */
function roundCorners(svg) {
  svg = svg
    .replace(/width="860" height="(\d+)" rx="20"/g, 'width="860" height="$1" rx="32"')
    .replace(/width="860" height="(\d+)" rx="32"/g, 'width="860" height="$1" rx="32"')
    .replace(/width="859" height="(\d+)" rx="19\.5"/g, 'width="859" height="$1" rx="31.5"')
    .replace(/width="859" height="(\d+)" rx="31\.5"/g, 'width="859" height="$1" rx="31.5"')
    .replace(/(width="804" height="\d+" )rx="20"/g, '$1rx="28"')
    .replace(/(width="808" height="\d+" )rx="20"/g, '$1rx="28"')
    .replace(/(width="808" height="\d+" )rx="22"/g, '$1rx="28"')
    .replace(/(width="180" height="122" )rx="18"/g, '$1rx="24"');

  const height = svg.match(/width="860" height="(\d+)"/)?.[1];
  const prefix = svg.match(/<g id="(gs-[^"]+)"/)?.[1];
  if (!height || !prefix || svg.includes(`${prefix}-round`)) return svg;

  return svg
    .replace(
      '</defs>',
      `  <clipPath id="${prefix}-round"><rect width="860" height="${height}" rx="32" ry="32"/></clipPath>\n  </defs>`,
    )
    .replace(`<g id="${prefix}">`, `<g id="${prefix}" clip-path="url(#${prefix}-round)">`);
}

const CUSTOMIZE = {
  hero: (svg) => roundCorners(trimHero(svg)),
  stats: (svg) => roundCorners(alignStatBoxes(shrinkStats(svg))),
  stack: (svg) => roundCorners(trimStack(svg)),
  heatmap: roundCorners,
};

/**
 * Motion layer — one choreographed entrance per card, then stillness.
 *
 * Rules: single axis (rise), 60–120ms sibling stagger, expo-out settles,
 * spring overshoot only on small focal elements (numbers, dots). No infinite
 * loops except the hero's slow dashed orbit; ambient life comes from the
 * background orbs GitSkins already ships. Only transform / opacity /
 * stroke-dashoffset are animated, so the palette never changes.
 *
 * The `.aura-*` compound rules restate the card's own animation names because a
 * bare `animation:` shorthand on an equally specific selector would cancel them.
 */
function motionStyles(prefix) {
  return `
    @media (prefers-reduced-motion: no-preference) {
      #${prefix} .nx-in { animation: nx-in 700ms cubic-bezier(0.16,1,0.3,1) both; }
      #${prefix} .nx-in-2 { animation-delay: 120ms; }
      #${prefix} .nx-fade { animation: nx-fade 500ms ease-out both; }
      #${prefix} .nx-avatar { animation: nx-scale-in 650ms cubic-bezier(0.16,1,0.3,1) 60ms both; transform-box: fill-box; transform-origin: center; }
      #${prefix} .nx-ring-draw { stroke-dasharray: 302; animation: nx-scale-in 650ms cubic-bezier(0.16,1,0.3,1) 60ms both, nx-draw 950ms cubic-bezier(0.16,1,0.3,1) 200ms both; transform-box: fill-box; transform-origin: center; }
      #${prefix} .nx-handle { animation: nx-handle 900ms cubic-bezier(0.16,1,0.3,1) 250ms both; }
      #${prefix} .nx-shine { stroke-dasharray: 260; animation: nx-draw 1s cubic-bezier(0.16,1,0.3,1) 550ms both; }
      #${prefix} .nx-num { animation: nx-pop 700ms cubic-bezier(0.34,1.56,0.64,1) both; transform-box: fill-box; transform-origin: center bottom; }
      #${prefix} .nx-dot { animation: nx-pop 550ms cubic-bezier(0.34,1.56,0.64,1) both; transform-box: fill-box; transform-origin: center; }
      #${prefix} .aura-ring.nx-spin { animation: ${prefix}-ring 8s ease-in-out infinite, nx-spin 60s linear infinite; transform-box: fill-box; transform-origin: center; }
      #${prefix} .aura-ring-b.nx-spin-rev { animation: ${prefix}-ring 10s ease-in-out infinite 1.6s, nx-spin-rev 45s linear infinite; transform-box: fill-box; transform-origin: center; }
      #${prefix} g.aura-chip { animation: nx-card 800ms cubic-bezier(0.22,1,0.36,1) both; }
      #${prefix} .aura-bar { animation: nx-bar 1s cubic-bezier(0.16,1,0.3,1) both; }
      @keyframes nx-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes nx-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes nx-scale-in { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
      @keyframes nx-draw { to { stroke-dashoffset: 0; } }
      @keyframes nx-handle { from { opacity: 0; letter-spacing: 8px; } to { opacity: 1; letter-spacing: 2.6px; } }
      @keyframes nx-pop { 0% { opacity: 0; transform: scale(0.5); } 65% { opacity: 1; transform: scale(1.12); } 100% { opacity: 1; transform: scale(1); } }
      @keyframes nx-spin { to { transform: rotate(360deg); } }
      @keyframes nx-spin-rev { to { transform: rotate(-360deg); } }
      @keyframes nx-card { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      @keyframes nx-bar { 0% { transform: scaleX(0); } 75% { transform: scaleX(1.03); } 100% { transform: scaleX(1); } }
    }
`;
}

/** Injects an inline animation-delay so nested elements inherit their row's stagger. */
function staggered(svg, pattern, insert, base, step) {
  let index = 0;
  return svg.replace(pattern, (...match) => insert(match, `style="animation-delay:${base + index++ * step}ms"`));
}

const ANIMATE = {
  hero: (svg, prefix) => svg
    // Name reveals through a left-to-right wipe, timed with the arc drawing above it.
    .replace('</defs>', `  <clipPath id="${prefix}-namewipe"><rect x="166" y="64" width="0" height="66"><animate attributeName="width" values="0;520" keyTimes="0;1" calcMode="spline" keySplines="0.16 1 0.3 1" begin="0.35s" dur="0.9s" fill="freeze"/></rect></clipPath>\n  </defs>`)
    .replace('<text x="166" y="116"', `<text clip-path="url(#${prefix}-namewipe)" x="166" y="116"`)
    .replace(' x="51" y="43" width="90"', ' class="nx-avatar" x="51" y="43" width="90"')
    .replace('<circle cx="96" cy="88" r="48"', '<circle class="nx-ring-draw" stroke-dashoffset="302" cx="96" cy="88" r="48"')
    .replace('<text x="166" y="63"', '<text class="nx-handle" x="166" y="63"')
    .replace('<path d="M166 70 C246 44 330 44 410 71"', '<path class="nx-shine" stroke-dashoffset="260" d="M166 70 C246 44 330 44 410 71"')
    .replace('<circle class="aura-ring" cx="735" cy="88" r="86"', '<circle class="aura-ring nx-spin" stroke-dasharray="7 11" cx="735" cy="88" r="86"')
    .replace('<circle class="aura-ring-b" cx="735" cy="88"', '<circle class="aura-ring-b nx-spin-rev" stroke-dasharray="1 9" cx="735" cy="88"')
    .replace('<text x="735" y="82"', '<text class="nx-num" style="animation-delay:800ms" x="735" y="82"')
    .replace('<text x="735" y="104"', '<text class="nx-fade" style="animation-delay:950ms" x="735" y="104"'),

  stats: (svg) => {
    svg = svg
      .replace('<text x="46" y="61"', '<text class="nx-in" x="46" y="61"')
      .replace('<text x="48" y="84"', '<text class="nx-in nx-in-2" x="48" y="84"');
    svg = staggered(svg, /<text x="(\d+)" y="162"/g, ([, x], style) => `<text class="nx-num" ${style} x="${x}" y="162"`, 350, 100);
    svg = staggered(svg, /class="aura-bar"/g, (_m, style) => `class="aura-bar" ${style}`, 500, 100);
    return svg;
  },

  stack: (svg) => {
    svg = svg
      .replace('<text x="46" y="61"', '<text class="nx-in" x="46" y="61"')
      .replace('<text x="48" y="84"', '<text class="nx-in nx-in-2" x="48" y="84"');
    svg = staggered(svg, /<circle cx="54" cy="(\d+)" r="5"/g, ([, cy], style) => `<circle class="nx-dot" ${style} cx="54" cy="${cy}" r="5"`, 250, 95);
    svg = staggered(svg, /<text x="306" y="(\d+)"/g, ([, y], style) => `<text class="nx-fade" ${style} x="306" y="${y}"`, 650, 95);
    svg = staggered(svg, /class="aura-bar"/g, (_m, style) => `class="aura-bar" ${style}`, 400, 95);
    return svg;
  },
};

function addMotion(svg, section) {
  const enhance = ANIMATE[section];
  if (!enhance) return svg;

  const prefix = svg.match(/<g id="(gs-[^"]+)"/)?.[1];
  if (!prefix) throw new Error('could not find the card id needed to scope the motion styles');

  return enhance(svg, prefix).replace('  </style>', `${motionStyles(prefix)}  </style>`);
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
