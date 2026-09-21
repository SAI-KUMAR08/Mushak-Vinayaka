const fs = require('fs');

const files = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [
  'index.html',
  'artifacts/mushak-vinayaka/public/game.html'
];

let allOk = true;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    allOk = false;
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const scriptStart = html.indexOf('<script>');
  const scriptEnd = html.lastIndexOf('</script>');
  if (scriptStart === -1 || scriptEnd === -1) {
    console.error(`No <script> block found in ${file}`);
    allOk = false;
    continue;
  }
  const js = html.slice(scriptStart + 8, scriptEnd);
  try {
    new Function(js);
    console.log(`[PASS] ${file}: JavaScript syntax OK! (${js.split('\n').length} lines)`);
  } catch(e) {
    allOk = false;
    console.error(`[FAIL] ${file}: Syntax Error:`, e.message);
    const lines = js.split('\n');
    const match = e.message.match(/line (\d+)/i);
    if (match) {
      const lineNum = parseInt(match[1]);
      console.log('Near line', lineNum, ':');
      for (let i = Math.max(0, lineNum - 4); i < Math.min(lines.length, lineNum + 4); i++) {
        console.log(`  ${i+1}: ${lines[i]}`);
      }
    }
  }
}

if (!allOk) {
  process.exit(1);
}

