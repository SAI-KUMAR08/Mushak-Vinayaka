const fs = require('fs');
const path = require('path');

console.log('Reading files...');
const origHtml = fs.readFileSync('attached_assets/index_(1)_1789845790950.html', 'utf8');
let html = fs.readFileSync('index.html', 'utf8');

// 1. Extract Logo Data URI from origHtml
const logoMatch = origHtml.match(/G\.LOGO_DATA_URI\s*=\s*"(data:image\/png;base64,[^"]+)"/);
if (!logoMatch) {
  console.error('Failed to extract G.LOGO_DATA_URI from original index.html');
  process.exit(1);
}
const logoDataUri = logoMatch[1];
console.log('Extracted logoDataUri, length:', logoDataUri.length);

// 2. Remove the video intro HTML
// Find `<div id="intro">` through `</div>` around line 54-58
const introDivRegex = /<div id="intro">[\s\S]*?<\/div>/;
if (introDivRegex.test(html)) {
  html = html.replace(introDivRegex, '');
  console.log('Removed <div id="intro">');
} else {
  console.log('No <div id="intro"> found');
}

// 3. Remove the intro CSS
const introCssRegex = /\/\* ---- opening film ---- \*\/[\s\S]*?#introFallback\{[^}]*\}/;
if (introCssRegex.test(html)) {
  html = html.replace(introCssRegex, '');
  console.log('Removed intro CSS');
}

// Clean up @media prefers-reduced-motion
html = html.replace('@media (prefers-reduced-motion: reduce){ #intro{transition:none;} }', '');

// 4. Inject G.LOGO_DATA_URI and G.Assets right after "use strict";
const useStrictMarker = '"use strict";';
const assetsCode = `
var G = (typeof G !== 'undefined' && G) ? G : {};
G.LOGO_DATA_URI = "${logoDataUri}";

/* -------------------------------------------------------- image assets */
G.Assets = {
  logo: null, logoReady: false,
  init: function () {
    if (typeof window === 'undefined' || typeof G.LOGO_DATA_URI !== 'string' || !G.LOGO_DATA_URI) return;
    try {
      var img = new window.Image();
      var self = this;
      img.onload = function () { self.logoReady = true; };
      img.src = G.LOGO_DATA_URI;
      this.logo = img;
    } catch (e) { }
  },
  drawLogo: function (ctx, x, y, maxW, maxH) {
    if (!this.logoReady || !this.logo) return false;
    var iw = this.logo.naturalWidth || 1, ih = this.logo.naturalHeight || 1;
    var scale = Math.min(maxW / iw, maxH / ih);
    var w = iw * scale, h = ih * scale;
    ctx.drawImage(this.logo, x - w / 2, y - h / 2, w, h);
    return true;
  }
};
`;

if (!html.includes('G.LOGO_DATA_URI =')) {
  html = html.replace(useStrictMarker, useStrictMarker + '\n' + assetsCode);
  console.log('Injected G.LOGO_DATA_URI and G.Assets');
}

