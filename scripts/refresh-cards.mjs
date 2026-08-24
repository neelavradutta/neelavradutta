/**
 * Re-downloads the GitSkins section cards and reapplies the local customizations,
 * so the numbers stay in sync with the live GitHub profile.
 *
 * Hand-written / locally customized — never overwritten here:
 * - assets/social.svg, assets/social-light.svg
 * About cards keep their design; only the bio lines are refreshed from GitHub.
 * Empty GitHub bio → About block removed from README (section hidden).
 * Connect chips are regenerated strictly from GitHub social_accounts (and blog if set).
 * No social links → Connect With Me removed from README (section hidden).
 */

import { writeFile, mkdir, readFile, unlink } from 'node:fs/promises';

/**
 * PROFILE_USERNAME (local override) → GITHUB_REPOSITORY owner (Actions).
 * Fail loud if neither set — no silent personal default.
 */
function resolveUsername() {
  const fromEnv = process.env.PROFILE_USERNAME?.trim();
  if (fromEnv) return fromEnv;
  const repo = process.env.GITHUB_REPOSITORY?.trim();
  if (repo?.includes('/')) {
    const owner = repo.split('/')[0];
    if (owner) return owner;
  }
  throw new Error(
    'username unset: set PROFILE_USERNAME or run in GitHub Actions (GITHUB_REPOSITORY)',
  );
}

const USERNAME = resolveUsername();
const THEME = 'github-dark';
const SECTIONS = ['hero', 'stack', 'heatmap', 'stats'];
const OUT_DIR = 'assets';
/** Max chars per bio line before forced wrap (≈ full inner card width at 20px). */
const ABOUT_LINE_CHARS = 72;
const MAX_CONNECT = 4;

const HERO_HEIGHT = 176;
const HERO_SHIFT = 6;

