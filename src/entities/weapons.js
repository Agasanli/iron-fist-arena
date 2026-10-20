// Weapons change the character's punch-type normal attacks (jab, heavy, crouch / jump punches):
// reach, damage, speed and knock-back. Kicks, specials and ultimates are not affected.
//   range  : multiplier on hitbox width      dmg  : damage multiplier
//   start  : frames added to startup         rec  : frames added to recovery
//   knock  : knock-back multiplier           stop : extra hit-stop frames
//   len    : drawn length of the weapon in pixels (0 = worn on the fist)

export const WEAPONS = {
  fists:    { id: 'fists',    name: 'FISTS',    desc: 'No weapon. Balanced and fast.',                  range: 1,    dmg: 1,    start: 0,  rec: 0,  knock: 1,   stop: 0, len: 0 },
  katana:   { id: 'katana',   name: 'KATANA',   desc: 'Longer reach and a bit more damage.',            range: 1.3,  dmg: 1.08, start: 1,  rec: 1,  knock: 1,   stop: 0, len: 96 },
  bat:      { id: 'bat',      name: 'BAT',      desc: 'Hits hard and sends enemies flying, a little slow.', range: 1.18, dmg: 1.18, start: 2, rec: 2,  knock: 1.3, stop: 1, len: 82 },
  hammer:   { id: 'hammer',   name: 'HAMMER',   desc: 'Huge damage and knock-back, but slow to swing.', range: 1.12, dmg: 1.4,  start: 4,  rec: 5,  knock: 1.5, stop: 3, len: 88 },
  nunchaku: { id: 'nunchaku', name: 'NUNCHAKU', desc: 'Very fast strikes, slightly less damage.',       range: 1.15, dmg: 0.95, start: -1, rec: -1, knock: 0.9, stop: 0, len: 72 },
  spear:    { id: 'spear',    name: 'SPEAR',    desc: 'Longest reach. Keeps enemies at a distance.',    range: 1.55, dmg: 1.02, start: 1,  rec: 3,  knock: 1,   stop: 0, len: 132 },
  knuckles: { id: 'knuckles', name: 'KNUCKLES', desc: 'Brass knuckles: quick and punchy, short reach.', range: 0.92, dmg: 1.14, start: -1, rec: 0,  knock: 1.1, stop: 1, len: 0 },
};

export const WEAPON_IDS = Object.keys(WEAPONS);

const ARM_MOVES = ['light', 'heavy', 'crouchLight', 'crouchHeavy', 'jumpLight', 'jumpHeavy'];

/** Returns a new move table with the weapon's modifiers applied (the character data is never mutated). */
export function applyWeapon(moves, weaponId) {
  const w = WEAPONS[weaponId];
  if (!w || w.id === 'fists') return moves;
  const out = { ...moves };
  for (const id of ARM_MOVES) {
    const m = moves[id];
    if (!m || m.limb !== 'arm' || !m.hitbox) continue;
    const hb = { ...m.hitbox };
    if (!m.upward) hb.w = Math.round(hb.w * w.range);
    out[id] = {
      ...m,
      hitbox: hb,
      damage: Math.round(m.damage * w.dmg),
      startup: Math.max(2, m.startup + w.start),
      recovery: m.air ? m.recovery : Math.max(3, m.recovery + w.rec),
      knock: Math.round(m.knock * w.knock * 100) / 100,
      hitstop: m.hitstop + w.stop,
      weapon: w.id,
      wlen: w.len,
    };
  }
  return out;
}