// 5. Update G.Env.pillar to include occlusion detection & transparency
const oldPillarRegex = /pillar:\s*function\s*\(ctx,\s*p,\s*broken\)\s*\{[\s\S]*?ctx\.closePath\(\);\s*ctx\.fill\(\);\s*\}\s*\}/;
const newPillarCode = `pillar: function (ctx, p, broken) {
    var h = broken ? p.h * 0.55 : p.h;
    var g = G.Game;
    var occluding = false;
    if (g && g.player) {
      var pl = g.player;
      if (pl.x >= p.x - 30 && pl.x <= p.x + p.w + 30 &&
          pl.y >= p.y + p.h - h - 40 && pl.y <= p.y + p.h + 8) {
        occluding = true;
      }
    }
    if (!occluding && g && g.companion) {
      var co = g.companion;
      if (co.x >= p.x - 30 && co.x <= p.x + p.w + 30 &&
          co.y >= p.y + p.h - h - 40 && co.y <= p.y + p.h + 8) {
        occluding = true;
      }
    }
    if (!occluding && g && g.level && g.level.pickups) {
      for (var k = 0; k < g.level.pickups.length; k++) {
        var pk = g.level.pickups[k];
        if (!pk.taken && pk.x >= p.x - 22 && pk.x <= p.x + p.w + 22 &&
            pk.y >= p.y + p.h - h - 30 && pk.y <= p.y + p.h + 10) {
          occluding = true;
          break;
        }
      }
    }

    ctx.save();
    if (occluding) {
      ctx.globalAlpha = 0.38;
    }
    this.shadowEllipse(ctx, p.x + p.w / 2, p.y + p.h, p.w * 0.7, 10);
    ctx.fillStyle = P.stoneDp; ctx.fillRect(p.x - 6, p.y + p.h - 14, p.w + 12, 16);
    ctx.fillStyle = P.stone; ctx.fillRect(p.x, p.y + p.h - h, p.w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(p.x + 4, p.y + p.h - h, 6, h);
    ctx.fillStyle = P.stoneDp;
    for (var i = 1; i < 4; i++) ctx.fillRect(p.x, p.y + p.h - h + (h / 4) * i, p.w, 3);
    if (!broken) {
      ctx.fillStyle = P.gold; ctx.fillRect(p.x - 8, p.y + p.h - h - 12, p.w + 16, 12);
      ctx.fillStyle = P.goldDp; ctx.fillRect(p.x - 8, p.y + p.h - h - 3, p.w + 16, 3);
    } else {
      ctx.fillStyle = P.stoneDp;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + p.h - h);
      ctx.lineTo(p.x + p.w * 0.4, p.y + p.h - h - 10);
      ctx.lineTo(p.x + p.w, p.y + p.h - h + 4);
      ctx.lineTo(p.x + p.w, p.y + p.h - h + 12);
      ctx.lineTo(p.x, p.y + p.h - h + 12);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }`;

if (oldPillarRegex.test(html)) {
  html = html.replace(oldPillarRegex, newPillarCode);
  console.log('Updated G.Env.pillar with occlusion transparency');
} else {
  console.error('Could not find old pillar function to replace');
}

// 6. Update G.Art.vinayaka to support horizontal rotation (scaleX and backView)
const oldVinayakaScale = 'ctx.translate(a.x, a.y + bob);\n    ctx.scale(s * f, s);';
const newVinayakaScale = `ctx.translate(a.x, a.y + bob);
    var hScale = (a.scaleX !== undefined ? a.scaleX : s * f);
    ctx.scale(hScale, s);`;
if (html.includes(oldVinayakaScale)) {
  html = html.replace(oldVinayakaScale, newVinayakaScale);
  console.log('Updated G.Art.vinayaka scale');
}

// 7. Update G.Player.prototype.draw to give Mushak a soft golden visibility halo
const oldPlayerDraw = `G.Player.prototype.draw = function (ctx) {
  var a = {
    x: this.x, y: this.y, t: this.t, moving: this.moving,
    faceRight: this.faceRight, flash: this.flashT > 0 && Math.floor(this.flashT * 20) % 2 === 0
  };
  if (this.kind === 'mushak') G.Art.mushak(ctx, a);
  else {
    a.attackArm = this.atkAnim > 0 ? -1.2 * (this.atkAnim / 0.22) : 0;
    a.tuskThrown = this.tuskThrown;
    G.Art.vinayaka(ctx, a);
  }
};`;

const newPlayerDraw = `G.Player.prototype.draw = function (ctx) {
  var a = {
    x: this.x, y: this.y, t: this.t, moving: this.moving,
    faceRight: this.faceRight, flash: this.flashT > 0 && Math.floor(this.flashT * 20) % 2 === 0
  };
  if (this.kind === 'mushak') {
    ctx.save();
    ctx.globalAlpha = 0.24 + Math.sin(this.t * 5) * 0.08;
    ctx.fillStyle = '#FFE9AE';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    G.Art.mushak(ctx, a);
  } else {
    a.attackArm = this.atkAnim > 0 ? -1.2 * (this.atkAnim / 0.22) : 0;
    a.tuskThrown = this.tuskThrown;
    G.Art.vinayaka(ctx, a);
  }
};`;

if (html.includes(oldPlayerDraw)) {
  html = html.replace(oldPlayerDraw, newPlayerDraw);
  console.log('Updated G.Player.prototype.draw with Mushak halo');
}