console.log('refreshing for', USERNAME);

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
    .replace(/Live GitHub stats styled by GitSkins/g, '')
    .replace(/[ \t]*<text[^>]*>Live GitHub stats<\/text>\r?\n?/gi, '')
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
    // Drop the right-side TOTAL STARS badge (rings + count + label + optional star icon).
    .replace(/[ \t]*<circle class="aura-ring[^"]*"[^>]*cx="735"[^/]*\/>\r?\n?/g, '')
    .replace(/[ \t]*<circle class="aura-ring-b[^"]*"[^>]*cx="735"[^/]*\/>\r?\n?/g, '')
    .replace(/[ \t]*<text[^>]*x="735"[^>]*>[^<]*<\/text>\r?\n?/g, '')
    .replace(/[ \t]*<g transform="rotate\([^"]*735[^"]*\)"[\s\S]*?<\/g>\r?\n?/g, '')
    .replace('width="860" height="240" viewBox="0 0 860 240"', `width="860" height="${HERO_HEIGHT}" viewBox="0 0 860 ${HERO_HEIGHT}"`)
    .replace(/<rect width="860" height="240"/, `<rect width="860" height="${HERO_HEIGHT}"`)
    .replace(/<rect x="0.5" y="0.5" width="859" height="239"/, `<rect x="0.5" y="0.5" width="859" height="${HERO_HEIGHT - 1}"`)
    .replace(/(<rect x="26" y="26" width="808" height=")188"/, `$1${HERO_HEIGHT - 52}"`)
    .replace(/<ellipse([^>]*?)cy="(\d+)"([^>]*?)ry="(\d+)"/g, (_m, a, cy, b, ry) =>
      `<ellipse${a}cy="${Math.round(cy * scale)}"${b}ry="${Math.round(ry * scale)}"`)
    .replace(/cx="96" cy="94"/g, `cx="96" cy="${shift(94)}"`)
    .replace(/x="51" y="49"/, `x="51" y="${shift(49)}"`)
    .replace(/(<text x="166" y=")69"/, `$1${shift(69)}"`)
    .replace(/(<text x="166" y=")122"/, `$1${shift(122)}"`)
    .replace('d="M166 76 C246 50 330 50 410 77"', 'd="M166 70 C246 44 330 44 410 71"');
}

/** Drop the name-curve shine and add ambient motion away from the text block. */
function stylizeHero(svg) {
  svg = trimHero(svg);
  const light = /github-dark-light/.test(svg);
  const accent = light ? '#0069e0' : '#58a6ff';
  const cyan = light ? '#0891b2' : '#2ad5ef';
  const violet = '#a371f7';

  svg = svg.replace(/[ \t]*<path class="nx-shine"[^>]*\/?>\r?\n?/g, '');
  svg = svg.replace(/[ \t]*<path[^>]*d="M166 70 C246 44 330 44 410 71"[^>]*\/?>\r?\n?/g, '');
  svg = svg.replace(/^\s*#[^\n]*\.nx-shine[^\n]*\r?\n/gm, '');
  svg = svg.replace(/<g class="nx-hero-ambient">[\s\S]*?<\/g>\r?\n?/g, '');

  const ambient = `
    <g class="nx-hero-ambient">
      <circle cx="714" cy="48" r="2.4" fill="${accent}" opacity="0.35">
        <animate attributeName="opacity" values="0.2;0.85;0.2" dur="3.4s" repeatCount="indefinite"/>
        <animate attributeName="cy" values="48;42;48" dur="5.8s" repeatCount="indefinite"/>
      </circle>
      <circle cx="762" cy="72" r="2" fill="${cyan}" opacity="0.3">
        <animate attributeName="opacity" values="0.15;0.7;0.15" dur="2.9s" begin="0.7s" repeatCount="indefinite"/>
        <animate attributeName="cx" values="762;770;762" dur="6.4s" repeatCount="indefinite"/>
      </circle>
      <circle cx="736" cy="104" r="1.8" fill="${violet}" opacity="0.28">
        <animate attributeName="opacity" values="0.12;0.6;0.12" dur="3.8s" begin="1.2s" repeatCount="indefinite"/>
        <animate attributeName="cy" values="104;98;104" dur="4.6s" repeatCount="indefinite"/>
      </circle>
      <circle cx="790" cy="56" r="1.5" fill="${accent}" opacity="0.22">
        <animate attributeName="opacity" values="0.1;0.55;0.1" dur="4.2s" begin="0.4s" repeatCount="indefinite"/>
        <animate attributeName="cx" values="790;782;790" dur="7s" repeatCount="indefinite"/>
      </circle>
      <rect x="46" y="167" width="90" height="2.5" rx="1.25" fill="${accent}" opacity="0.28">
        <animate attributeName="x" values="46;724;46" dur="9s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.12;0.42;0.12" dur="9s" repeatCount="indefinite"/>
      </rect>
    </g>`;

  if (svg.includes('<rect x="0.5" y="0.5"')) {
    svg = svg.replace(/<rect x="0.5" y="0.5"/, `${ambient}\n    <rect x="0.5" y="0.5"`);
  } else if (svg.includes('<rect x="26" y="26"')) {
    svg = svg.replace(/(<rect x="26" y="26")/, `${ambient}\n    $1`);
  }
  return svg;
}

/** Insert / replace the profile location line under the hero name. */
function injectHeroLocation(svg, location, light) {
  svg = svg.replace(/[ \t]*<text class="nx-location"[^>]*>[^<]*<\/text>\r?\n?/g, '');
  if (!location) return svg;
  const fill = light ? '#475569' : '#8b949e';
  const line =
    `    <text class="nx-location" x="166" y="140" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="13" font-weight="650" letter-spacing="0.4" fill="${fill}">${escapeXml(location)}</text>\n`;
  return svg.replace(
    /(<text[^>]*x="166" y="116"[^>]*>[^<]*<\/text>)\r?\n?/,
    `$1\n${line}`,
  );
}

/** Match section titles to Contribution Activity (24px / weight 850 / -0.4 tracking). */
function matchSectionTitle(svg) {
  return svg.replace(
    /(<text[^>]*>)(?:Language Stack|GitHub Stats|Profile Signal|Contribution Activity|Launch Log)(<\/text>)/g,
    (full, _open, _close) => full
      .replace(/font-size="\d+"/, 'font-size="24"')
      .replace(/letter-spacing="[^"]*"/, 'letter-spacing="-0.4"')
      .replace(/>Profile Signal</, '>GitHub Stats<'),
  );
}

/**
 * Contribution grid → rocket launch log.
 * GitHub README SVGs cannot run JS, so the "game" is a SMIL flyby:
 * a craft sweeps the year, each active day lifts as a rocket, then the map holds.
 */
function stylizeHeatmap(svg) {
  const prefix = svg.match(/<g id="(gs-[^"]+)"/)?.[1];
  if (!prefix) return svg;

  const light = /github-dark-light/.test(svg);
  const ink = light ? '#0f172a' : '#e6edf3';
  const accent = light ? '#1a85ff' : '#58a6ff';
  const canopy = light ? '#0069e0' : '#58a6ff';
  const flame = light ? '#ff6b35' : '#ffb020';
  const flameHot = light ? '#ffd60a' : '#fff6d0';
  const glass = light ? '#ffffff' : '#0d1117';

  svg = svg
    .replace(/aria-label="(?:heatmap section|Launch Log — contribution activity)"/, 'aria-label="Contribution Activity"')
    .replace(/>Launch Log</, '>Contribution Activity<')
    .replace(
      />(\d+) contributions in the last year</,
      '>Every commit a launch · $1 in the last year<',
    )
    .replace(/>Less</, '>Quiet<')
    .replace(/>More</, '>Ignition<');

  if (svg.includes(`id="${prefix}-rkt"`)) return svg;

  const defs = `
    <symbol id="${prefix}-rkt" overflow="visible">
      <path d="M-2.7 1.15L-4.4 4.6L-2.55 3.25Z"/>
      <path d="M2.7 1.15L4.4 4.6L2.55 3.25Z"/>
      <path d="M0-5.35C1.65-5.35 2.8-3.55 2.8-2.05V3.05c0 .88-.72 1.55-1.55 1.55h-2.5c-.83 0-1.55-.67-1.55-1.55V-2.05C-2.8-3.55-1.65-5.35 0-5.35Z"/>
      <circle cy="-1.15" r="0.82" fill="${glass}" fill-opacity="0.5"/>
    </symbol>
    <symbol id="${prefix}-flm" overflow="visible">
      <path d="M-1.25 4.45L0 8.05 1.25 4.45Z" fill="${flame}"/>
      <path d="M-0.62 4.45L0 6.55 .62 4.45Z" fill="${flameHot}"/>
    </symbol>
`;

  svg = svg.replace('</defs>', `${defs}  </defs>`);

  const legendRockets = [0.07, 0.34, 0.55, 0.78, 1]
    .map((op, i) => {
      const x = 661.5 + i * 15;
      const fill = i === 0 ? ink : accent;
      const flm = i === 0
        ? ''
        : `<use class="nx-flm" href="#${prefix}-flm" xlink:href="#${prefix}-flm" opacity="${(0.35 + op * 0.5).toFixed(2)}"/>`;
      return `<g transform="translate(${x},68.5)"><use href="#${prefix}-rkt" xlink:href="#${prefix}-rkt" fill="${fill}" fill-opacity="${op}"/>${flm}</g>`;
    })
    .join('');

  svg = svg.replace(
    /(?:<rect x="(?:656|671|686|701|716)" y="63"[^/]*\/>){5}/,
    legendRockets,
  );

  const spline = 'calcMode="spline" keySplines="0.16 1 0.3 1;0.34 1 0.64 1"';
  let cells = 0;
  svg = svg.replace(
    /<g transform="translate\(([\d.]+),([\d.]+)\)">\s*<rect([^>]*)>([\s\S]*?)<\/rect>\s*<\/g>/g,
    (_m, x, y, attrs, inner) => {
      cells += 1;
      const fill = attrs.match(/fill="([^"]+)"/)?.[1] || accent;
      const values = inner.match(/attributeName="fill-opacity" values="([^"]+)"/)?.[1] || '0;0.07;0.07';
      const parts = values.split(';').map(Number);
      const finalOp = parts[2] ?? parts[1] ?? 0.07;
      const peak = parts[1] ?? finalOp;
      const begin = inner.match(/\bbegin="([^"]+)"/)?.[1] || '0.2s';
      const dur = inner.match(/\bdur="([^"]+)"/)?.[1] || '0.6s';
      const active = finalOp > 0.12;
      const hop = finalOp >= 0.95 ? 16 : finalOp >= 0.7 ? 13 : finalOp >= 0.5 ? 10 : 7;
      const beginSec = Number.parseFloat(begin) || 0.2;
      const liveAt = `${(beginSec + 0.95).toFixed(3)}s`;
      const live = finalOp >= 0.95
        ? { hi: 1, lo: 0.72, dur: 1.9, cls: 'nx-live-4' }
        : finalOp >= 0.7
          ? { hi: 1, lo: Math.max(0.55, finalOp - 0.12), dur: 2.4, cls: 'nx-live-3' }
          : finalOp >= 0.5
            ? { hi: Math.min(1, finalOp + 0.22), lo: finalOp, dur: 3.0, cls: 'nx-live-2' }
            : { hi: Math.min(1, finalOp + 0.18), lo: finalOp, dur: 3.6, cls: 'nx-live-1' };
      const pad = active
        ? `<rect class="${live.cls}" x="-5.5" y="-5.5" width="11" height="11" rx="2.5" fill="${fill}" fill-opacity="0" transform="scale(0.15)"><animate attributeName="fill-opacity" values="0;0;${peak};${finalOp}" keyTimes="0;0.58;0.82;1" begin="${begin}" dur="0.95s" fill="freeze"/><animate attributeName="fill-opacity" values="${live.lo};${live.hi};${live.lo}" begin="${liveAt}" dur="${live.dur}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="scale" values="0.15;0.15;1.14;1" keyTimes="0;0.58;0.82;1" begin="${begin}" dur="0.95s" fill="freeze" calcMode="spline" keySplines="0 0 1 1;0.16 1 0.3 1;0.34 1 0.64 1"/></rect>`
        : `<rect x="-5.5" y="-5.5" width="11" height="11" rx="2.5" fill="${fill}" fill-opacity="0" transform="scale(0.15)"><animate attributeName="fill-opacity" values="0;${finalOp};${finalOp}" keyTimes="0;0.55;1" begin="${begin}" dur="${dur}" fill="freeze"/><animateTransform attributeName="transform" type="scale" values="0.15;1.08;1" keyTimes="0;0.55;1" begin="${begin}" dur="${dur}" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1;0.4 0 0.2 1"/></rect>`;
      if (!active) return `<g transform="translate(${x},${y})">${pad}</g>`;
      return `<g transform="translate(${x},${y})">${pad}<g opacity="0"><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.66;1" begin="${begin}" dur="0.9s" fill="freeze"/><animateTransform attributeName="transform" type="translate" values="0 18; 0 -${hop}; 0 0" keyTimes="0;0.58;1" begin="${begin}" dur="0.9s" fill="freeze" ${spline}/><use href="#${prefix}-rkt" xlink:href="#${prefix}-rkt" fill="${fill}"/><use class="nx-flm" href="#${prefix}-flm" xlink:href="#${prefix}-flm"/></g></g>`;
    },
  );
  if (cells < 50) throw new Error('heatmap: rocket pass found too few cells');

  const craft = `
    <g class="nx-craft" opacity="0">
      <animateTransform id="${prefix}-pass" attributeName="transform" type="translate" values="40 193; 790 193" begin="0.2s" dur="2.2s" fill="freeze"/>
      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.06;0.88;1" begin="0.2s" dur="2.2s" fill="freeze"/>
      <rect x="0" y="-95" width="2" height="86" fill="${accent}" opacity="0.32"/>
      <ellipse class="nx-hero-flame" cx="-7" cy="0" rx="9" ry="3.1" fill="${flame}" opacity="0.8"/>
      <ellipse class="nx-hero-flame" cx="-3" cy="0" rx="4.2" ry="1.6" fill="${flameHot}"/>
      <path d="M1 2.8 L7.5 2.8 L-1 9.2 L-5 9.2Z" fill="${accent}"/>
      <path d="M1 -2.8 L7.5 -2.8 L-1 -9.2 L-5 -9.2Z" fill="${accent}"/>
      <path d="M-5 -4.2 L15 -4.2 C22.5 -4.2 26.5 -2 28.5 0 C26.5 2 22.5 4.2 15 4.2 L-5 4.2 C-7.8 4.2 -8.8 2.3 -8.8 0 C-8.8 -2.3 -7.8 -4.2 -5 -4.2Z" fill="${ink}"/>
      <circle cx="17.5" cy="0" r="2.05" fill="${canopy}"/>
      <rect x="0" y="-0.9" width="11" height="1.8" rx="0.9" fill="${accent}"/>
    </g>`;

  svg = svg.replace(
    /<rect x="46" y="98" width="2.5" height="99"[\s\S]*?<\/rect>/,
    craft,
  );

  return svg;
}

