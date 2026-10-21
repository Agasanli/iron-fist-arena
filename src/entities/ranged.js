// Throwable / ranged items. Press the THROW key (default Y / Numpad 5) to throw or shoot; each item has its own
// cooldown. Hold DOWN while throwing for a low shot.

const P = (o) => ({ x: 60, y: 150, level: 'mid', hitstop: 5, shake: 0, hitstun: 16, blockstun: 8, knock: 4, life: 70, ...o });

export const RANGED = {
  none: { id: 'none', name: 'NO RANGED ITEM', desc: 'You fight with your weapon only.' },
  bow: {
    id: 'bow', name: 'BOW', desc: 'Fast arrows with great range. Hold DOWN to shoot low.',
    startup: 13, recovery: 16, cooldown: 52, throwSfx: 'twang',
    proj: P({ style: 'arrow', vx: 21, w: 74, h: 14, damage: 72, hitstun: 18, blockstun: 10, knock: 5, hitstop: 6, life: 72 }),
  },
  knives: {
    id: 'knives', name: 'THROWING KNIVES', desc: 'Very quick knives with a short cooldown.',
    startup: 7, recovery: 11, cooldown: 26, throwSfx: 'whoosh',
    proj: P({ style: 'knife', vx: 17, w: 46, h: 12, damage: 40, hitstun: 13, blockstun: 7, knock: 3, hitstop: 4, life: 55 }),
  },
  taxe: {
    id: 'taxe', name: 'THROWING AXE', desc: 'A spinning axe that flies in an arc and hits hard.',
    startup: 12, recovery: 20, cooldown: 75, throwSfx: 'whoosh',
    proj: P({ style: 'taxe', vx: 10.5, vy: -9.5, gravity: 0.55, w: 56, h: 56, damage: 98, hitstun: 22, blockstun: 12, knock: 8, hitstop: 8, shake: 3, life: 90 }),
  },
  shuriken: {
    id: 'shuriken', name: 'SHURIKEN', desc: 'Three stars in a fan. Good at covering the air.',
    startup: 9, recovery: 14, cooldown: 48, throwSfx: 'whoosh',
    proj: [-2.1, 0, 2.1].map((vy) => P({ style: 'star', vx: 15, vy, w: 34, h: 34, damage: 26, hitstun: 12, blockstun: 6, knock: 2.5, hitstop: 3, life: 55, y: 150 + vy * 8 })),
  },
  bomb: {
    id: 'bomb', name: 'BOMB', desc: 'Lobbed in an arc and explodes on impact, hurting everyone close by.',
    startup: 14, recovery: 22, cooldown: 90, throwSfx: 'whoosh',
    proj: P({ style: 'bomb', vx: 8.5, vy: -8, gravity: 0.5, w: 40, h: 40, damage: 112, hitstun: 24, blockstun: 14, knock: 9, launch: 9, hitstop: 9, shake: 8, life: 110, explode: 125 }),
  },
};

export const RANGED_IDS = Object.keys(RANGED);

/** A move object for the attack state machine (null = no item). */
export function rangedMove(id) {
  const r = RANGED[id];
  if (!r || r.id === 'none') return null;
  return {
    name: r.name, startup: r.startup, active: 2, recovery: r.recovery, damage: 0, hitstun: 0, blockstun: 0, knock: 0, hitstop: 0, shake: 0,
    hitbox: null, level: 'mid', limb: 'arm', sfx: 'none', cooldown: r.cooldown, projectile: r.proj, ranged: true, throwSfx: r.throwSfx,
  };
}

export function rangedBars(id) {
  const r = RANGED[id];
  if (!r || r.id === 'none') return [];
  const defs = [].concat(r.proj);
  const dmg = defs.reduce((s, d) => s + d.damage, 0);
  return [
    ['DAMAGE', Math.min(1, dmg / 120)],
    ['RANGE', Math.min(1, (defs[0].vx * defs[0].life) / 1500)],
    ['RATE', Math.min(1, 1 - (r.cooldown - 20) / 80)],
  ];
}

// ---------------------------------------------------------------- icons
function drawItem(ctx, id) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (id) {
    case 'bow': {
      ctx.strokeStyle = '#8a5a2a'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(-14, 0, 38, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = '#e8e8ee'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-14 + Math.cos(-1.15) * 38, Math.sin(-1.15) * 38); ctx.lineTo(-14 + Math.cos(1.15) * 38, Math.sin(1.15) * 38); ctx.stroke();
      ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(34, 0); ctx.stroke();
      ctx.fillStyle = '#cfd6df'; ctx.beginPath(); ctx.moveTo(34, -6); ctx.lineTo(48, 0); ctx.lineTo(34, 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.moveTo(-40, 0); ctx.lineTo(-48, -7); ctx.lineTo(-34, -2); ctx.closePath(); ctx.fill();
      break;
    }
    case 'knives': {
      const knife = (dy, rot) => {
        ctx.save(); ctx.translate(0, dy); ctx.rotate(rot);
        ctx.fillStyle = '#3a2a1e'; ctx.fillRect(-34, -4, 22, 8);
        ctx.fillStyle = '#d8dee6'; ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(24, -6); ctx.lineTo(42, 0); ctx.lineTo(-12, 6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#59616b'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      };
      knife(-14, -0.12); knife(14, 0.12);
      break;
    }
    case 'taxe': {
      ctx.fillStyle = '#7a5230'; ctx.fillRect(-36, -3.5, 66, 7);
      const g = ctx.createLinearGradient(0, -24, 0, 24); g.addColorStop(0, '#e6ecf2'); g.addColorStop(1, '#7d8794');
      ctx.fillStyle = g; ctx.strokeStyle = '#2a2f36'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(14, -22); ctx.quadraticCurveTo(44, -16, 42, 0); ctx.quadraticCurveTo(44, 16, 14, 22); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    case 'shuriken': {
      const star = (x, y, r, rot) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.fillStyle = '#cfd6df'; ctx.strokeStyle = '#3a4048'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.38 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, 7); ctx.fill();
        ctx.restore();
      };
      star(-26, 8, 18, 0.2); star(2, -10, 22, 0.6); star(30, 8, 18, 1.0);
      break;
    }
    case 'bomb': {
      const g = ctx.createRadialGradient(-8, -8, 3, 0, 0, 28);
      g.addColorStop(0, '#6a707a'); g.addColorStop(1, '#14161a');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 6, 26, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8a6a30'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(8, -18); ctx.quadraticCurveTo(18, -34, 30, -30); ctx.stroke();
      ctx.fillStyle = '#ffb12a'; ctx.beginPath(); ctx.arc(31, -30, 6, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(31, -30, 3, 0, 7); ctx.fill();
      break;
    }
    default:
  }
}

const cache = {};
export function rangedIcon(id) {
  if (cache[id]) return cache[id];
  const c = document.createElement('canvas');
  c.width = 160; c.height = 72;
  const x = c.getContext('2d');
  if (id === 'random' || !RANGED[id]) {
    x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '900 54px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('?', 80, 38);
  } else if (id === 'none') {
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.arc(80, 36, 22, 0, 7); x.moveTo(64, 52); x.lineTo(96, 20); x.stroke();
  } else {
    x.translate(80, 38);
    const s = id === 'bow' ? 0.72 : id === 'bomb' ? 0.95 : 1;
    x.scale(s, s);
    drawItem(x, id);
  }
  cache[id] = c.toDataURL('image/png');
  return cache[id];
}
