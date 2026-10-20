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
    return `${m.phase} t=${Math.round(m.timeLeft)} ` + m.f.map((f, i) => `P${i + 1}:${s(f)}`).join(" ");
  };
  w.start = (opts = {}) => {
    game.ui.hide();
    const second = opts.mode === 'versus' ? 'p2' : (opts.mode === 'training' ? 'dummy' : 'cpu');
    const slots = opts.slots || [
      { char: opts.p1 || 'papakha', weapon: opts.w1 || 'fists', ctrl: 'p1' },
      { char: opts.p2 || 'delegate', weapon: opts.w2 || 'fists', ctrl: second },
    ];
    game.startMatch({ mode: 'ai', arena: 'neon', difficulty: 'normal', ...opts, slots });
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
window.sheet = (id = 'papakha', which = 'moves', weapon = 'fists') => {
  const cfg = CHARACTERS[id];
  const f = new Fighter(cfg, 0, weapon);
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
      f.move = f.moves[cell.mv]; f.moveId = cell.mv; f.moveTick = f.move.startup + 1;
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

// ---- in-memory multi-peer lockstep test (no network): window.netTest({ humans, size, ticks })
import { Session } from './net/Session.js';
import { Match } from './game/Match.js';
import { clearInput } from './systems/Input.js';
const ACT = ['left', 'right', 'up', 'down', 'light', 'heavy', 'special', 'block', 'ult'];
function rngf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
window.netTest = (o = {}) => {
  const size = o.size || 4, nh = o.humans || size, maxT = o.maxT || 40000, maxDelay = o.maxDelay ?? 6;
  const hudStub = new Proxy({}, { get: () => () => {} });
  const mkGame = (seed) => {
    const r = rngf(seed), prev = {}, held = {};
    return { hud: hudStub, ui: {}, onMatchEnd() {}, input: { solo: true, flush() {}, poll(p, out) {
      clearInput(out);
      for (const a of ACT) { if (r() < 0.07) held[a] = !held[a]; if (a === 'left' && held.right) held.right = false; }
      for (const a of ACT) { const h = !!held[a]; out[a] = h; const cap = 'p' + a[0].toUpperCase() + a.slice(1); out[cap] = (h && !prev[a]) || (r() < 0.01); prev[a] = h; }
      return out;
    } } };
  };
  const dr = rngf(5), queue = []; let now = 0;
  const delay = () => Math.floor(dr() * (maxDelay + 1));
  const sess = Array.from({ length: nh }, () => new Session());
  const H = sess[0]; H.isHost = true; H.size = size; H.role = 0; H.open = true;
  for (let s = 1; s < nh; s++) {
    const g = sess[s]; g.isHost = false; g.role = s; g.open = true; g.size = size;
    const entry = { slot: s, info: {}, open: true, ping: 0 };
    entry.conn = { send: (m) => queue.push({ at: now + delay(), fn: () => g.onData(JSON.parse(JSON.stringify(m)), null) }) };
    g.conn = { send: (m) => queue.push({ at: now + delay(), fn: () => H.onData(JSON.parse(JSON.stringify(m)), entry) }) };
    H.conns.push(entry);
  }
  H.humans = [...Array(nh).keys()]; H.bots = [...Array(size).keys()].filter((i) => i >= nh);
  sess.forEach((s) => s.resetLock(1, size));
  const chars = ['vakil', 'zaur', 'emin', 'fatima'], weps = ['katana', 'hammer', 'spear', 'bat'];
  const slots = Array.from({ length: size }, (_, i) => ({ char: chars[i], weapon: weps[i], ctrl: i < nh ? 'net' : 'cpu' }));
  const opts = { mode: 'online', slots, arena: 'neon', roundTime: 60, roundsToWin: 2, difficulty: 'hard' };
  const ms = sess.map((s, i) => new Match(mkGame(10 + i), { ...opts, net: s }));
  const hist = ms.map(() => ({})); const ticks = ms.map(() => 0);
  const speed = [1, 0.8, 0.6, 0.9];
  let T = 0, first = null;
  for (; T < maxT && !ms.every((m) => m.over); T++) {
    now = T;
    for (let i = queue.length - 1; i >= 0; i--) if (queue[i].at <= T) queue.splice(i, 1)[0].fn();
    ms.forEach((m, i) => {
      if (Math.random() < speed[i % 4] && !m.over && m.tick() !== false) {
        ticks[i]++;
        hist[i][m.gtick] = { h: m.stateHash(), st: m.f.map((f) => [Math.round(f.x * 100), f.y, f.hp, f.state, f.stateTick, f.moveId, f.moveTick].join(',')) };
        if (i > 0 && !first) { const a = hist[0][m.gtick]; if (a && a.h !== hist[i][m.gtick].h) first = { tick: m.gtick, who: i, host: a.st, guest: hist[i][m.gtick].st, phase: m.phase }; }
      }
    });
  }
  return { T, ticks, first, desync: sess.map((s) => s.desync), over: ms.map((m) => m.over), wins: ms.map((m) => m.wins.join('-')) };
};
