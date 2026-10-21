import { GROUND } from '../game/config.js';
import { drawWeapon, WEAPONS } from './weapons.js';
import { drawShield } from './shields.js';

// Procedural animation: the supplied artwork is a single static image per character, so the
// torso sprite is posed (lean / squash / bob) while legs and attacking limbs are drawn
// procedurally (2-bone IK) in matching colours.

export function createPose() {
  return {
    x: 0, y: 0, facing: 1, lean: 0, bodyRot: 0, sx: 1, sy: 1, hipH: 70, bob: 0, ox: 0, drop: 0,
    ffx: 18, ffy: 0, bfx: -16, bfy: 0, limb: 0, ltx: 0, lty: 0, guard: 0, pump: 0, grab: 0,
    flash: 0, hurt: 0, aura: 0, ext: 0, weapon: 'fists', wield: 0, wlen: 0, t: 0, shield: 'none',
  };
}

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function attackExt(mv, t) {
  const su = mv.startup, ac = mv.active, rec = mv.recovery;
  if (t <= su) return -0.22 * (t / su);
  if (t <= su + ac) return (mv.multi || mv.beam) ? 1 : Math.min(1, 0.5 + (t - su) * 0.5);
  if (rec <= 0) return 1;
  const p = (t - su - ac) / rec;
  return Math.max(0, 1 - p * 1.5);
}

