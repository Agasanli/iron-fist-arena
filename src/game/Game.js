import { VIEW_W, VIEW_H, TICK } from './config.js';
import { settings } from './settings.js';
import { Input } from '../systems/Input.js';
import { Hud } from '../ui/Hud.js';
import { UI } from '../ui/Screens.js';
import { TouchControls } from '../ui/Touch.js';
import { Match } from './Match.js';
import { Backdrop } from './Backdrop.js';
import { loadSprites } from './Sprites.js';
import { audio } from '../audio/AudioEngine.js';
import { Session, describeNetError } from '../net/Session.js';
import { CHARACTERS, CHARACTER_IDS } from '../entities/characters.js';
import { resolveWeapon } from './matchSetup.js';

/**
 * Top-level application object. Owns the single requestAnimationFrame loop, the canvas,
 * and switches between the menu backdrop and an active Match.
 */
export class Game {
  constructor() {
    const $ = (s) => document.querySelector(s);
    this.stage = $('#stage');
    this.canvas = $('#game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.input = new Input();
    this.hud = new Hud($('#hud'));
    this.touch = new TouchControls($('#touch'), this.input);
    this.match = null;
    this.session = null;
    this.lastOpts = null;
    this.acc = 0; this.last = 0; this.raf = 0; this.running = false; this.errors = 0;
    this.k = 1;
    this._resize = () => this.layout();
    this._vis = () => this.onVisibility();
    this._key = (e) => this.onKey(e);
    this._gesture = () => audio.unlock();
  }

  async start() {
    await loadSprites();
    for (const k of ['p1Char', 'p2Char']) {
      if (!CHARACTERS[settings[k]]) settings[k] = k === 'p1Char' ? 'delegate' : 'zaur';
    }
    this.backdrop = new Backdrop();
    this.ui = new UI(this, document.querySelector('#ui'));
    this.input.attach();
    window.addEventListener('resize', this._resize);
    document.addEventListener('fullscreenchange', this._resize);
    document.addEventListener('visibilitychange', this._vis);
    window.addEventListener('keydown', this._key);
    window.addEventListener('pointerdown', this._gesture);
    window.addEventListener('keydown', this._gesture);
    window.addEventListener('blur', () => { if (this.match && !this.match.net && !this.match.paused && !this.match.over) this.pause(); });
    this.layout();
    audio.playMusic('menu');
    this.ui.show('main', {}, false);
    const room = new URLSearchParams(location.search).get('room');      // invite link: ?room=ABCDE
    if (room) this.ui.show('online', { room: room.toUpperCase().slice(0, 8) });
    document.body.classList.add('ready');
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /** Clean up everything (used on hot reload / teardown) */
  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this._resize);
    document.removeEventListener('fullscreenchange', this._resize);
    document.removeEventListener('visibilitychange', this._vis);
    window.removeEventListener('keydown', this._key);
    window.removeEventListener('pointerdown', this._gesture);
    window.removeEventListener('keydown', this._gesture);
    this.input.detach();
    if (this.ui) this.ui.destroy();
    if (this.match) this.match.destroy();
    this.closeSession();
    audio.stopMusic();
  }

  // ------------------------------------------------------------ layout
  layout() {
    const w = window.innerWidth, h = window.innerHeight;
    const s = Math.min(w / VIEW_W, h / VIEW_H);
    this.stage.style.transform = `translate(-50%,-50%) scale(${s})`;
    const k = Math.min(2, Math.max(0.5, s * (window.devicePixelRatio || 1)));
    this.k = k;
    const cw = Math.round(VIEW_W * k), ch = Math.round(VIEW_H * k);
    if (this.canvas.width !== cw) { this.canvas.width = cw; this.canvas.height = ch; }
    this.updateTouch();
  }

  updateTouch() {
    const t = settings.touchControls;
    const coarse = matchMedia('(pointer:coarse)').matches;
    const show = !!this.match && !this.match.paused && (t === 'on' || (t === 'auto' && coarse));
    this.touch.setVisible(show);
  }

  toggleFullscreen() {
    try {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen();
      else document.exitFullscreen();
    } catch (e) { console.warn('Fullscreen unavailable', e); }
  }

