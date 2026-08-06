const fs = require('fs');

for (const file of fs.readdirSync('assets')) {
  if (!file.endsWith('.svg')) continue;
  const path = 'assets/' + file;
  const original = fs.readFileSync(path, 'utf8');
  const cleaned = original
    .replace(/Live GitHub stats styled by GitSkins/g, 'Live GitHub stats')
    .replace(/aria-label="GitSkins gs-([a-z]+)-[^"]*section"/g, (_m, section) => `aria-label="${section} section"`);
  if (cleaned !== original) {
    fs.writeFileSync(path, cleaned);
    console.log('cleaned', file);
  }
}
