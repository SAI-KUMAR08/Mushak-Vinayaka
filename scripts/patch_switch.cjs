const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

const target = `    switch (this.state) {
      case 'menu':
      case 'howto':
      case 'settings':
      case 'defeat':
      case 'score':
        this.updateScreens();
        break;`;

const replacement = `    switch (this.state) {
      case 'menu':
      case 'howto':
      case 'settings':
      case 'defeat':
      case 'score':
        this.updateScreens();
        break;
      case 'rules':
        this.updateRules();
        break;
      case 'divine_intro':
        this.updateDivineIntro(dt);
        break;`;

if (html.includes(target)) {
  html = html.replace(target, replacement);
  fs.writeFileSync('index.html', html);
  fs.writeFileSync('artifacts/mushak-vinayaka/public/game.html', html);
  console.log('Successfully added rules and divine_intro to switch(this.state)');
} else {
  console.log('Target not found, checking existing content...');
}