  // ------------------------------------------------------------ match control
  startMatch(opts) {
    if (this.match) this.match.destroy();
    this.lastOpts = opts;
    const humans = opts.slots.filter((s) => s.ctrl === 'p1' || s.ctrl === 'p2').length;
    this.input.solo = !!opts.net || humans <= 1;            // one human: arrows / numpad also drive player 1
    audio.unlock();
    this.hud.hide();
    this.match = new Match(this, opts);
    this.acc = 0;
    this.input.gameActive = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    this.updateTouch();
  }

  rematch() {
    if (this.session && this.match && this.match.net) { this.rematchOnline(); return; }   // online: everybody must agree
    if (!this.lastOpts) return;
    this.ui.hide();
    this.startMatch(this.lastOpts);
  }


  // ------------------------------------------------------------ online play
  newSession() {
    this.closeSession();
    const s = new Session();
    this.session = s;
    s.on('roster', () => this.onRoster());
    s.on('msg', (m, entry) => this.onNetMsg(m, entry));
    s.on('close', () => this.onNetClosed());
    s.on('desync', (k) => console.warn('Online desync detected at tick', k));
    return s;
  }

  closeSession() {
    if (this.session) { this.session.close(); this.session = null; }
  }

  /** Host: somebody joined or left. A 1v1 room starts as soon as both players are in. */
  onRoster() {
    const s = this.session;
    if (!s || !s.isHost) return;
    if (s.size === 2 && !s.started && s.roster().length >= 2) { this.hostStart(); return; }
    this.ui.refreshLobby();
  }

  onNetMsg(m, entry) {
    const s = this.session;
    if (!s) return;
    switch (m.t) {
      case 'roster':                                              // guest: the room list changed
        s.guestRoster = m; s.role = m.you; s.size = m.size;
        this.ui.refreshLobby();
        break;
      case 'start':                                               // guest: the host started the match
        s.role = m.you;
        this.startOnline(m);
        break;
      case 'full': this.closeSession(); this.ui.replace('online', { msg: 'This room is full.' }); break;
      case 'desync': s.desync = true; break;
      case 'bye': this.onNetClosed(); break;
      case 'rematch':                                             // host: a guest wants a rematch
        if (s.isHost) { s.rematch.add(m.slot); this.checkRematch(); }
        break;
      default:
    }
  }

  /** Host: build the slot list (CPU fighters fill empty places) and start. `reuse` = rematch with the same setup. */
  hostStart(reuse = false) {
    const s = this.session;
    if (!s || !s.isHost) return;
    const players = s.roster();
    if (!reuse || !s.cfg) {
      const N = s.size, slots = new Array(N).fill(null);
      const usedChars = new Set(players.map((p) => p.char));
      players.forEach((p) => { slots[p.slot] = { char: p.char, weapon: p.weapon || 'fists', ctrl: 'net' }; });
      for (let i = 0; i < N; i++) {
        if (slots[i]) continue;
        const char = CHARACTER_IDS.find((c) => !usedChars.has(c)) || CHARACTER_IDS[i % CHARACTER_IDS.length];
        usedChars.add(char);
        slots[i] = { char, weapon: resolveWeapon('random'), ctrl: 'cpu' };
      }
      s.cfg = { slots, arena: settings.arena, roundTime: settings.roundTime, wins: settings.roundsToWin, difficulty: settings.difficulty };
    }
    s.humans = players.map((p) => p.slot);
    s.bots = s.cfg.slots.map((x, i) => (x.ctrl === 'cpu' ? i : -1)).filter((i) => i >= 0);
    s.rematch.clear();
    s.started = true;
    const e = s.epoch + 1;
    for (const c of s.conns) s.sendTo(c.conn, { t: 'start', e, you: c.slot, ...s.cfg });
    this.startOnline({ e, you: s.role, ...s.cfg });
  }

  /** Called by the rematch button. Everybody must agree; the host then restarts with the same setup. */
  rematchOnline() {
    const s = this.session;
    if (!s) return;
    if (s.isHost) { s.rematch.add(s.role); this.checkRematch(); }
    else s.send({ t: 'rematch', slot: s.role });
  }

  checkRematch() {
    const s = this.session;
    if (s && s.isHost && s.humans.every((sl) => s.rematch.has(sl))) this.hostStart(true);
  }

