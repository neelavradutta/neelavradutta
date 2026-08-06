import { readFileSync, writeFileSync } from 'node:fs';

const chips = [
  ['github', 'https://github.com/neelavradutta'],
  ['instagram', 'https://www.instagram.com/toeiooo.so/'],
  ['leetcode', 'https://leetcode.com/u/neelavra_dutta/'],
  ['twitter', 'https://x.com/Neel_avra1'],
];

const body = chips
  .map(([id, href]) => {
    const svg = readFileSync(`assets/chip-${id}.svg`, 'utf8').replace(/^<\?xml[^>]*>\r?\n?/, '');
    return `  <a href="${href}">${svg}</a>`;
  })
  .join('\n');

const readme = readFileSync('README.md', 'utf8');
const next = readme.replace(
  /## 🤝 Connect With Me[\s\S]*$/,
  `## 🤝 Connect With Me\n\n<p align="center">\n${body}\n</p>\n`,
);
writeFileSync('README.md', next);
console.log('inlined connect chips into README');