// 8. Update drawWorld to depth-sort pickups alongside props & actors
const oldDrawPickups = `    // pickups
    for (var k = 0; k < L.pickups.length; k++) {
      if (!L.pickups[k].taken) G.Art.pickup(ctx, L.pickups[k], this.t);
    }

    // depth-sorted scenery and actors
    var draws = [];`;

const newDrawPickups = `    // depth-sorted scenery, actors, and pickups
    var draws = [];
    for (var k = 0; k < L.pickups.length; k++) {
      var pk = L.pickups[k];
      if (!pk.taken) {
        draws.push({ y: pk.y + 6, fn: (function (pkk) { return function () { G.Art.pickup(ctx, pkk, G.Game.t); }; })(pk) });
      }
    }`;

if (html.includes(oldDrawPickups)) {
  html = html.replace(oldDrawPickups, newDrawPickups);
  console.log('Updated drawWorld to depth-sort pickups');
}

// 9. Update buildMenus: Start journey action -> onStartJourney
const oldStartAction = "{ label: 'Start the journey', action: function () { g.startNewGame(); } }";
const newStartAction = "{ label: 'Start the journey', action: function () { g.onStartJourney(); } }";
if (html.includes(oldStartAction)) {
  html = html.replace(oldStartAction, newStartAction);
  console.log('Updated Start the journey action to g.onStartJourney()');
}