/** Tweaks label + figure sizes inside each stat box. */
function shrinkStats(svg) {
  return matchSectionTitle(svg)
    .replace(/(<text x="\d+" y="126"[^>]*?)font-size="12"/g, '$1font-size="13"')
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

/** After subtitle strip, pull chips up + shrink card so title→boxes gap tight. */
function tightenStats(svg) {
  const ys = { 92: 76, 126: 110, 162: 146, 186: 170 };
  svg = svg.replace(/ y="(\d+)"/g, (m, y) => {
    const n = Number(y);
    return ys[n] !== undefined ? ` y="${ys[n]}"` : m;
  });
  return svg
    .replace(/height="260"/g, 'height="244"')
    .replace(/height="259"/g, 'height="243"')
    .replace('width="804" height="206"', 'width="804" height="190"')
    .replace('viewBox="0 0 860 260"', 'viewBox="0 0 860 244"');
}

const VISITORS_FILE = `${OUT_DIR}/visitors.json`;
let visitorCount = 0;

function parseStatNumber(raw) {
  const text = String(raw).trim().replace(/,/g, '');
  const match = text.match(/^([\d.]+)\s*([kKmM])?$/);
  if (!match) return Number(text) || 0;
  const n = Number(match[1]);
  const unit = (match[2] || '').toLowerCase();
  if (unit === 'k') return Math.round(n * 1e3);
  if (unit === 'm') return Math.round(n * 1e6);
  return n;
}

function formatStatNumber(n) {
  const v = Math.max(0, Math.round(Number(n) || 0));
  if (v >= 1_000_000) return `${(v / 1e6).toFixed(v >= 10_000_000 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(v);
}

async function loadStoredVisitors() {
  try {
    return JSON.parse(await readFile(VISITORS_FILE, 'utf8'));
  } catch {
    return { unique: 0, others: 0, byDay: {} };
  }
}

/**
 * Unique visitors excluding the owner (minus one unique for self).
 * Traffic API = repo uniques, no self-increment. hits.sh = profile README pixel.
 */
async function fetchVisitorCount() {
  const stored = await loadStoredVisitors();
  let unique = Number(stored.unique) || 0;
  const byDay = { ...(stored.byDay || {}) };

  try {
    const response = await fetch(`https://api.github.com/repos/${USERNAME}/${USERNAME}/traffic/views`, {
      headers: githubHeaders(),
    });
    if (response.ok) {
      const data = await response.json();
      for (const row of data.views || []) {
        const day = String(row.timestamp || '').slice(0, 10);
        if (!day) continue;
        byDay[day] = Math.max(byDay[day] || 0, Number(row.uniques) || 0);
      }
      const trafficSum = Object.values(byDay).reduce((sum, n) => sum + Number(n || 0), 0);
      unique = Math.max(unique, trafficSum);
    }
  } catch {
    /* traffic needs push access; keep stored */
  }

  try {
    const response = await fetch(`https://hits.sh/github.com/${USERNAME}/${USERNAME}.svg?view=unique`);
    if (response.ok) {
      const svg = await response.text();
      const raw = svg.match(/hits:\s*([\d,]+)/i)?.[1] || svg.match(/>([\d,]+)<\/text>\s*<\/g>/)?.[1];
      const n = Number(String(raw || '').replace(/,/g, ''));
      if (Number.isFinite(n) && n >= 0) unique = Math.max(unique, n);
    }
  } catch {
    /* optional profile-hit signal */
  }

  unique = Math.max(unique, Number(stored.unique) || 0);
  const others = Math.max(0, unique - 1);
  await writeFile(
    VISITORS_FILE,
    `${JSON.stringify({ unique, others, byDay, updated: new Date().toISOString() }, null, 2)}\n`,
  );
  console.log('visitors excluding owner:', others);
  return others;
}

function visitorPixelBlock() {
  const src = `https://hits.sh/github.com/${USERNAME}/${USERNAME}.svg?view=unique`;
  return `<p align="center">\n  <img src="${src}" width="1" height="1" alt="" />\n</p>\n`;
}

const VISITOR_PIXEL_RE =
  /<p align="center">\s*<img src="https:\/\/hits\.sh\/github\.com\/[^"]+"[^>]*>\s*<\/p>\s*/;

async function ensureVisitorPixel() {
  let readme = await readFile('README.md', 'utf8');
  const pixel = visitorPixelBlock();
  if (VISITOR_PIXEL_RE.test(readme)) {
    readme = readme.replace(VISITOR_PIXEL_RE, pixel);
  } else if (readme.includes('assets/stats.svg')) {
    readme = readme.replace(
      /(<picture>(?:(?!<\/picture>)[\s\S])*assets\/stats\.svg(?:(?!<\/picture>)[\s\S])*<\/picture>\s*\r?\n<\/p>)/,
      `$1\n${pixel}`,
    );
  } else {
    return;
  }
  await writeFile('README.md', readme);
  console.log('updated README.md visitor pixel');
}

