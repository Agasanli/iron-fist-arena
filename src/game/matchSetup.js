import { settings } from './settings.js';
import { CHARACTER_IDS } from '../entities/characters.js';
import { WEAPON_IDS } from '../entities/weapons.js';

const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/** 'random' means a random weapon, resolved when the match is created (offline modes only). */
export function resolveWeapon(w) { return w === 'random' || !WEAPON_IDS.includes(w) ? (w === 'random' ? pick(WEAPON_IDS) : 'fists') : w; }

const okChar = (c, fallback) => (CHARACTER_IDS.includes(c) ? c : fallback);

/** The four team-battle slots (blue: 0-1, red: 2-3), sanitised against the current roster. */
export function teamSlots() {
  const defaults = ['papakha', 'delegate', 'zaur', 'vakil'];
  const raw = Array.isArray(settings.team) ? settings.team : [];
  const slots = defaults.map((d, i) => {
    const s = raw[i] || {};
    return { char: okChar(s.char, d), weapon: WEAPON_IDS.includes(s.weapon) || s.weapon === 'random' ? s.weapon : 'fists', ctrl: ['p1', 'p2', 'cpu'].includes(s.ctrl) ? s.ctrl : (i === 0 ? 'p1' : 'cpu') };
  });
  // each keyboard can only control one fighter
  for (const c of ['p1', 'p2']) {
    let seen = false;
    for (const s of slots) if (s.ctrl === c) { if (seen) s.ctrl = 'cpu'; seen = true; }
  }
  return slots;
}

/** Build the match options for an offline mode from the current settings. */
export function buildOffline(mode) {
  const s = settings;
  let slots;
  if (mode === 'team') {
    slots = teamSlots().map((x) => ({ ...x, weapon: resolveWeapon(x.weapon) }));
  } else {
    const second = mode === 'versus' ? 'p2' : (mode === 'training' ? 'dummy' : 'cpu');
    slots = [
      { char: s.p1Char, weapon: resolveWeapon(s.p1Weapon), ctrl: 'p1' },
      { char: s.p2Char, weapon: resolveWeapon(s.p2Weapon), ctrl: second },
    ];
  }
  return { mode, slots, arena: s.arena, difficulty: s.difficulty };
}