// ---------------------------------------------------------------- drawing
// Every weapon is drawn with its grip at the origin and pointing along +x.
export function drawWeapon(ctx, id, len, t) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (id) {
    case 'katana': {
      ctx.fillStyle = '#2a1a14'; ctx.fillRect(-26, -4, 26, 8);                 // wrapped handle
      ctx.strokeStyle = '#6b4a3a'; ctx.lineWidth = 1.5;
      for (let x = -24; x < 0; x += 6) { ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x + 4, 4); ctx.stroke(); }
      ctx.fillStyle = '#d7b24f'; ctx.beginPath(); ctx.ellipse(1, 0, 4, 11, 0, 0, 7); ctx.fill();   // guard
      const g = ctx.createLinearGradient(0, -5, 0, 4);
      g.addColorStop(0, '#f4f7fb'); g.addColorStop(1, '#8e99a8');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(4, -4.5); ctx.lineTo(len - 14, -4.5); ctx.lineTo(len, -1); ctx.lineTo(len - 12, 3.5); ctx.lineTo(4, 3.5); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(8, -2); ctx.lineTo(len - 18, -2); ctx.stroke();
      break;
    }
    case 'bat': {
      const g = ctx.createLinearGradient(0, -10, 0, 10);
      g.addColorStop(0, '#d9a066'); g.addColorStop(1, '#8a5a2a');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-22, -3); ctx.lineTo(len * 0.4, -4.5); ctx.quadraticCurveTo(len * 0.85, -11, len, -9); ctx.lineTo(len, 9); ctx.quadraticCurveTo(len * 0.85, 11, len * 0.4, 4.5); ctx.lineTo(-22, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#222'; ctx.fillRect(-22, -3.2, 20, 6.4);                // grip tape
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(len * 0.5, -5); ctx.lineTo(len * 0.95, -8); ctx.stroke();
      break;
    }
    case 'hammer': {
      ctx.fillStyle = '#7a5230'; ctx.fillRect(-22, -4, len + 4, 8);
      ctx.fillStyle = '#4a3220'; ctx.fillRect(-22, -4, 16, 8);
      const g = ctx.createLinearGradient(0, -28, 0, 28);
      g.addColorStop(0, '#d6dde6'); g.addColorStop(0.5, '#8f99a6'); g.addColorStop(1, '#5a6470');
      ctx.fillStyle = g; ctx.fillRect(len - 10, -27, 34, 54);
      ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 2.5; ctx.strokeRect(len - 10, -27, 34, 54);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(len - 6, -23, 6, 46);
      break;
    }
    case 'spear': {
      ctx.fillStyle = '#8a5a2a'; ctx.fillRect(-34, -3, len - 6, 6);
      ctx.fillStyle = '#c8d0da';
      ctx.beginPath(); ctx.moveTo(len - 36, -9); ctx.quadraticCurveTo(len - 6, -8, len + 8, 0); ctx.quadraticCurveTo(len - 6, 8, len - 36, 9); ctx.quadraticCurveTo(len - 30, 0, len - 36, -9); ctx.fill();
      ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.moveTo(len - 40, 0); ctx.lineTo(len - 54, -9); ctx.lineTo(len - 50, 0); ctx.lineTo(len - 54, 9); ctx.closePath(); ctx.fill();
      break;
    }
    case 'nunchaku': {
      const stick = (l) => { ctx.fillStyle = '#2b2b31'; ctx.fillRect(0, -4, l, 8); ctx.fillStyle = '#c83a3a'; ctx.fillRect(3, -4, 5, 8); ctx.fillRect(l - 8, -4, 5, 8); };
      ctx.save(); ctx.translate(-8, 0); stick(36); ctx.restore();
      const ang = 0.9 + 0.9 * Math.sin((t || 0) * 0.5);
      ctx.strokeStyle = '#aab'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(28, 0); ctx.lineTo(28 + 14, 0); ctx.stroke();
      ctx.save(); ctx.translate(42, 0); ctx.rotate(ang); stick(Math.max(30, len - 42)); ctx.restore();
      break;
    }
    case 'knuckles': {
      ctx.fillStyle = '#b9c0c8'; ctx.strokeStyle = '#4a5058'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-6, -13, 16, 26, 4) : ctx.rect(-6, -13, 16, 26); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8edf2';
      for (let i = -9; i <= 9; i += 6) { ctx.beginPath(); ctx.arc(10, i, 3, 0, 7); ctx.fill(); }
      break;
    }
    default:
  }
  ctx.restore();
}
