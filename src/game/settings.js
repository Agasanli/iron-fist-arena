import { DEFAULT_SETTINGS, DEFAULT_BINDINGS } from './config.js';

const KEY = 'ironfist.settings.v1';
const listeners = new Set();

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function load() {
  const s = clone(DEFAULT_SETTINGS);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(s, JSON.parse(raw));
  } catch (e) { /* storage unavailable: use defaults */ }
  // sanitize bindings
  const defs = clone(DEFAULT_BINDINGS);
  if (!s.bindings || !Array.isArray(s.bindings) || s.bindings.length !== 2) s.bindings = defs;
  for (let p = 0; p < 2; p++) s.bindings[p] = Object.assign({}, defs[p], s.bindings[p]);
  return s;
}

export const settings = load();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  listeners.forEach((fn) => fn(settings));
}

export function setSetting(key, value) {
  settings[key] = value;
  saveSettings();
}

export function onSettingsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetBindings() {
  settings.bindings = clone(DEFAULT_BINDINGS);
  saveSettings();
}

export function prettyKey(code) {
  if (!code) return '—';
  return code
    .replace(/^Key/, '').replace(/^Digit/, '').replace('Numpad', 'Num ')
    .replace('Arrow', '↔ ').replace('ArrowLeft', '←')
    .replace('↔ Left', '←').replace('↔ Right', '→').replace('↔ Up', '↑').replace('↔ Down', '↓')
    .replace('ShiftRight', 'R-Shift').replace('ShiftLeft', 'L-Shift')
    .replace('Comma', ',').replace('Period', '.').replace('Slash', '/').replace('Quote', "'")
    .replace('Semicolon', ';').replace('Space', 'Space').replace('ControlRight', 'R-Ctrl');
}