/**
 * Whitish matched boxes, Stars → Visitors (excluding owner), bars scaled to the set.
 */
function revampStats(svg, visitors) {
  const boxFill = '#ffffff';
  const boxStroke = '#d7dee8';
  const ink = '#0f172a';
  const mute = '#475569';

  svg = svg
    .replace(/[ \t]*<circle class="aura-ring[^"]*"[^>]*cx="735"[^/]*\/>\r?\n?/g, '')
    .replace(/>Stars</g, '>Visitors<')
    .replace(
      /<rect x="28" y="26" width="804" height="190" rx="28" fill="[^"]+" stroke="[^"]+" stroke-opacity="[^"]+"/,
      `<rect x="28" y="26" width="804" height="190" rx="28" fill="${boxFill}" stroke="${boxStroke}" stroke-opacity="0.55"`,
    )
    .replace(
      /<rect x="(\d+)" y="76" width="180" height="122" rx="24" fill="[^"]+" stroke="[^"]+" stroke-opacity="[^"]+"/g,
      `<rect x="$1" y="76" width="180" height="122" rx="24" fill="${boxFill}" stroke="${boxStroke}" stroke-opacity="0.55"`,
    )
    .replace(
      /<rect width="860" height="244" rx="32" fill="url\([^"]+\)"/,
      '<rect width="860" height="244" rx="32" fill="#f6f8fc"',
    )
    .replace(
      /<rect x="0.5" y="0.5" width="859" height="243" rx="31.5" fill="none" stroke="[^"]+" stroke-opacity="[^"]+"/,
      `<rect x="0.5" y="0.5" width="859" height="243" rx="31.5" fill="none" stroke="${boxStroke}" stroke-opacity="0.62"`,
    )
    .replace(/fill="rgba\(255,255,255,0\.1\)"/g, 'fill="rgba(15,23,42,0.08)"')
    .replace(/<text([^>]*x="46" y="61"[^>]*)fill="#(?:e6edf3|0f172a)"/, `<text$1fill="${ink}"`)
    .replace(/<text([^>]*x="48" y="84"[^>]*)fill="#(?:8b949e|475569)"/, `<text$1fill="${mute}"`)
    .replace(/fill="#8b949e"/g, `fill="${mute}"`);

  const visitorLabel = formatStatNumber(visitors);
  svg = svg.replace(
    /(<text[^>]*x="68" y="146"[^>]*>)[^<]+(<\/text>)/,
    `$1${visitorLabel}$2`,
  );

  const values = [];
  svg.replace(/<text[^>]*x="(\d+)" y="146"[^>]*>([^<]+)<\/text>/g, (_m, x, raw) => {
    values.push({ x: Number(x), n: parseStatNumber(raw) });
    return _m;
  });
  const peak = Math.max(1, ...values.map((row) => row.n));
  let bar = 0;
  svg = svg.replace(/<rect class="aura-bar"([^>]*)width="\d+"/g, (full, attrs) => {
    const row = values[bar++];
    const width = row ? Math.max(11, Math.round(136 * (row.n / peak))) : 11;
    return `<rect class="aura-bar"${attrs}width="${width}"`;
  });

  return injectStatsRockets(svg);
}

/** Horizontal rocket parked at each bar tip. */
function injectStatsRockets(svg) {
  const prefix = svg.match(/<g id="(gs-[^"]+)"/)?.[1];
  if (!prefix) return svg;

  const accent = /github-dark-light/.test(svg) ? '#1a85ff' : '#58a6ff';
  const flame = '#ff6b35';
  const flameHot = '#ffd60a';
  const fills = [accent, '#2ad5ef', '#a371f7', '#43d55c'];

  svg = svg.replace(/<g transform="translate\((?:136|332|528|724),168\)"><g opacity="0">[\s\S]*?<\/g><\/g>/g, '');
  svg = svg.replace(/<g class="nx-orbit">[\s\S]*?<\/g>\s*<\/g>/g, '');
  svg = svg.replace(/<g class="nx-orbit">[\s\S]*?<\/g>/g, '');
  svg = svg.replace(/      #[^\s]+ \.nx-hero-flame \{[^}]+\}\n/, '');
  svg = svg.replace(/      @keyframes nx-hero-flame \{[^\n]+\n/, '');
  svg = svg.replace(/<g class="nx-bar-rkt"[^>]*>[\s\S]*?<\/g>\s*<\/g>/g, '');
  svg = svg.replace(/<g class="nx-bar-rkt"[^>]*>[\s\S]*?<\/g>/g, '');

  if (!svg.includes(`id="${prefix}-srt"`)) {
    const defs = `
    <symbol id="${prefix}-srt" overflow="visible">
      <path d="M-2.1 0.9L-3.4 3.6L-2 2.5Z"/>
      <path d="M2.1 0.9L3.4 3.6L2 2.5Z"/>
      <path d="M0-4.2C1.3-4.2 2.2-2.8 2.2-1.6V2.4c0 .7-.55 1.2-1.2 1.2h-2c-.65 0-1.2-.5-1.2-1.2V-1.6C-2.2-2.8-1.3-4.2 0-4.2Z"/>
    </symbol>
    <symbol id="${prefix}-sfl" overflow="visible">
      <path d="M-1 3.5L0 6.4 1 3.5Z" fill="${flame}"/>
      <path d="M-0.5 3.5L0 5.2 .5 3.5Z" fill="${flameHot}"/>
    </symbol>
`;
    svg = svg.replace('</defs>', `${defs}  </defs>`);
  }

  const bars = [];
  svg.replace(/<rect class="aura-bar"[^>]*>/g, (tag) => {
    const x = Number(tag.match(/\bx="([\d.]+)"/)?.[1]);
    const y = Number(tag.match(/\by="([\d.]+)"/)?.[1]);
    const w = Number(tag.match(/\bwidth="([\d.]+)"/)?.[1]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w)) bars.push({ x, y, w });
    return tag;
  });
  const rest = bars
    .map((bar, i) => `<g class="nx-bar-rkt" transform="translate(${bar.x + bar.w},${bar.y + 3.5}) rotate(90)"><use href="#${prefix}-srt" xlink:href="#${prefix}-srt" fill="${fills[i] || accent}"/><use class="nx-flm" href="#${prefix}-sfl" xlink:href="#${prefix}-sfl"/></g>`)
    .join('');
  if (rest) {
    svg = svg.replace(
      /<rect x="0.5" y="0.5" width="859" height="243"/,
      `${rest}\n    <rect x="0.5" y="0.5" width="859" height="243"`,
    );
  }

  if (!svg.includes('.nx-flm')) {
    const glow = svg.includes('g.aura-chip > rect:first-of-type')
      ? ''
      : `      #${prefix} g.aura-chip > rect:first-of-type { animation: nx-glow 4.2s ease-in-out 1.4s infinite; }\n`;
    const extra = `      #${prefix} .aura-bar { animation: nx-bar 1s cubic-bezier(0.16,1,0.3,1) both, nx-burn 2.4s ease-in-out 1.2s infinite; }\n      #${prefix} .nx-flm { animation: nx-flicker 280ms ease-in-out infinite; transform-box: fill-box; transform-origin: center top; }\n`;
    const frames = [
      svg.includes('@keyframes nx-glow') ? '' : '      @keyframes nx-glow { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.38); } }\n',
      svg.includes('@keyframes nx-burn') ? '' : '      @keyframes nx-burn { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.28); } }\n',
      svg.includes('@keyframes nx-flicker') ? '' : '      @keyframes nx-flicker { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.28); } }\n',
    ].join('');
    svg = svg.replace('  </style>', `${glow}${extra}${frames}  </style>`);
  }

  return svg;
}

