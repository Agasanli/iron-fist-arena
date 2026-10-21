import { ACTIONS } from '../game/config.js';
import { settings } from '../game/settings.js';

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);
const mk = () => ({
  left: false, right: false, up: false, down: false, light: false, heavy: false, special: false, block: false, ult: false, throw: false,
  pLeft: false, pRight: false, pUp: false, pDown: false, pLight: false, pHeavy: false, pSpecial: false, pBlock: false, pUlt: false, pThrow: false,
});
const P = { left: 'pLeft', right: 'pRight', up: 'pUp', down: 'pDown', light: 'pLight', heavy: 'pHeavy', special: 'pSpecial', block: 'pBlock', ult: 'pUlt', throw: 'pThrow' };

export function clearInput(o) {
  for (const k in o) o[k] = false;
  return o;
}

/**
 * Keyboard + gamepad + touch input. Gameplay calls poll(player, out) once per simulation tick.
 * Edge ("pressed") flags are generated per tick and also latched from key events so taps
 * shorter than one tick are never lost.
 */
export class Input {
  constructor() {
    this.keys = new Set();
    this.queued = [{}, {}];
    this.prev = [{}, {}];
    this.virtual = [{}, {}];
    this.pad = [{}, {}];
    this.gameActive = false;   // when true, gameplay keys never scroll / trigger the page
    this.solo = false;         // single-player modes: arrows / numpad also drive player 1
    this.capture = null;       // rebinding callback
    this.onKeyHook = null;     // menu navigation hook
    this._down = (e) => this.onDown(e);
    this._up = (e) => this.onUp(e);
    this._blur = () => { this.keys.clear(); };
  }

  attach() {
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
  }
  detach() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
    window.removeEventListener('blur', this._blur);
  }

  onDown(e) {
    if (this.capture) {
      e.preventDefault();
      if (!e.repeat) { const cb = this.capture; this.capture = null; cb(e.code); }
      return;
    }
    const tag = e.target && e.target.tagName;
    const inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    if (this.gameActive || (PREVENT.has(e.code) && !inField)) {
      if (this.gameActive || PREVENT.has(e.code)) e.preventDefault();
    }
    if (e.repeat) return;
    this.keys.add(e.code);
    for (let p = 0; p < 2; p++) {
      const b = settings.bindings[p];
      for (const a of ACTIONS) if (b[a] === e.code) this.queued[p][a] = true;
    }
  }
  onUp(e) {
    this.keys.delete(e.code);
  }

  setVirtual(p, action, down) {
    if (down && !this.virtual[p][action]) this.queued[p][action] = true;
    this.virtual[p][action] = down;
  }

  pollGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let p = 0; p < 2; p++) {
      const g = pads[p];
      const s = this.pad[p];
      if (!g || !g.connected) { for (const a of ACTIONS) s[a] = false; continue; }
      const ax = g.axes[0] || 0, ay = g.axes[1] || 0;
      const b = (i) => !!(g.buttons[i] && g.buttons[i].pressed);
      s.left = ax < -0.45 || b(14);
      s.right = ax > 0.45 || b(15);
      s.up = ay < -0.6 || b(12) || b(0);
      s.down = ay > 0.6 || b(13);
      s.light = b(2); s.heavy = b(3); s.special = b(1);
      s.block = b(4) || b(5);
      s.throw = b(6);
      s.ult = b(7);
    }
  }

  /** Fill `out` with the held/pressed state of player p for this tick. */
  poll(p, out) {
    const bind = settings.bindings[p];
    const alt = this.solo && p === 0 ? settings.bindings[1] : null;
    const prev = this.prev[p], q = this.queued[p], v = this.virtual[p], pad = this.pad[p];
    const q2 = alt ? this.queued[1] : null;
    for (let i = 0; i < ACTIONS.length; i++) {
      const a = ACTIONS[i];
      const held = this.keys.has(bind[a]) || (alt && this.keys.has(alt[a])) || !!v[a] || !!pad[a];
      out[a] = held;
      out[P[a]] = (held && !prev[a]) || !!q[a] || (q2 && !!q2[a]);
      prev[a] = held;
      q[a] = false;
      if (q2) q2[a] = false;
    }
    return out;
  }

  /** Discard queued presses (used when a round starts so intro taps don't leak in) */
  flush() {
    for (let p = 0; p < 2; p++) {
      this.queued[p] = {};
      for (const a of ACTIONS) this.prev[p][a] = true;
    }
  }

  /** gamepad "start"/pause edge */
  padPausePressed() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let any = false;
    for (const g of pads) if (g && g.buttons[9] && g.buttons[9].pressed) any = true;
    const r = any && !this._padStart;
    this._padStart = any;
    return r;
  }
}

export { mk as createInputState };
