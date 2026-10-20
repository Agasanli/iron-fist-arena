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
    this.backdrop = new Backdrop();
    this.ui = new UI(this, document.querySelector('#ui'));
    this.input.attach();
    window.addEventListener('resize', this._resize);
    document.addEventListener('fullscreenchange', this._resize);
    document.addEventListener('visibilitychange', this._vis);
    window.addEventListener('keydown', this._key);
    window.addEventListener('pointerdown', this._gesture);
    window.addEventListener('keydown', this._gesture);
    window.addEventListener('blur', () => { if (this.match && !this.match.paused && !this.match.over) this.pause(); });
    this.layout();
    audio.playMusic('menu');
    this.ui.show('main', {}, false);
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
    this.input.solo = opts.mode !== 'versus';
    audio.unlock();
    this.hud.hide();
    this.match = new Match(this, opts);
    this.acc = 0;
    this.input.gameActive = true;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    this.updateTouch();
  }

  rematch() {
    if (!this.lastOpts) return;
    this.ui.hide();
    this.startMatch(this.lastOpts);
  }

  quitToMenu(showMain = true) {
    if (this.match) { this.match.destroy(); this.match = null; }
    this.hud.show(false);
    this.input.gameActive = false;
    this.input.solo = false;
    this.touch.setVisible(false);
    this.ui.clearStack();
    audio.playMusic('menu');
    if (showMain) this.ui.show('main', {}, false);
  }

  pause() {
    const m = this.match;
    if (!m || m.paused || m.over) return;
    m.setPaused(true);
    this.hud.setPaused(true);
    this.input.gameActive = false;
    this.touch.setVisible(false);
    this.ui.show('pause', {}, false);
  }

  resume() {
    const m = this.match;
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
      if (m.paused) { if (this.ui.current && this.ui.current.name === 'pause') this.resume(); }
      else if (!this.ui.open) this.pause();
    } else if (e.code === 'Backspace' && this.match && this.match.training && !this.match.paused && !e.repeat) {
      this.match.resetPositions();
    }
  }

  onVisibility() {
    if (document.hidden) {
      if (this.match && !this.match.paused && !this.match.over) this.pause();
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
      if (this.input.padPausePressed()) { if (this.match && this.match.paused) this.resume(); else this.pause(); }
      const ctx = this.ctx, k = this.k;
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const m = this.match;
      if (m) {
        if (!m.paused) {
          this.acc += dt * m.timeScale;
          let steps = 0;
          while (this.acc >= TICK && steps < 6) { m.tick(); this.acc -= TICK; steps++; }
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