// 10. In G.Game, add onStartJourney, drawRules, updateRules, startDivineIntro, drawDivineIntro, finishDivineIntro
const runControlMarker = '/* ------------------------------------------------------- run control */';
const newFlowMethods = `
  onStartJourney: function () {
    try {
      var el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(function () { });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
      else if (el.msRequestFullscreen) el.msRequestFullscreen();
    } catch (e) { }
    this.state = 'rules';
  },

  startDivineIntro: function () {
    this.animT = 0;
    this.state = 'divine_intro';
    G.Audio.init();
    G.Audio.resume();
    G.Audio.music('divine');
    G.Audio.sfx('bell');
  },

  finishDivineIntro: function () {
    this.score = this.newScore();
    this.chapterIndex = 0;
    this.retries = 0;
    this.tutorialSeen = {};
    this.lastHintChar = null;
    this.loadChapter(0);
    this.score.startT = this.t;
    this.state = 'play';
    G.Save.data.tutorialSeen = true;
    G.Save.save();
  },

  /* ----------------------------------------------------- tips / rules screen */
  drawRules: function (ctx) {
    ctx.fillStyle = '#07040E';
    ctx.fillRect(0, 0, G.W, G.H);

    // Subtle dark ambient vignette
    var grd = ctx.createRadialGradient(G.W / 2, G.H / 2, G.H * 0.25, G.W / 2, G.H / 2, G.H * 0.75);
    grd.addColorStop(0, 'rgba(40,20,60,0.3)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, G.W, G.H);

    // Header Title
    G.UI.text(ctx, 'How to Play & Sacred Guidelines', G.W / 2, 46, G.Font.display(24), '#FFD97A', 'center');
    G.UI.text(ctx, 'The path from the temple courtyard to Gajamukhasura', G.W / 2, 68, G.Font.body(13, 500), 'rgba(255,247,230,0.65)', 'center');

    // Two compact clean columns
    var col1X = 130, col2X = G.W / 2 + 50;

    // Column 1: Mushak (Scout & Explorer)
    G.UI.text(ctx, 'MUSHAK', col1X, 102, G.Font.display(16), '#F2A81D');
    var mRules = [
      ['W A S D / Arrows', 'Move around pathways and colonnades'],
      ['SPACE', 'Dash quickly through narrow cracks and dangers'],
      ['E / Interact', 'Gather offerings and speak with Parvati']
    ];
    for (var i = 0; i < mRules.length; i++) {
      var ry = 126 + i * 36;
      G.UI.keycap(ctx, col1X + 50, ry, mRules[i][0]);
      G.UI.text(ctx, mRules[i][1], col1X + 124, ry + 5, G.Font.body(13, 500), '#F6EBD8');
    }

    // Column 2: Vinayaka (Guardian & Warrior)
    G.UI.text(ctx, 'VINAYAKA', col2X, 102, G.Font.display(16), '#F2A81D');
    var vRules = [
      ['J', 'Strike asuras when they leave an opening'],
      ['K', 'Divine light wave (spends energy to repel foes)'],
      ['L', 'Mushak Assist (stuns asuras through heavy guard)'],
      ['SPACE', 'Dodge attacks with brief invulnerability']
    ];
    for (var j = 0; j < vRules.length; j++) {
      var vy = 126 + j * 36;
      G.UI.keycap(ctx, col2X + 25, vy, vRules[j][0]);
      G.UI.text(ctx, vRules[j][1], col2X + 75, vy + 5, G.Font.body(13, 500), '#F6EBD8');
    }

    // Guidance Notes (compact, centered)
    var noteY = 282;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    G.UI.roundRect(ctx, G.W / 2 - 270, noteY - 14, 540, 72, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(242,168,29,0.25)'; ctx.lineWidth = 1;
    G.UI.roundRect(ctx, G.W / 2 - 270, noteY - 14, 540, 72, 8);
    ctx.stroke();

    G.UI.text(ctx, '\\u2022 Gather modaks, durva grass, and temple flowers to increase your punya score.',
      G.W / 2, noteY + 8, G.Font.body(13, 500), 'rgba(255,247,230,0.85)', 'center');
    G.UI.text(ctx, '\\u2022 Role switching between Mushak and Vinayaka occurs naturally with the story.',
      G.W / 2, noteY + 28, G.Font.body(13, 500), 'rgba(255,247,230,0.85)', 'center');
    G.UI.text(ctx, '\\u2022 Watch for red enemy attack indicators on the ground before moving in.',
      G.W / 2, noteY + 48, G.Font.body(13, 500), 'rgba(255,247,230,0.85)', 'center');

    // Continue Button
    var bw = 180, bh = 42, bx = G.W / 2 - bw / 2, by = 380;
    var hovered = (G.Input.pointer.x >= bx && G.Input.pointer.x <= bx + bw &&
                   G.Input.pointer.y >= by && G.Input.pointer.y <= by + bh);
    ctx.fillStyle = hovered ? '#FFD97A' : P.gold;
    G.UI.roundRect(ctx, bx, by, bw, bh, 10); ctx.fill();
    ctx.strokeStyle = '#FFF7E6'; ctx.lineWidth = 2;
    G.UI.roundRect(ctx, bx, by, bw, bh, 10); ctx.stroke();
    G.UI.text(ctx, 'Continue', G.W / 2, by + 26, G.Font.body(17, 700), '#2B1A08', 'center');

    // Small, subtle logo in bottom-right corner
    if (G.Assets && G.Assets.drawLogo) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      G.Assets.drawLogo(ctx, G.W - 54, G.H - 54, 60, 60);
      ctx.restore();
    }
  },

  updateRules: function () {
    var bw = 180, bh = 42, bx = G.W / 2 - bw / 2, by = 380;
    var I = G.Input;
    if (I.press('dodge') || I.press('interact') || I.press('pause') ||
        (I.pointer.justDown && I.pointer.x >= bx && I.pointer.x <= bx + bw &&
         I.pointer.y >= by && I.pointer.y <= by + bh)) {
      G.Audio.sfx('ui');
      this.startDivineIntro();
    }
  },

  /* ------------------------------------------- divine opening animation (8-15s) */
  drawDivineIntro: function (ctx) {
    var t = this.animT; // 0 to 11.0s
    ctx.fillStyle = '#080512';
    ctx.fillRect(0, 0, G.W, G.H);

    // Sacred background atmosphere: subtle temple floor and warm divine ambience
    var grd = ctx.createRadialGradient(G.W / 2, G.H / 2 + 20, 20, G.W / 2, G.H / 2 + 20, G.H * 0.75);
    grd.addColorStop(0, 'rgba(85,45,20,0.38)');
    grd.addColorStop(1, 'rgba(6,3,14,0.96)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, G.W, G.H);

    // Floor ground shadow
    var groundY = 320;
    G.Env.shadowEllipse(ctx, G.W / 2, groundY + 28, 48, 14, 0.35);

    var floatY = 0;
    var scaleX = 1;
    var glowIntensity = 0;
    var neckGlow = 0;

    if (t < 2.0) {
      neckGlow = t / 2.0;
      glowIntensity = 0.2 * neckGlow;
    } else if (t < 4.5) {
      var p = (t - 2.0) / 2.5;
      neckGlow = 1.0;
      glowIntensity = 0.2 + 0.5 * p;
      floatY = -38 * (0.5 - 0.5 * Math.cos(p * Math.PI));
    } else if (t < 9.0) {
      neckGlow = 1.0;
      glowIntensity = 0.7 + 0.15 * Math.sin((t - 4.5) * 4);
      floatY = -38;
      var rotProg = (t - 4.5) / 4.5;
      var rotAngle = rotProg * Math.PI * 2;
      scaleX = Math.cos(rotAngle);
    } else if (t < 10.5) {
      var d = (t - 9.0) / 1.5;
      scaleX = 1;
      floatY = -38 * (1 - (0.5 - 0.5 * Math.cos(d * Math.PI)));
      glowIntensity = 0.7 * (1 - d * 0.6);
      neckGlow = 1.0 - d * 0.5;
    } else {
      scaleX = 1;
      floatY = 0;
      glowIntensity = 0.25;
      neckGlow = 0.3;
    }

    // Divine rays expanding from behind
    if (glowIntensity > 0.15) {
      ctx.save();
      ctx.translate(G.W / 2, groundY + floatY - 20);
      ctx.rotate(t * 0.12);
      for (var r = 0; r < 12; r++) {
        ctx.rotate(Math.PI / 6);
        ctx.globalAlpha = glowIntensity * 0.12;
        ctx.fillStyle = '#FFE9AE';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(24, 280);
        ctx.lineTo(-24, 280);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Soft divine glow around neck and head region (step 2 & 3)
    if (neckGlow > 0) {
      ctx.save();
      var rad = 25 + neckGlow * 38;
      var nGrd = ctx.createRadialGradient(G.W / 2, groundY + floatY - 34, 5, G.W / 2, groundY + floatY - 34, rad);
      nGrd.addColorStop(0, 'rgba(255,233,174,' + (neckGlow * 0.85) + ')');
      nGrd.addColorStop(0.5, 'rgba(242,168,29,' + (neckGlow * 0.45) + ')');
      nGrd.addColorStop(1, 'rgba(242,168,29,0)');
      ctx.fillStyle = nGrd;
      ctx.beginPath();
      ctx.arc(G.W / 2, groundY + floatY - 34, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Golden divine particles
    if (glowIntensity > 0.2) {
      ctx.save();
      for (var pt = 0; pt < 18; pt++) {
        var pAngle = pt * 1.35 + t * 1.8;
        var pDist = 25 + ((pt * 27 + t * 45) % 95);
        var px = G.W / 2 + Math.cos(pAngle) * pDist * 1.1;
        var py = groundY + floatY - 20 + Math.sin(pAngle) * pDist * 0.7 - ((t * 15 + pt * 5) % 40);
        ctx.globalAlpha = Math.min(1, glowIntensity * (1 - (pDist / 120)));
        ctx.fillStyle = pt % 2 === 0 ? '#FFE9AE' : '#FFD97A';
        ctx.beginPath();
        ctx.arc(px, py, 2.5 + (pt % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Draw Vinayaka with horizontal rotation around vertical axis (step 5)
    ctx.save();
    var curScaleX = Math.abs(scaleX) < 0.08 ? (scaleX < 0 ? -0.08 : 0.08) : scaleX;
    G.Art.vinayaka(ctx, {
      x: G.W / 2,
      y: groundY + floatY,
      t: t,
      faceRight: true,
      scale: 1.55,
      scaleX: curScaleX * 1.55
    });
    ctx.restore();

    // Subtle skip label
    G.UI.text(ctx, 'Space / Tap to skip', G.W - 30, G.H - 20, G.Font.body(12, 500), 'rgba(255,247,230,0.4)', 'right');
  },

  updateDivineIntro: function (dt) {
    this.animT += dt;
    var I = G.Input;
    if (this.animT >= 11.0 || I.press('dodge') || I.press('interact') || (I.pointer.justDown && I.pointer.y > G.H - 60)) {
      this.finishDivineIntro();
    }
  },
`;