/** Drops the "> stack.scan" terminal flourish and its blinking cursor. */
function trimStack(svg) {
  return matchSectionTitle(svg)
    .replace(/[ \t]*<text[^>]*>&gt; stack\.scan<\/text>\r?\n?/, '')
    .replace(/[ \t]*<text class="aura-cursor" x="786"[^>]*>_<\/text>\r?\n?/, '');
}

/** Five distinct bright accents for the language rows (dot / % / bar). */
const STACK_ROW_COLORS = ['#3B9EFF', '#FF4D9A', '#FFD60A', '#2EE6A6', '#FF6B35'];

function brightenStackColors(svg) {
  let row = 0;
  svg = svg.replace(/<circle\b[^>]*>/gi, (tag) => {
    if (!/\bcx="54"/.test(tag) || !/\br="5"/.test(tag)) return tag;
    const color = STACK_ROW_COLORS[row++];
    if (!color) return tag;
    return tag.replace(/\bfill="#[0-9A-Fa-f]{3,8}"/i, `fill="${color}"`);
  });

  row = 0;
  svg = svg.replace(/<text\b[^>]*>/gi, (tag) => {
    if (!/\bx="306"/.test(tag)) return tag;
    const color = STACK_ROW_COLORS[row++];
    if (!color) return tag;
    return tag.replace(/\bfill="#[0-9A-Fa-f]{3,8}"/i, `fill="${color}"`);
  });

  row = 0;
  svg = svg.replace(/<rect\b[^>]*>/gi, (tag) => {
    if (!/\baura-bar\b/.test(tag)) return tag;
    const color = STACK_ROW_COLORS[row++];
    if (!color) return tag;
    return tag.replace(/\bfill="#[0-9A-Fa-f]{3,8}"/i, `fill="${color}"`);
  });

  return svg;
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
  hero: (svg) => roundCorners(stylizeHero(svg)),
  stats: (svg) => roundCorners(revampStats(tightenStats(alignStatBoxes(shrinkStats(svg))), visitorCount)),
  stack: (svg) => roundCorners(brightenStackColors(trimStack(svg))),
  heatmap: (svg) => roundCorners(stylizeHeatmap(matchSectionTitle(svg))),
};

/**
 * Motion layer — one choreographed entrance per card, then stillness.
 *
 * Rules: single axis (rise), 60–120ms sibling stagger, expo-out settles,
 * spring overshoot only on small focal elements (numbers, dots). No infinite
 * loops except subtle hero ambient motion; ambient life comes from the
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
      #${prefix} .nx-ring-spin { animation: nx-spin 3s linear 1.15s infinite; transform-origin: 96px 88px; }
      #${prefix} .nx-ring-draw { stroke-dasharray: 302; animation: nx-scale-in 650ms cubic-bezier(0.16,1,0.3,1) 60ms both, nx-draw 950ms cubic-bezier(0.16,1,0.3,1) 200ms both; transform-box: fill-box; transform-origin: center; }
      #${prefix} .nx-handle { animation: nx-handle 900ms cubic-bezier(0.16,1,0.3,1) 250ms both; }
      #${prefix} .nx-location { animation: nx-fade 500ms ease-out 900ms both; }
      #${prefix} .nx-num { animation: nx-pop 700ms cubic-bezier(0.34,1.56,0.64,1) both; transform-box: fill-box; transform-origin: center bottom; }
      #${prefix} .nx-dot { animation: nx-pop 550ms cubic-bezier(0.34,1.56,0.64,1) both; transform-box: fill-box; transform-origin: center; }
      #${prefix} .aura-ring.nx-spin { animation: ${prefix}-ring 8s ease-in-out infinite, nx-spin 60s linear infinite; transform-box: fill-box; transform-origin: center; }
      #${prefix} .aura-ring-b.nx-spin-rev { animation: ${prefix}-ring 10s ease-in-out infinite 1.6s, nx-spin-rev 45s linear infinite; transform-box: fill-box; transform-origin: center; }
      #${prefix} g.aura-chip { animation: nx-card 800ms cubic-bezier(0.22,1,0.36,1) both; transition: filter 240ms ease; cursor: pointer; }
      #${prefix} g.aura-chip:hover { filter: brightness(1.1) drop-shadow(0 10px 16px rgba(88,166,255,0.28)); }
      #${prefix} g.aura-chip > rect:first-of-type { animation: nx-glow 4.2s ease-in-out 1.4s infinite; }
      #${prefix} .aura-bar { animation: nx-bar 1s cubic-bezier(0.16,1,0.3,1) both, nx-burn 2.4s ease-in-out 1.2s infinite; transition: filter 220ms ease; }
      #${prefix} g.aura-chip:hover .aura-bar { filter: brightness(1.2); }
      #${prefix} .nx-flm { animation: nx-flicker 280ms ease-in-out infinite; transform-box: fill-box; transform-origin: center top; }
      #${prefix} .nx-hero-flame { animation: nx-hero-flame 180ms ease-in-out infinite; transform-box: fill-box; transform-origin: right center; }
      #${prefix} .nx-live-1 { animation: nx-glow 3.6s ease-in-out 3.2s infinite; }
      #${prefix} .nx-live-2 { animation: nx-glow 3s ease-in-out 3.1s infinite; }
      #${prefix} .nx-live-3 { animation: nx-glow 2.4s ease-in-out 3s infinite; }
      #${prefix} .nx-live-4 { animation: nx-glow 1.9s ease-in-out 2.9s infinite; }
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
      @keyframes nx-flicker { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.28); } }
      @keyframes nx-hero-flame { 0%,100% { transform: scaleX(1); } 50% { transform: scaleX(1.22); } }
      @keyframes nx-glow { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.38); } }
      @keyframes nx-burn { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.28); } }
    }
`;
}

/** Injects an inline animation-delay so nested elements inherit their row's stagger. */
function staggered(svg, pattern, insert, base, step) {
  let index = 0;
  return svg.replace(pattern, (...match) => insert(match, `style="animation-delay:${base + index++ * step}ms"`));
}