export function computePose(f, o) {
  const b = f.cfg.body, L = b.legLen, t = f.t;
  o.x = f.x; o.y = f.y; o.facing = f.facing;
  o.lean = 0; o.bodyRot = 0; o.sx = 1; o.sy = 1; o.hipH = L * 0.96; o.bob = 0; o.ox = 0; o.drop = 0;
  o.ffx = 20; o.ffy = 0; o.bfx = -17; o.bfy = 0; o.limb = 0; o.guard = 0; o.pump = 0; o.grab = 0;
  o.flash = f.flash > 0 ? f.flash / 6 : 0;
  o.hurt = (f.state === 'hit' || f.state === 'airhit') ? 0.16 : 0;
  o.aura = 0; o.ext = 0;
  o.weapon = f.weapon || 'fists'; o.wield = 0; o.wlen = 0; o.t = f.t; o.shield = f.shield || 'none';

  switch (f.state) {
    case 'idle': {
      const s = Math.sin(t * 0.085);
      o.bob = s * 1.8; o.sy = 1 + s * 0.007; o.ffx = 26; o.bfx = -22; o.hipH = L * 0.92;
      break;
    }
    case 'walk': {
      const ph = f.walkPhase, s = Math.sin(ph), c = Math.cos(ph);
      o.ffx = s * 30 + 8; o.ffy = -Math.max(0, c) * 13;
      o.bfx = -s * 30 - 8; o.bfy = -Math.max(0, -c) * 13;
      o.bob = -Math.abs(c) * 3.5; o.lean = 0.05 * (f.vx * f.facing >= 0 ? 1 : -1); o.hipH = L * 0.94;
      break;
    }
    case 'run': {
      const ph = f.walkPhase, s = Math.sin(ph), c = Math.cos(ph);
      o.ffx = s * 46 + 10; o.ffy = -Math.max(0, c) * 28;
      o.bfx = -s * 46 - 10; o.bfy = -Math.max(0, -c) * 28;
      o.bob = -Math.abs(c) * 6; o.lean = 0.22; o.hipH = L * 0.88; o.ox = 6;
      break;
    }
    case 'crouch':
      o.hipH = L * 0.36; o.ffx = 31; o.bfx = -27; o.lean = 0.08; o.sy = 0.86; o.ox = 4;
      break;
    case 'jump': {
      o.ffx = 25; o.ffy = -L * 0.42; o.bfx = -6; o.bfy = -L * 0.6;
      o.lean = clamp(f.vy * 0.008, -0.12, 0.14); o.hipH = L * 0.94;
      break;
    }
    case 'block': {
      const crouch = f.crouchBlock;
      o.guard = 1; o.lean = -0.05; o.ox = -2;
      if (crouch) { o.hipH = L * 0.38; o.sy = 0.86; o.ffx = 30; o.bfx = -26; } else { o.ffx = 26; o.bfx = -22; o.hipH = L * 0.92; }
      if (f.blockstun > 0) o.ox -= Math.sin(f.blockstun * 1.7) * 2;
      break;
    }
    case 'hit':
      o.lean = -0.2; o.ox = -6 + Math.sin(t * 2.4) * 2.5; o.hipH = L * 0.9; o.ffx = 22; o.bfx = -22;
      break;
    case 'airhit':
      o.bodyRot = clamp(-0.55 + f.vy * -0.04, -1.45, 0.1);
      o.ffx = 20; o.ffy = -22; o.bfx = -10; o.bfy = -14; o.hipH = L * 0.92;
      break;
    case 'down':
      o.bodyRot = -Math.PI / 2 * 1.02; o.hipH = L * 0.96; o.drop = o.hipH - 26;
      o.ffx = 0; o.bfx = 0;
      break;
    case 'getup': {
      const p = clamp(f.stateTick / 16, 0, 1), e = p * p * (3 - 2 * p);
      o.bodyRot = -Math.PI / 2 * (1 - e); o.hipH = L * 0.96; o.drop = (o.hipH - 26) * (1 - e);
      o.ffx = 14; o.bfx = -14;
      break;
    }
    case 'win': {
      // victory hop: the whole body jumps with tucked legs (no extra limbs are drawn)
      const s = Math.abs(Math.sin(t * 0.11)), air = s * 16;
      o.drop = -air; o.lean = -0.07 + s * 0.05; o.sy = 1 + s * 0.015; o.hipH = L * 0.92;
      o.ffx = 24; o.ffy = -air * 0.9; o.bfx = -20; o.bfy = -air * 0.6;
      break;
    }
    case 'throw':
      o.grab = 1; o.lean = 0.16; o.ffx = 30; o.bfx = -26; o.hipH = L * 0.9;
      break;
    case 'grabbed':
      o.lean = -0.14; o.ox = -4; o.ffy = -6;
      break;
    case 'dashback':
      o.lean = -0.16; o.hipH = L * 0.88; o.ffx = 6; o.ffy = -10; o.bfx = -28; o.bfy = -4; o.ox = -5;
      break;
    case 'attack': {
      const mv = f.move, ext = attackExt(mv, f.moveTick);
      o.ext = ext;
      o.lean = ext * 0.15;
      const crouch = mv.crouch;
      o.hipH = crouch ? L * (0.36 + (mv.upward ? 0.45 * Math.max(0, ext) : 0)) : L * 0.88;
      if (mv.air) { o.hipH = L * 0.94; o.ffx = 22; o.ffy = -L * 0.35; o.bfx = -6; o.bfy = -L * 0.5; }
      else { o.ffx = 34; o.bfx = -30; if (crouch) { o.ffx = 32; o.bfx = -26; o.sy = 0.88; } }
      if (mv.aura && f.phase === 'active') { o.lean = 0.4; o.aura = 1; o.ffx = 42; o.ffy = -4; o.bfx = -36; o.bfy = -16; o.hipH = L * 0.85; }
      if (mv.cinematic) o.aura = ext > 0 ? 1 : 0.4;
      const hb = mv.hitbox;
      let tx, ty;
      if (hb) {
        if (mv.upward) { tx = (hb.x + hb.w * 0.55) * ext; ty = -(hb.y - 36) * Math.max(ext, 0) - (1 - Math.max(ext, 0)) * 70; if (ext < 0) { tx = ext * 40; ty = -70; } }
        else if (mv.quake) { tx = (hb.w * 0.1 + 40) * ext; ty = -(hb.y - hb.h - 5 + (ext < 0 ? -70 * -ext * 3 : 0)); if (ext < 0) { tx = 10; ty = -(L + 120 + 60 * -ext); } else { ty = -14; } }
        else {
          // with a weapon the hand stops short so the weapon tip reaches the end of the hitbox
          tx = (mv.weapon ? Math.max(58, hb.x + hb.w - 8 - mv.wlen * 0.85) : hb.x + hb.w - 8) * ext;
          ty = -(hb.y - hb.h / 2);
        }
      } else { tx = 78 * ext; ty = -(f.cfg.body.hurtH * 0.6); }
      tx = Math.min(tx, mv.limb === 'leg' ? 150 : 128);     // very long hitboxes (beams) must not stretch the limb
      if (mv.limb === 'leg') {
        o.limb = 2; o.ffx = tx; o.ffy = ty - (mv.air ? 0 : 0); o.ltx = tx; o.lty = ty;
        if (!mv.air) { o.bfx = -18; o.bfy = 0; o.lean = -0.1 * Math.max(ext, 0) + (ext < 0 ? ext * 0.3 : 0); }
      } else {
        o.limb = 1; o.ltx = tx; o.lty = ty;
        if (mv.weapon) { o.wield = 1; o.wlen = mv.wlen; }
      }
      if (mv.multi && !mv.beam && f.phase === 'active') { o.ltx += Math.sin(f.moveTick * 2.1) * 10; o.lty += Math.sin(f.moveTick * 3.3) * 22; }
      if (mv.counter && f.moveTick <= mv.counter.to + 2) { o.limb = 0; o.guard = 1; o.aura = 0.5; o.lean = -0.04; o.ffx = 30; o.bfx = -26; }
      if (mv.projectile) { o.limb = 1; o.ltx = 60 * Math.max(ext, -0.4) + 15; o.lty = -(b.hurtH * 0.7); o.lean = ext * 0.1; }
      break;
    }
    default:
  }
  return o;
}