if (!html.includes('onStartJourney:')) {
  html = html.replace(runControlMarker, runControlMarker + '\n' + newFlowMethods);
  console.log('Added onStartJourney, drawRules, updateRules, divineIntro methods');
}

// 11. Update G.Game.update to call updateRules and updateDivineIntro
const oldGameUpdate = `    if (this.state === 'play') {
      this.updatePlay(dt);
    } else if (this.state === 'menu') {
      this.menuMain.update(this.menuLayout(this.menuMain, 330));
    } else if (this.state === 'howto') {
      if (G.Input.press('interact') || G.Input.press('pause') || G.Input.pointer.justDown) {
        this.state = this.prevState === 'pause' ? 'pause' : 'menu';
        this.prevState = null;
      }
    }`;

const newGameUpdate = `    if (this.state === 'play') {
      this.updatePlay(dt);
    } else if (this.state === 'menu') {
      this.menuMain.update(this.menuLayout(this.menuMain, 330));
    } else if (this.state === 'rules') {
      this.updateRules();
    } else if (this.state === 'divine_intro') {
      this.updateDivineIntro(dt);
    } else if (this.state === 'howto') {
      if (G.Input.press('interact') || G.Input.press('pause') || G.Input.pointer.justDown) {
        this.state = this.prevState === 'pause' ? 'pause' : 'menu';
        this.prevState = null;
      }
    }`;