function heroRingDefs(prefix, light) {
  const base = light ? '#0069e0' : '#58a6ff';
  const hot = light ? '#6bb8ff' : '#c8e4ff';
  return `
    <linearGradient id="${prefix}-ring-stroke" gradientUnits="userSpaceOnUse" x1="48" y1="88" x2="144" y2="88">
      <stop offset="0%" stop-color="${base}" stop-opacity="0.78"/>
      <stop offset="20%" stop-color="${hot}" stop-opacity="1"/>
      <stop offset="42%" stop-color="${base}" stop-opacity="0.82"/>
      <stop offset="100%" stop-color="${base}" stop-opacity="0.92"/>
    </linearGradient>
    <filter id="${prefix}-ring-glow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3.6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
}

const ANIMATE = {
  hero: (svg, prefix) => {
    const light = /-light$/.test(prefix) || /github-dark-light/.test(prefix);
    const ringDefs = heroRingDefs(prefix, light);
    return svg
    // Name reveals through a left-to-right wipe, timed with the arc drawing above it.
    .replace('</defs>', `${ringDefs}\n  <clipPath id="${prefix}-namewipe"><rect x="166" y="64" width="0" height="66"><animate attributeName="width" values="0;520" keyTimes="0;1" calcMode="spline" keySplines="0.16 1 0.3 1" begin="0.35s" dur="0.9s" fill="freeze"/></rect></clipPath>\n  </defs>`)
    .replace('<text x="166" y="116"', `<text clip-path="url(#${prefix}-namewipe)" x="166" y="116"`)
    .replace(' x="51" y="43" width="90"', ' class="nx-avatar" x="51" y="43" width="90"')
    .replace(/<circle cx="96" cy="88" r="48"[^>]*\/>/, `<g class="nx-ring-spin" filter="url(#${prefix}-ring-glow)"><circle class="nx-ring-draw" stroke="url(#${prefix}-ring-stroke)" stroke-dashoffset="302" cx="96" cy="88" r="48" fill="rgba(255,255,255,0.06)" stroke-width="2.75"/></g>`)
    .replace('<text x="166" y="63"', '<text class="nx-handle" x="166" y="63"');
  },

  stats: (svg) => {
    svg = svg
      .replace('<text x="46" y="61"', '<text class="nx-in" x="46" y="61"')
      .replace('<text x="48" y="84"', '<text class="nx-in nx-in-2" x="48" y="84"');
    svg = staggered(svg, /<text x="(\d+)" y="146"/g, ([, x], style) => `<text class="nx-num" ${style} x="${x}" y="146"`, 350, 100);
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

  heatmap: (svg) => svg
    .replace('<text x="46" y="60"', '<text class="nx-in" x="46" y="60"')
    .replace('<text x="48" y="84"', '<text class="nx-in nx-in-2" x="48" y="84"'),
};

function addMotion(svg, section) {
  const enhance = ANIMATE[section];
  if (!enhance) return svg;

  const prefix = svg.match(/<g id="(gs-[^"]+)"/)?.[1];
  if (!prefix) throw new Error('could not find the card id needed to scope the motion styles');

  return enhance(svg, prefix).replace('  </style>', `${motionStyles(prefix)}  </style>`);
}

async function refresh(section, light, profile = {}) {
  const name = `${section}${light ? '-light' : ''}.svg`;
  let svg = removeBranding(await download(section, light));
  const customize = CUSTOMIZE[section];
  if (customize) svg = customize(svg);
  if (section === 'hero') svg = injectHeroLocation(svg, profile.location, light);
  svg = addMotion(svg, section);

  if (/gitskins/i.test(svg)) throw new Error(`${name}: branding survived the cleanup`);
  if (section === 'hero' && /<g class="aura-chip"/.test(svg)) throw new Error(`${name}: language chips survived the cleanup`);
  if (ANIMATE[section] && !svg.includes('@keyframes nx-')) throw new Error(`${name}: motion layer was not applied`);
  if (section === 'stats' && !svg.includes('>Visitors<')) throw new Error(`${name}: visitors stat was not applied`);
  if (section === 'heatmap' && !svg.includes('Contribution Activity')) throw new Error(`${name}: contribution title was not applied`);
  if (section === 'heatmap' && !svg.includes(`-rkt"`)) throw new Error(`${name}: rocket layer was not applied`);

  await writeFile(`${OUT_DIR}/${name}`, svg);
  console.log('updated', name);
}

function githubHeaders() {
  const headers = { 'User-Agent': `${USERNAME}-profile-refresh`, Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return headers;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Fetches live GitHub profile fields (bio + location + display name). */
async function fetchProfile() {
  const response = await fetch(`https://api.github.com/users/${USERNAME}`, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`profile: GitHub API HTTP ${response.status}`);
  const data = await response.json();
  return {
    bio: data.bio?.trim() || '',
    location: data.location?.trim() || '',
    name: data.name?.trim() || data.login || USERNAME,
  };
}

/** Greedy word-wrap into up to 3 normal left-aligned lines. */
function wrapBio(bio) {
  const words = bio.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > ABOUT_LINE_CHARS && current) {
      lines.push(current);
      current = word;
      if (lines.length === 3) break;
    } else {
      current = next;
    }
  }
  if (lines.length < 3 && current) lines.push(current);
  while (lines.length < 3) lines.push('');
  return lines.slice(0, 3).map(escapeXml);
}

const ABOUT_README_RE =
  /\r?\n*<p align="center">\s*\r?\n\s*<picture>(?:(?!<\/picture>)[\s\S])*assets\/about\.svg(?:(?!<\/picture>)[\s\S])*<\/picture>\s*\r?\n<\/p>\r?\n*/;

const HERO_README_RE =
  /(<p align="center">\s*\r?\n\s*<picture>(?:(?!<\/picture>)[\s\S])*assets\/hero\.svg(?:(?!<\/picture>)[\s\S])*<\/picture>\s*\r?\n<\/p>)/;

function aboutReadmeBlock(bio) {
  return `
<p align="center">
  <picture><source media="(prefers-color-scheme: light)" srcset="assets/about-light.svg" /><img src="assets/about.svg" alt="${escapeXml(bio)}" width="860" /></picture>
</p>
`;
}

/** Sync About SVGs + README. Empty bio hides the About section entirely. */
async function refreshAbout(bio, displayName = USERNAME) {
  let readme = await readFile('README.md', 'utf8');

  if (!bio) {
    if (!ABOUT_README_RE.test(readme)) {
      console.log('About section already absent (bio empty)');
      return;
    }
    await writeFile('README.md', readme.replace(ABOUT_README_RE, '\n'));
    console.log('removed About section (bio empty)');
    return;
  }

  const aria = escapeXml(`About ${displayName}`);
  const [line1, line2, line3] = wrapBio(bio);
  for (const name of ['about.svg', 'about-light.svg']) {
    const path = `${OUT_DIR}/${name}`;
    let svg = await readFile(path, 'utf8');
    svg = svg.replace(/aria-label="[^"]*"/, `aria-label="${aria}"`);
    let i = 0;
    const next = svg.replace(
      /(<text class="line(?: line-[23])?"[^>]*>)([^<]*)(<\/text>)/g,
      (_m, open, _old, close) => {
        const ink = name.includes('light') ? '#0f172a' : '#e6edf3';
        let tag = open
          .replace(/\s*textLength="[^"]*"/g, '')
          .replace(/\s*lengthAdjust="[^"]*"/g, '')
          .replace(/\bfont-weight="[^"]*"/, 'font-weight="700"')
          .replace(/\bfont-size="[^"]*"/, 'font-size="18"')
          .replace(/\bletter-spacing="[^"]*"/g, '')
          .replace(/\bfill="[^"]*"/, `fill="${ink}"`)
          .replace(/\s*stroke="[^"]*"/g, '')
          .replace(/\s*stroke-width="[^"]*"/g, '')
          .replace(/\s*paint-order="[^"]*"/g, '');
        tag = /\btext-anchor=/.test(tag)
          ? tag.replace(/\btext-anchor="[^"]*"/, 'text-anchor="start"')
          : tag.replace(/>$/, ' text-anchor="start">');
        return `${tag}${[line1, line2, line3][i++]}${close}`;
      },
    );
    if (i !== 3) throw new Error(`${name}: expected 3 about lines, found ${i}`);
    await writeFile(path, next);
    console.log('updated', name);
  }

  readme = await readFile('README.md', 'utf8');
  const block = aboutReadmeBlock(bio);
  if (ABOUT_README_RE.test(readme)) {
    await writeFile('README.md', readme.replace(ABOUT_README_RE, `\n${block}`));
  } else {
    if (!HERO_README_RE.test(readme)) throw new Error('about: could not find hero block to insert About after');
    await writeFile('README.md', readme.replace(HERO_README_RE, `$1\n${block}`));
  }
  console.log('updated README.md About section');
}