// ---------- drawing ----------

function ik(hx, hy, fx, fy, a, b, out) {
  let dx = fx - hx, dy = fy - hy;
  let d = Math.hypot(dx, dy);
  const max = (a + b) * 0.998;
  if (d > max) { fx = hx + dx / d * max; fy = hy + dy / d * max; dx = fx - hx; dy = fy - hy; d = max; }
  if (d < 1) d = 1;
  const x = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  const ux = dx / d, uy = dy / d;
  let px = -uy, py = ux;
  if (px < 0) { px = -px; py = -py; }          // knees / elbows bend forward
  out.kx = hx + ux * x + px * h; out.ky = hy + uy * x + py * h; out.fx = fx; out.fy = fy;
  return out;
}
const IK = { kx: 0, ky: 0, fx: 0, fy: 0 };
const HAND = { x: 0, y: 0, ang: 0 };      // where the last drawn arm ended (weapons are attached here)

function drawLeg(ctx, b, hx, hy, fx, fy, dim) {
  const half = b.legLen / 2 + 1;
  ik(hx, hy, fx, fy, half, half, IK);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const tw = b.thigh * 1.7, sw = b.shin * 1.7;
  const col = dim ? b.legDark : b.legColor;
  if (b.shortsLen < 1) {   // bare skin: dark outline for definition
    ctx.strokeStyle = b.legDark;
    ctx.lineWidth = tw + 4; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(IK.kx, IK.ky); ctx.stroke();
    ctx.lineWidth = sw + 4; ctx.beginPath(); ctx.moveTo(IK.kx, IK.ky); ctx.lineTo(IK.fx, IK.fy - 4); ctx.stroke();
  }
  ctx.strokeStyle = col;
  ctx.lineWidth = tw; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(IK.kx, IK.ky); ctx.stroke();
  ctx.lineWidth = sw; ctx.beginPath(); ctx.moveTo(IK.kx, IK.ky); ctx.lineTo(IK.fx, IK.fy - 4); ctx.stroke();
  // muscle shading: shadow on the back edge, highlight on the front edge
  if (b.shortsLen < 1) {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = tw * 0.4; ctx.beginPath(); ctx.moveTo(hx - tw * 0.28, hy); ctx.lineTo(IK.kx - tw * 0.28, IK.ky); ctx.stroke();
    ctx.lineWidth = sw * 0.4; ctx.beginPath(); ctx.moveTo(IK.kx - sw * 0.28, IK.ky); ctx.lineTo(IK.fx - sw * 0.28, IK.fy - 6); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = tw * 0.22; ctx.beginPath(); ctx.moveTo(hx + tw * 0.2, hy); ctx.lineTo(IK.kx + tw * 0.2, IK.ky); ctx.stroke();
    ctx.lineWidth = sw * 0.22; ctx.beginPath(); ctx.moveTo(IK.kx + sw * 0.2, IK.ky); ctx.lineTo(IK.fx + sw * 0.2, IK.fy - 6); ctx.stroke();
    // trunks
    ctx.strokeStyle = b.shorts; ctx.lineCap = 'butt';
    ctx.lineWidth = tw + 5;
    ctx.beginPath(); ctx.moveTo(hx, hy);
    ctx.lineTo(hx + (IK.kx - hx) * b.shortsLen, hy + (IK.ky - hy) * b.shortsLen); ctx.stroke(); ctx.lineCap = 'round';
  }
  // shoe / foot
  ctx.fillStyle = b.shoe;
  ctx.beginPath(); ctx.ellipse(IK.fx + 9, IK.fy - 5, b.shortsLen < 1 ? 15 : 20, b.shortsLen < 1 ? 7 : 8.5, 0, 0, 7); ctx.fill();
  if (b.shortsLen >= 1) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(IK.fx + 14, IK.fy - 8, 9, 2.5, 0, 0, 7); ctx.fill(); }
}

