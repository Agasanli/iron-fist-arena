// Shields change how blocking works. Hold BLOCK to raise the shield.
//   chip  : multiplier on chip damage taken while blocking (1 = normal 10%)
//   stun  : multiplier on block-stun (lower = recover faster)
//   walk  : walking / running speed multiplier while carrying it
//   parry : frames after raising the shield in which a blocked hit is a PARRY (attacker is stunned, no damage)
//   thorns: damage dealt to a melee attacker whose hit is blocked
//   cover : blocks low AND high attacks whether crouching or standing

export const SHIELDS = {
  none:    { id: 'none',    name: 'NO SHIELD',    desc: 'Normal blocking.',                                                        chip: 1,   stun: 1,    walk: 1,    parry: 0, thorns: 0,  cover: false },
  buckler: { id: 'buckler', name: 'BUCKLER',      desc: 'Small and quick. Raise it right as a hit lands to PARRY and stun the attacker.', chip: 0.6, stun: 0.85, walk: 1,    parry: 7, thorns: 0,  cover: false },
  round:   { id: 'round',   name: 'ROUND SHIELD', desc: 'Solid all-rounder: far less chip damage and you recover faster from blocks.',  chip: 0.3, stun: 0.75, walk: 0.95, parry: 0, thorns: 0,  cover: false },
  tower:   { id: 'tower',   name: 'TOWER SHIELD', desc: 'Covers everything: blocks high AND low attacks with no chip damage, but you walk slower.', chip: 0, stun: 0.8, walk: 0.8, parry: 0, thorns: 0, cover: true },
  spiked:  { id: 'spiked',  name: 'SPIKED SHIELD', desc: 'Blocked melee hits hurt the attacker.',                                    chip: 0.5, stun: 1,    walk: 0.95, parry: 0, thorns: 14, cover: false },
};

export const SHIELD_IDS = Object.keys(SHIELDS);

/** Bars for the picker (0..1). */
export function shieldBars(id) {
  const s = SHIELDS[id] || SHIELDS.none;
  const bars = [
    ['DEFENSE', Math.max(0.05, 1 - s.chip * 0.9)],
    ['MOBILITY', Math.max(0.05, (s.walk - 0.7) / 0.3)],
  ];
  if (s.parry) bars.push(['PARRY', 1]);
  if (s.thorns) bars.push(['THORNS', s.thorns / 18]);
  if (s.cover) bars.push(['COVER', 1]);
  return bars;
}

// ---------------------------------------------------------------- drawing
// Drawn centred on the origin as if seen from the front; `s` scales it (1 = about 60 px wide).
export function drawShield(ctx, id, s = 1) {
  ctx.save();
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  switch (id) {
    case 'buckler': {
      const g = ctx.createRadialGradient(-6, -6, 2, 0, 0, 24);
      g.addColorStop(0, '#eef2f6'); g.addColorStop(1, '#8d97a4');
      ctx.fillStyle = g; ctx.strokeStyle = '#4a525c'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 23, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9dee4'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4a525c'; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.arc(Math.cos(a) * 16, Math.sin(a) * 16, 1.8, 0, 7); ctx.fill(); }
      break;
    }
    case 'round': {
      ctx.fillStyle = '#9a6a3a'; ctx.strokeStyle = '#4a4a50'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, 0, 31, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(70,40,15,.6)'; ctx.lineWidth = 2;
      for (let x = -20; x <= 20; x += 10) { ctx.beginPath(); ctx.moveTo(x, -Math.sqrt(900 - x * x)); ctx.lineTo(x, Math.sqrt(900 - x * x)); ctx.stroke(); }
      ctx.fillStyle = '#c62f2f'; ctx.fillRect(-31, -5, 62, 10);
      ctx.fillStyle = '#c9ced4'; ctx.strokeStyle = '#4a4a50'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill(); ctx.stroke();
      break;
    }
    case 'tower': {
      const g = ctx.createLinearGradient(-20, 0, 20, 0);
      g.addColorStop(0, '#8c9bad'); g.addColorStop(0.5, '#5f6e80'); g.addColorStop(1, '#46515f');
      ctx.fillStyle = g; ctx.strokeStyle = '#262c34'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-20, 38); ctx.lineTo(-20, -24); ctx.quadraticCurveTo(0, -46, 20, -24); ctx.lineTo(20, 38); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d4af4a'; ctx.fillRect(-4, -34, 8, 66); ctx.fillRect(-16, -8, 32, 8);
      ctx.strokeStyle = '#262c34'; ctx.lineWidth = 1.5; ctx.strokeRect(-4, -34, 8, 66); ctx.strokeRect(-16, -8, 32, 8);
      break;
    }
    case 'spiked': {
      ctx.fillStyle = '#9aa3ae'; ctx.strokeStyle = '#20252b';
      for (let i = 0; i < 10; i++) {                         // spikes
        const a = i * Math.PI / 5;
        ctx.save(); ctx.rotate(a);
        ctx.beginPath(); ctx.moveTo(24, -6); ctx.lineTo(40, 0); ctx.lineTo(24, 6); ctx.closePath(); ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      }
      const g = ctx.createRadialGradient(-6, -6, 3, 0, 0, 28);
      g.addColorStop(0, '#68727f'); g.addColorStop(1, '#2c323a');
      ctx.fillStyle = g; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 27, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#b8c0ca'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(7, 0); ctx.lineTo(0, 16); ctx.lineTo(-7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    default:
  }
  ctx.restore();
}

const cache = {};
export function shieldIcon(id) {
  if (cache[id]) return cache[id];
  const c = document.createElement('canvas');
  c.width = 160; c.height = 72;
  const x = c.getContext('2d');
  if (id === 'random' || !SHIELDS[id]) {
    x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '900 54px Impact, Arial Black, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('?', 80, 38);
  } else if (id === 'none') {
    x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.arc(80, 36, 22, 0, 7); x.moveTo(64, 52); x.lineTo(96, 20); x.stroke();
  } else {
    x.translate(80, 36);
    drawShield(x, id, id === 'tower' ? 0.8 : 1.05);
  }
  cache[id] = c.toDataURL('image/png');
  return cache[id];
}