if (html.includes(oldGameUpdate)) {
  html = html.replace(oldGameUpdate, newGameUpdate);
  console.log('Updated G.Game.update states');
}

// 12. Update G.Game.draw to render rules and divine_intro
const oldGameDraw = `    if (this.state === 'play' || this.state === 'pause' || this.state === 'defeat') {
      this.drawWorld(ctx);
    } else if (this.state === 'menu') {
      this.drawMenu(ctx);
    } else if (this.state === 'howto') {
      this.drawHowTo(ctx);`;

const newGameDraw = `    if (this.state === 'play' || this.state === 'pause' || this.state === 'defeat') {
      this.drawWorld(ctx);
    } else if (this.state === 'menu') {
      this.drawMenu(ctx);
    } else if (this.state === 'rules') {
      this.drawRules(ctx);
    } else if (this.state === 'divine_intro') {
      this.drawDivineIntro(ctx);
    } else if (this.state === 'howto') {
      this.drawHowTo(ctx);`;

if (html.includes(oldGameDraw)) {
  html = html.replace(oldGameDraw, newGameDraw);
  console.log('Updated G.Game.draw states');
}

// 13. Ensure G.Boot initializes G.Assets and starts directly on menu
const oldBootStart = `    G.Game.init(canvas, ctx, this.view);
    this.setupIntro();`;

const newBootStart = `    G.Assets.init();
    G.Game.init(canvas, ctx, this.view);
    this.setupIntro();`;

if (html.includes(oldBootStart)) {
  html = html.replace(oldBootStart, newBootStart);
  console.log('Updated G.Boot.start with G.Assets.init()');
}

// 14. Update G.Boot.setupIntro to ensure introDone = true and wrap hidden
const oldSetupIntro = `  setupIntro: function () {
    var wrap = document.getElementById('intro');
    var video = document.getElementById('introVideo');
    var skip = document.getElementById('skipIntro');
    var fallback = document.getElementById('introFallback');
    var self = this;
    this.introDone = false;
    if (!wrap) { this.introDone = true; return; }`;

const newSetupIntro = `  setupIntro: function () {
    this.introDone = true;
    var wrap = document.getElementById('intro');
    if (wrap) wrap.style.display = 'none';
    G.Game.state = 'menu';
    return;`;

if (html.includes(oldSetupIntro)) {
  html = html.replace(oldSetupIntro, newSetupIntro);
  console.log('Updated G.Boot.setupIntro');
}

// Write the updated file
fs.writeFileSync('index.html', html);
console.log('Successfully updated index.html, new size:', html.length);

// Also sync to artifacts/mushak-vinayaka/public/game.html
if (fs.existsSync('artifacts/mushak-vinayaka/public/game.html')) {
  fs.writeFileSync('artifacts/mushak-vinayaka/public/game.html', html);
  console.log('Synced to artifacts/mushak-vinayaka/public/game.html');
}
