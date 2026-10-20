// Development-only helpers (loaded only by `npm run dev`). Handy for scripted testing from the console.
export function installDebug(game) {
  const w = window;
  w.G = game;
  w.K = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
  w.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  w.step = (n) => { for (let i = 0; i < n; i++) game.match.tick(); };
  w.snap = () => {
    const m = game.match;
    const s = (f) => [Math.round(f.x), f.state, f.moveId, f.hp, Math.round(f.meter)].join('/');
    return `${m.phase} t=${Math.round(m.timeLeft)} P1:${s(m.f[0])} P2:${s(m.f[1])}`;
  };
  w.start = (opts = {}) => {
    game.ui.hide();
    game.startMatch({ mode: 'ai', p1: 'papakha', p2: 'delegate', arena: 'neon', difficulty: 'normal', ...opts });
    w.M = game.match;
    w.step(110);
    return w.snap();
  };
  w.crop = (x, y, wd, h, s = 3) => {
    const c = document.getElementById('game'); const k = c.width / 1280;
    let o = document.getElementById('dbg'); if (o) o.remove();
    o = document.createElement('canvas'); o.id = 'dbg'; o.width = wd * s; o.height = h * s;
    o.style.cssText = 'position:fixed;left:0;top:0;z-index:99;background:#000;width:' + wd * s + 'px';
    o.getContext('2d').drawImage(c, x * k, y * k, wd * k, h * k, 0, 0, wd * s, h * s);
    document.body.appendChild(o);
  };
  w.uncrop = () => { const o = document.getElementById('dbg'); if (o) o.remove(); };
}

import { Fighter } from './entities/Fighter.js';
import { CHARACTERS } from './entities/characters.js';
import { createPose, computePose, drawFighter, drawShadow } from './entities/FighterRenderer.js';
import { getSprite } from './game/Sprites.js';
import { GROUND } from './game/config.js';

/** Draw a contact sheet of poses for one character into an overlay canvas. */
window.sheet = (id = 'papakha', which = 'moves') => {
  const cfg = CHARACTERS[id];
  const f = new Fighter(cfg, 0);
  const pose = createPose();
  const sprite = getSprite(id, false);
  let o = document.getElementById('sheet'); if (o) o.remove();
  o = document.createElement('canvas'); o.id = 'sheet'; o.width = 1600; o.height = 760;
  o.style.cssText = 'position:fixed;left:0;top:0;z-index:99;width:1280px;height:608px;background:#2a2440';
  const c = o.getContext('2d');
  const cells = which === 'moves'
    ? Object.keys(cfg.moves).map((k) => ({ label: k, st: 'attack', mv: k }))
    : ['idle', 'walk', 'run', 'crouch', 'jump', 'block', 'cblock', 'hit', 'airhit', 'down', 'getup', 'win', 'throw', 'dashback'].map((k) => ({ label: k, st: k }));
  cells.forEach((cell, i) => {
    const col = i % 8, row = Math.floor(i / 8);
    c.save();
    c.translate(100 + col * 190, 340 + row * 380 - GROUND);
    c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(-90, GROUND - 300, 180, 330);
    f.reset(0, 1); f.x = 0; f.y = GROUND; f.t = 40; f.walkPhase = 1.0; f.vy = -4;
    f.state = cell.st === 'cblock' ? 'block' : cell.st; f.crouchBlock = cell.st === 'cblock'; f.stateTick = 8; f.hitstun = 10; f.flash = cell.st === 'hit' ? 3 : 0;
    if (cell.st === 'attack') {
      f.move = cfg.moves[cell.mv]; f.moveId = cell.mv; f.moveTick = f.move.startup + 1;
      if (f.move.air) f.y = GROUND - 90;
    }
    if (cell.st === 'jump' || cell.st === 'airhit') f.y = GROUND - 90;
    drawShadow(c, f);
    computePose(f, pose);
    drawFighter(c, f, sprite, pose, 1, cfg.color);
    if (f.move && f.move.hitbox) {
      const r = f.hitRect({}); c.strokeStyle = '#f33'; c.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    }
    const h = {}; f.hurtRect(h); c.strokeStyle = '#3f3'; c.strokeRect(h.x0, h.y0, h.x1 - h.x0, h.y1 - h.y0);
    c.restore();
    c.fillStyle = '#fff'; c.font = '16px sans-serif'; c.fillText(cell.label, 30 + col * 190, 350 + row * 380);
  });
  document.body.appendChild(o);
};
window.unsheet = () => { const o = document.getElementById('sheet'); if (o) o.remove(); };