const ICONS = {
  github: {
    scale: 0.58,
    path: 'M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z',
  },
  instagram: {
    scale: 0.52,
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  leetcode: {
    scale: 0.52,
    path: 'M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z',
  },
  twitter: {
    scale: 0.5,
    path: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  },
  link: {
    scale: 0.5,
    path: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  },
};

const PLATFORM_LABEL = {
  github: 'GitHub',
  instagram: 'Instagram',
  leetcode: 'LeetCode',
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  facebook: 'Facebook',
  link: 'Link',
};

function detectPlatform(provider, rawUrl) {
  const host = (() => {
    try {
      return new URL(rawUrl).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return '';
    }
  })();
  const p = (provider || '').toLowerCase();
  if (p === 'twitter' || host === 'x.com' || host === 'twitter.com') return 'twitter';
  if (p === 'instagram' || host === 'instagram.com') return 'instagram';
  if (host === 'leetcode.com') return 'leetcode';
  if (p === 'github' || host === 'github.com') return 'github';
  if (p === 'linkedin' || host.includes('linkedin.com')) return 'linkedin';
  if (p === 'youtube' || host.includes('youtube.com') || host === 'youtu.be') return 'youtube';
  if (p === 'facebook' || host.includes('facebook.com')) return 'facebook';
  return 'link';
}

function handleFromUrl(platform, rawUrl) {
  let pathname = '/';
  try {
    pathname = new URL(rawUrl).pathname.replace(/\/+$/, '');
  } catch {
    /* keep default */
  }
  const parts = pathname.split('/').filter(Boolean);
  let handle = parts.at(-1) || USERNAME;
  if (platform === 'leetcode' && parts[0] === 'u' && parts[1]) handle = parts[1];
  if (platform === 'github' && parts[0]) handle = parts[0];
  const withAt = platform === 'leetcode' || platform === 'link' ? handle : `@${handle.replace(/^@/, '')}`;
  return withAt.length > 16 ? withAt.slice(0, 15) + '…' : withAt;
}

async function fetchSocialLinks() {
  const headers = githubHeaders();
  const socialRes = await fetch(`https://api.github.com/users/${USERNAME}/social_accounts`, { headers });
  if (!socialRes.ok) throw new Error(`connect: social_accounts HTTP ${socialRes.status}`);

  const social = await socialRes.json();
  const links = [];

  for (const item of social) {
    if (!item?.url) continue;
    const normalized = item.url.replace(/\/+$/, '');
    if (links.some((l) => l.url.replace(/\/+$/, '') === normalized)) continue;
    links.push({ url: item.url, provider: item.provider || 'generic' });
    if (links.length >= MAX_CONNECT) break;
  }

  if (links.length < MAX_CONNECT) {
    try {
      const userRes = await fetch(`https://api.github.com/users/${USERNAME}`, { headers });
      if (userRes.ok) {
        const user = await userRes.json();
        if (user.blog?.trim()) {
          let blog = user.blog.trim();
          if (!/^https?:\/\//i.test(blog)) blog = `https://${blog}`;
          const normalized = blog.replace(/\/+$/, '');
          if (!links.some((l) => l.url.replace(/\/+$/, '') === normalized)) {
            links.push({ url: blog, provider: 'generic' });
          }
        }
      }
    } catch {
      /* blog is optional; social_accounts alone is enough */
    }
  }

  return links.slice(0, MAX_CONNECT).map((item) => {
    const platform = detectPlatform(item.provider, item.url);
    return {
      url: item.url,
      platform,
      label: PLATFORM_LABEL[platform] || PLATFORM_LABEL.link,
      handle: handleFromUrl(platform, item.url),
    };
  });
}

function renderChip({ platform, label, handle }, index, light) {
  const id = `holo-${index}${light ? '-l' : ''}`;
  const icon = ICONS[platform] || ICONS.link;
  const fill = light ? '#ffffff' : '#161b22';
  const ink = light ? '#0f172a' : '#e6edf3';
  const mute = light ? '#475569' : '#8b949e';
  const disc = light ? 'fill="#0f172a" fill-opacity="0.1"' : 'fill="#ffffff" fill-opacity="0.16"';
  const rim = light ? 'stroke="#0f172a" stroke-opacity="0.08"' : 'stroke="#ffffff" stroke-opacity="0.22"';
  const ping = light ? 'stroke="#0f172a"' : 'stroke="#ffffff"';
  const mark = light ? '#0f172a' : '#ffffff';
  const stops = light
    ? `<stop offset="0%" stop-color="#0f172a"/>
      <stop offset="18%" stop-color="#f6f8fc"/>
      <stop offset="38%" stop-color="#0069e0"/>
      <stop offset="58%" stop-color="#475569"/>
      <stop offset="78%" stop-color="#f6f8fc"/>
      <stop offset="100%" stop-color="#0f172a"/>`
    : `<stop offset="0%" stop-color="#e6edf3"/>
      <stop offset="18%" stop-color="#0d1117"/>
      <stop offset="38%" stop-color="#58a6ff"/>
      <stop offset="58%" stop-color="#8b949e"/>
      <stop offset="78%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#e6edf3"/>`;
  const handleSize = handle.length > 14 ? 12 : 13;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="190" height="50" viewBox="0 0 190 50" role="img" aria-label="${escapeXml(label)}">
  <defs>
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      ${stops}
      <animateTransform attributeName="gradientTransform" type="rotate" from="0 0.5 0.5" to="360 0.5 0.5" dur="8s" repeatCount="indefinite"/>
    </linearGradient>
  </defs>
  <style>
    @media (prefers-reduced-motion: no-preference) {
      rect { animation: nx-fade 500ms ease-out both; }
      circle { animation: nx-icon 700ms cubic-bezier(0.34,1.56,0.64,1) 120ms both; transform-box: fill-box; transform-origin: center; }
      text { animation: nx-in 600ms cubic-bezier(0.16,1,0.3,1) both; }
      text:nth-of-type(1) { animation-delay: 160ms; }
      text:nth-of-type(2) { animation-delay: 260ms; }
      @keyframes nx-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes nx-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes nx-icon { 0% { opacity: 0; transform: scale(0.4); } 65% { opacity: 1; transform: scale(1.15); } 100% { opacity: 1; transform: scale(1); } }
    }
  </style>
  <rect x="1" y="2" width="188" height="46" rx="23" fill="${fill}" stroke="url(#${id})" stroke-width="2"/>
  <rect x="2" y="3" width="186" height="44" rx="22" fill="none" ${rim}/>
  <circle cx="28" cy="25" r="12" ${disc}/>
  <circle cx="28" cy="25" r="12" fill="none" ${ping} stroke-opacity="0" stroke-width="1.5">
    <animate attributeName="r" values="12;21;21" keyTimes="0;0.45;1" dur="5s" begin="1.8s" repeatCount="indefinite"/>
    <animate attributeName="stroke-opacity" values="0.35;0;0" keyTimes="0;0.45;1" dur="5s" begin="1.8s" repeatCount="indefinite"/>
  </circle>
  <g transform="translate(28,25) scale(${icon.scale}) translate(-12,-12)">
    <path fill="${mark}" d="${icon.path}"/>
  </g>
  <text x="49" y="21" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="10" font-weight="850" letter-spacing="1.2" fill="${mute}">${escapeXml(label)}</text>
  <text x="49" y="37" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="${handleSize}" font-weight="800" fill="${ink}">${escapeXml(handle)}</text>
</svg>
`;
}

function connectReadmeBlock(links) {
  if (!links.length) return '';
  const chips = links
    .map((link, i) => {
      const n = i + 1;
      const alt = escapeXml(`${link.label} ${link.handle}`);
      return `  <a href="${escapeXml(link.url)}"><picture><source media="(prefers-color-scheme: light)" srcset="assets/chip-${n}-light.svg" /><img src="assets/chip-${n}.svg" alt="${alt}" height="50" /></picture></a>`;
    })
    .join('\n  &nbsp;&nbsp;\n');
  return `<h2 align="center">🤝 Connect With Me</h2>\n\n<p align="center">\n${chips}\n</p>\n`;
}

const CONNECT_SECTION_RE = /(?:## 🤝 Connect With Me|<h2[^>]*>🤝 Connect With Me<\/h2>)[\s\S]*$/;

/** Rebuild Connect chips from live GitHub social links and patch README. */
async function refreshConnect() {
  const links = await fetchSocialLinks();

  for (let i = 0; i < links.length; i++) {
    const n = i + 1;
    await writeFile(`${OUT_DIR}/chip-${n}.svg`, renderChip(links[i], n, false));
    await writeFile(`${OUT_DIR}/chip-${n}-light.svg`, renderChip(links[i], n, true));
    console.log('updated', `chip-${n}.svg`);
  }

  for (let n = links.length + 1; n <= MAX_CONNECT; n++) {
    for (const suffix of ['', '-light']) {
      try {
        await unlink(`${OUT_DIR}/chip-${n}${suffix}.svg`);
        console.log('removed', `chip-${n}${suffix}.svg`);
      } catch {
        /* absent is fine */
      }
    }
  }

  const readme = await readFile('README.md', 'utf8');
  const hasConnect = CONNECT_SECTION_RE.test(readme);

  if (!links.length) {
    if (!hasConnect) {
      console.log('Connect section already absent (no social links)');
      return;
    }
    await writeFile('README.md', readme.replace(CONNECT_SECTION_RE, '').replace(/\n{3,}$/g, '\n'));
    console.log('removed Connect With Me (no social links)');
    return;
  }

  const block = connectReadmeBlock(links);
  if (hasConnect) {
    await writeFile('README.md', readme.replace(CONNECT_SECTION_RE, block));
  } else {
    const base = readme.replace(/\s*$/, '\n\n');
    await writeFile('README.md', `${base}${block}`);
  }
  console.log('updated README.md connect section', `(${links.length} chip${links.length === 1 ? '' : 's'})`);
}

await mkdir(OUT_DIR, { recursive: true });

if (process.argv.includes('--local-hero')) {
  for (const name of ['hero.svg', 'hero-light.svg']) {
    const path = `${OUT_DIR}/${name}`;
    let svg = await readFile(path, 'utf8');
    svg = CUSTOMIZE.hero(svg);
    if (!svg.includes('.nx-in {')) svg = addMotion(svg, 'hero');
    if (/<path[^>]*class="nx-shine"/.test(svg) || /d="M166 70 C246 44 330 44 410 71"/.test(svg)) {
      throw new Error(`${name}: name-curve shine was not removed`);
    }
    if (!svg.includes('nx-hero-ambient')) throw new Error(`${name}: ambient layer was not applied`);
    await writeFile(path, svg);
    console.log('restyled', name);
  }
  process.exit(0);
}

if (process.argv.includes('--local-heatmap')) {
  for (const name of ['heatmap.svg', 'heatmap-light.svg']) {
    const path = `${OUT_DIR}/${name}`;
    let svg = await readFile(path, 'utf8');
    svg = CUSTOMIZE.heatmap(svg);
    svg = addMotion(svg, 'heatmap');
    if (!svg.includes('Contribution Activity')) throw new Error(`${name}: contribution title was not applied`);
    if (!svg.includes('-rkt"')) throw new Error(`${name}: rocket layer was not applied`);
    await writeFile(path, svg);
    console.log('restyled', name);
  }
  process.exit(0);
}

const failures = [];
let profile = { bio: '', location: '', name: USERNAME };
try {
  profile = await fetchProfile();
  if (profile.location) console.log('profile location:', profile.location);
} catch (error) {
  failures.push(error.message);
  console.error('failed', error.message);
}

try {
  visitorCount = await fetchVisitorCount();
} catch (error) {
  failures.push(error.message);
  console.error('failed', error.message);
}

if (process.argv.includes('--local-stats')) {
  for (const name of ['stats.svg', 'stats-light.svg']) {
    const path = `${OUT_DIR}/${name}`;
    let svg = await readFile(path, 'utf8');
    svg = CUSTOMIZE.stats(svg);
    if (svg.includes('@keyframes nx-')) {
      svg = svg.replace(
        /<text x="(\d+)" y="146" font-family/g,
        '<text class="nx-num" x="$1" y="146" font-family',
      );
      const prefix = svg.match(/<g id="(gs-[^"]+)"/)?.[1];
      if (prefix && !svg.includes('g.aura-chip > rect:first-of-type')) {
        const glow = `      #${prefix} g.aura-chip > rect:first-of-type { animation: nx-glow 4.2s ease-in-out 1.4s infinite; }\n`;
        const frames = svg.includes('@keyframes nx-glow')
          ? ''
          : `      @keyframes nx-glow { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.38); } }\n`;
        svg = svg.replace('  </style>', `${glow}${frames}  </style>`);
      }
    } else {
      svg = addMotion(svg, 'stats');
    }
    if (!svg.includes('>Visitors<')) throw new Error(`${name}: visitors stat was not applied`);
    await writeFile(path, svg);
    console.log('restyled', name);
  }
  try {
    await ensureVisitorPixel();
  } catch (error) {
    console.error('failed', error.message);
  }
  process.exit(0);
}

for (const section of SECTIONS) {
  for (const light of [false, true]) {
    try {
      await refresh(section, light, profile);
    } catch (error) {
      failures.push(error.message);
      console.error('failed', error.message);
    }
  }
}

try {
  await refreshAbout(profile.bio, profile.name);
} catch (error) {
  failures.push(error.message);
  console.error('failed', error.message);
}

try {
  await refreshConnect();
} catch (error) {
  failures.push(error.message);
  console.error('failed', error.message);
}

try {
  await ensureVisitorPixel();
} catch (error) {
  failures.push(error.message);
  console.error('failed', error.message);
}

if (failures.length) process.exit(1);