  startOnline(cfg) {
    const s = this.session;
    s.started = true;
    s.resetLock(cfg.e, cfg.slots.length);
    this.ui.hide();
    this.startMatch({
      mode: 'online', net: s, slots: cfg.slots, arena: cfg.arena,
      roundTime: cfg.roundTime, roundsToWin: cfg.wins, difficulty: cfg.difficulty || 'normal',
    });
  }

  onNetClosed() {
    if (this.match && this.match.net) {
      if (this.match.netDead) return;
      this.match.netDead = true;
      this.input.gameActive = false;
      this.touch.setVisible(false);
      this.ui.show('netlost', {}, false);
    } else if (this.ui.current && (this.ui.current.name === 'online' || this.ui.current.name === 'lobby')) {
      this.closeSession();
      this.ui.replace('online', { msg: 'The connection was closed.' });
    }
  }

  netErrorText(e) { return describeNetError(e); }

  quitToMenu(showMain = true) {
    if (this.match) { this.match.destroy(); this.match = null; }
    this.hud.show(false);
    this.closeSession();
    this.input.gameActive = false;
    this.input.solo = false;
    this.touch.setVisible(false);
    this.ui.clearStack();
    audio.playMusic('menu');
    if (showMain) this.ui.show('main', {}, false);
  }

  pause() {
    const m = this.match;
    if (m && m.net) {                           // online: the match cannot pause, only the local input is muted
      if (m.over || this.ui.open) return;
      m.localBlocked = true;
      this.input.gameActive = false;
      this.touch.setVisible(false);
      this.ui.show('netmenu', {}, false);
      return;
    }
    if (!m || m.paused || m.over) return;
    m.setPaused(true);
    this.hud.setPaused(true);
    this.input.gameActive = false;
    this.touch.setVisible(false);
    this.ui.show('pause', {}, false);
  }

  resume() {
    const m = this.match;
    if (m && m.net) {
      m.localBlocked = false;
      this.ui.hide();
      this.input.gameActive = true;
      this.input.flush();
      this.updateTouch();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      return;
    }
    if (!m || !m.paused) return;
    this.ui.hide();
    m.setPaused(false);
    this.hud.setPaused(false);
    this.input.gameActive = true;
    this.input.flush();
    this.acc = 0;
    this.updateTouch();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  onMatchEnd(match) {
    this.input.gameActive = false;
    this.touch.setVisible(false);
    this.ui.show('matchend', { result: match.result, mode: match.mode }, false);
  }

  // ------------------------------------------------------------ events
  onKey(e) {
    if (e.code === 'Escape' && !e._uiHandled) {
      const m = this.match;
      if (!m || m.over || e.repeat) return;
      const cur = this.ui.current && this.ui.current.name;
      if (m.net) { if (cur === 'netmenu') this.resume(); else if (!this.ui.open) this.pause(); }
      else if (m.paused) { if (cur === 'pause') this.resume(); }
      else if (!this.ui.open) this.pause();
    } else if (e.code === 'Backspace' && this.match && this.match.training && !this.match.paused && !e.repeat) {
      this.match.resetPositions();
    }
  }

  onVisibility() {
    if (document.hidden) {
      if (this.match && !this.match.net && !this.match.paused && !this.match.over) this.pause();
      audio.suspend();
    } else if (!this.match || !this.match.paused) {
      audio.resume();
    } else audio.resume();
  }

  // ------------------------------------------------------------ main loop (single rAF chain)
  frame(ts) {
    if (!this.running) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    try {
      this.input.pollGamepads();
      if (this.input.padPausePressed()) { if (this.match && (this.match.paused || (this.match.net && this.ui.current && this.ui.current.name === 'netmenu'))) this.resume(); else this.pause(); }
      const ctx = this.ctx, k = this.k;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const m = this.match;
      if (m) {
        if (!m.paused) {
          this.acc += dt * m.timeScale;
          let steps = 0;
          while (this.acc >= TICK && steps < 6) {
            if (m.tick() === false) { this.acc = Math.min(this.acc, TICK); break; }   // online: waiting for the opponent's input
            this.acc -= TICK; steps++;
          }
          if (steps >= 6) this.acc = 0;
        }
        m.render(ctx, k, dt);
        this.hud.update(m);
      } else {
        this.backdrop.update(dt);
        this.backdrop.render(ctx);
      }
      this.errors = 0;
    } catch (err) {
      console.error('Game loop error', err);
      if (++this.errors > 5) { this.errors = 0; this.quitToMenu(); }
    }
  }
}