function drawArm(ctx, a, sx, sy, tx, ty, back) {
  // segment length adapts so a punch looks straight at full extension and bent when pulled back
  const seg = Math.max(46, Math.hypot(tx - sx, ty - sy) * 0.53);
  ik(sx, sy, tx, ty, seg, seg, IK);
  HAND.x = IK.fx; HAND.y = IK.fy; HAND.ang = Math.atan2(IK.fy - sy, IK.fx - sx);   // overall arm direction
  // elbows bend downward for arms
  if (IK.ky < (sy + ty) / 2 - 1) { // flip bend side if it went up
    const mx = (sx + IK.fx) / 2, my = (sy + IK.fy) / 2;
    IK.kx = 2 * mx - IK.kx; IK.ky = 2 * my - IK.ky;
  }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const w = a.width * (back ? 0.9 : 1);
  if (a.sleeve) {
    // jacket sleeve
    ctx.strokeStyle = back ? (a.sleeveDark || '#150f0d') : a.sleeve;
    ctx.lineWidth = w + 2;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(IK.kx, IK.ky); ctx.lineTo(IK.fx, IK.fy); ctx.stroke();
    ctx.strokeStyle = back ? (a.sleeveDark || '#1c1411') : (a.sleeveHi || '#3a2b24'); ctx.lineWidth = w * 0.35;
    ctx.beginPath(); ctx.moveTo(sx + 2, sy - 4); ctx.lineTo(IK.kx + 2, IK.ky - 4); ctx.lineTo(IK.fx, IK.fy - 3); ctx.stroke();
    // shirt cuff + watch + hand
    const ux = IK.fx - IK.kx, uy = IK.fy - IK.ky, d = Math.hypot(ux, uy) || 1;
    const cx = IK.fx - ux / d * 5, cy = IK.fy - uy / d * 5;
    ctx.strokeStyle = a.cuff; ctx.lineWidth = w * 0.95;
    ctx.beginPath(); ctx.moveTo(cx - ux / d * 6, cy - uy / d * 6); ctx.lineTo(cx, cy); ctx.stroke();
    ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(cx - ux / d * 12, cy - uy / d * 12 - 0); ctx.lineTo(cx - ux / d * 8, cy - uy / d * 8); ctx.stroke();
    ctx.fillStyle = a.skin;
    ctx.beginPath(); ctx.arc(IK.fx + ux / d * 6, IK.fy + uy / d * 6, a.hand, 0, 7); ctx.fill();
  } else {
    ctx.strokeStyle = a.dark; ctx.lineWidth = w + 5;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(IK.kx, IK.ky); ctx.lineTo(IK.fx, IK.fy); ctx.stroke();
    ctx.strokeStyle = a.skin; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(IK.kx, IK.ky); ctx.lineTo(IK.fx, IK.fy); ctx.stroke();
    ctx.strokeStyle = a.hi; ctx.lineWidth = w * 0.28;
    ctx.beginPath(); ctx.moveTo(sx + 2, sy - 5); ctx.lineTo(IK.kx + 2, IK.ky - 5); ctx.lineTo(IK.fx, IK.fy - 4); ctx.stroke();
    // fist
    ctx.fillStyle = a.skin; ctx.strokeStyle = a.dark; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(IK.fx, IK.fy, a.hand, 0, 7); ctx.fill(); ctx.stroke();
  }
}

