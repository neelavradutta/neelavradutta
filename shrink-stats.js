const fs = require('fs');

for (const file of ['assets/stats.svg', 'assets/stats-light.svg']) {
  let s = fs.readFileSync(file, 'utf8');

  s = s.replace(/(<text x="\d+" y="126"[^>]*?)font-size="12"/g, '$1font-size="11"');
  s = s.replace(/(<text x="\d+" y=")166("[^>]*?)font-size="35"/g, '$1162$2font-size="28"');

  fs.writeFileSync(file, s);
  console.log('shrunk', file);
}