/** Procedural shirt-and-tie torso under a head-and-shoulders photo. */
function drawExtension(ctx, ex) {
  const h = ex.h, w1 = ex.w / 2, w2 = ex.w2 / 2;
  ctx.fillStyle = ex.color;
  ctx.beginPath(); ctx.moveTo(-w1, -h - 3); ctx.lineTo(w1, -h - 3); ctx.lineTo(w2, 0); ctx.lineTo(-w2, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ex.shade;                      // side shading
  ctx.beginPath(); ctx.moveTo(w1 - 14, -h - 3); ctx.lineTo(w1, -h - 3); ctx.lineTo(w2, 0); ctx.lineTo(w2 - 10, 0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ex.tie;                        // tie continues down the middle
  ctx.beginPath(); ctx.moveTo(-8, -h - 3); ctx.lineTo(8, -h - 3); ctx.lineTo(7, -8); ctx.lineTo(0, -3); ctx.lineTo(-7, -8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = ex.belt; ctx.fillRect(-w2, -7, w2 * 2, 8);
  ctx.fillStyle = '#c9c9d0'; ctx.fillRect(-5, -6, 10, 6);
}

export function drawShadow(ctx, f) {
  const lift = clamp((GROUND - f.y) / 260, 0, 1);
  const w = 52 * (1 - lift * 0.5) + (f.state === 'down' ? 50 : 0);
  ctx.save();
  ctx.globalAlpha = 0.42 * (1 - lift * 0.6);
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(f.x, GROUND + 4, w, 11 * (1 - lift * 0.4), 0, 0, 7); ctx.fill();
  ctx.restore();
}

export function drawFighter(ctx, f, sprite, pose, alpha = 1, auraColor) {
  const cfg = f.cfg, sp = cfg.sprite, b = cfg.body;
  const scale = sp.scale;
  const img = sprite.img;
  const w = img.width * scale, h = img.height * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(pose.x, pose.y + pose.drop);
  ctx.scale(pose.facing, 1);
  if (pose.bodyRot) {
    ctx.translate(0, -pose.hipH); ctx.rotate(pose.bodyRot); ctx.translate(0, pose.hipH);
  }
  const hipY = -pose.hipH;

  // aura (rush / ultimate)
  if (pose.aura && auraColor) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, hipY - 70, 10, 0, hipY - 70, 150);
    g.addColorStop(0, auraColor + 'aa'); g.addColorStop(1, auraColor + '00');
    ctx.globalAlpha = 0.6 * pose.aura * alpha;
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, hipY - 70, 150, 0, 7); ctx.fill();
    ctx.restore();
  }

  // legs
  const hx = 4, hy = hipY + 2;
  drawLeg(ctx, b, hx - 6, hy, pose.bfx, pose.bfy, true);
  if (pose.limb !== 2) drawLeg(ctx, b, hx + 6, hy, pose.ffx, pose.ffy, false);

  // back arm for guard
  const shx0 = sp.shoulderX, shy0 = sp.shoulderH;
  const cl = Math.cos(pose.lean), sl = Math.sin(pose.lean);
  const sx = pose.ox + shx0 * cl + shy0 * sl, sy = hipY + pose.bob - shy0 * cl + shx0 * sl * 0;

  // shield on the back while it is not raised
  if (pose.shield !== 'none' && !pose.guard) {
    ctx.save();
    ctx.translate(sx - 20, sy + 46); ctx.rotate(-0.25);
    drawShield(ctx, pose.shield, pose.shield === 'tower' ? 0.5 : 0.6);
    ctx.restore();
  }

  // weapon slung over the shoulder while it is not being swung
  const hasW = pose.weapon && pose.weapon !== 'fists';
  if (hasW && WEAPONS[pose.weapon].len > 0 && !(pose.wield && pose.limb === 1)) {
    ctx.save();
    ctx.translate(sx - 4, sy + 14); ctx.rotate(-2.3); ctx.scale(0.8, 0.8);
    drawWeapon(ctx, pose.weapon, WEAPONS[pose.weapon].len, pose.t);
    ctx.restore();
  }

  // torso sprite
  ctx.save();
  ctx.translate(pose.ox, hipY + pose.bob);
  ctx.rotate(pose.lean);
  ctx.scale(pose.sx, pose.sy);
  const ex = sp.extend, eh = ex ? ex.h : 0;
  if (ex) drawExtension(ctx, ex);
  const ix = -sp.pivotX * scale, iy = -sp.pivotY * scale - eh;
  ctx.drawImage(img, ix, iy, w, h);
  if (pose.hurt > 0) { ctx.globalAlpha = alpha * pose.hurt; ctx.drawImage(sprite.hurt, ix, iy, w, h); }
  if (pose.flash > 0) { ctx.globalAlpha = alpha * pose.flash * 0.8; ctx.drawImage(sprite.flash, ix, iy, w, h); }
  ctx.restore();
  ctx.globalAlpha = alpha;

  // front leg when kicking is drawn on top of the torso
  if (pose.limb === 2) drawLeg(ctx, b, hx + 6, hy, pose.ffx, pose.ffy, false);

  // arms
  const a = b.arm;
  const shoulderY = sy;
  if (pose.guard) {
    const crouch = pose.hipH < b.legLen * 0.6;
    const gy = shoulderY - 26 + (crouch ? 14 : 0);
    drawArm(ctx, a, sx - 4, shoulderY + 2, 38, gy + 10, true);
    drawArm(ctx, a, sx, shoulderY, 46, gy - 6, false);
    if (pose.shield !== 'none') {                    // the shield is held up in front
      ctx.save();
      ctx.translate(64 + Math.sin(pose.t * 2.2) * (pose.hurt ? 2 : 0), shoulderY + (crouch ? 40 : 24) + (pose.shield === 'tower' ? 12 : 0));
      drawShield(ctx, pose.shield, pose.shield === 'tower' ? 1.2 : 1.35);
      ctx.restore();
    }
  } else if (pose.pump) {
    drawArm(ctx, a, sx, shoulderY, 34, shoulderY - 74 + Math.sin(f.t * 0.2) * 8, false);
  } else if (pose.grab) {
    drawArm(ctx, a, sx, shoulderY, 70, shoulderY + 6, false);
    drawArm(ctx, a, sx - 4, shoulderY + 2, 56, shoulderY + 22, true);
  } else if (pose.limb === 1) {
    drawArm(ctx, a, sx, shoulderY, pose.ltx, pose.lty, false);
    if (hasW && pose.wield) {
      ctx.save();
      ctx.translate(HAND.x, HAND.y);
      // raised during the wind-up, brought down through the swing
      const e = pose.ext, tilt = e < 0 ? -1.3 * Math.min(1, -e / 0.22) : (1 - e) * -1.0 + e * 0.22;
      ctx.rotate(tilt);
      drawWeapon(ctx, pose.weapon, pose.wlen, pose.t);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawGhosts(ctx, effects, sprites) {
  for (const g of effects.ghosts) {
    if (!g.on) continue;
    const a = 0.38 * (g.life / g.max);
    drawFighter(ctx, g.f, sprites(g.f), g.snap, a, null);
  }
}

export function drawTag(ctx, f, label, color) {
  const top = f.state === 'down' ? 90 : (f.cfg.body.hurtH + 22);
  const y = f.y - top + Math.sin(f.t * 0.1) * 2;
  ctx.save();
  ctx.translate(f.x, y);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(8, -6); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
  ctx.font = '800 15px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.75)';
  ctx.strokeText(label, 0, -12); ctx.fillText(label, 0, -12);
  ctx.restore();
}
