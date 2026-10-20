import { VIEW_W, VIEW_H, GROUND, WORLD_W } from './config.js';
import { settings } from './settings.js';

// Arenas are drawn procedurally (no external art). Static layers are pre-rendered once into
// offscreen canvases; animated bits (rain, lamps, crowd, rings) are drawn per frame.

const LAYER_W = 2200;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function layer(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  return c;
}

/** Draw a parallax layer: factor 0 = fixed to screen, 1 = moves with the world. */
function drawLayer(ctx, img, camX, factor, dy = 0, zoom = 1) {
  const x = -camX * factor * zoom - (LAYER_W - VIEW_W) * 0.0;
  ctx.drawImage(img, Math.round(x), dy);
}

// ======================================================================= NEON CITY
function makeNeon() {
  const R = rng(11);
  const sky = layer(VIEW_W, VIEW_H, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#07031a'); g.addColorStop(0.45, '#2a0b52'); g.addColorStop(0.72, '#8a1f78'); g.addColorStop(1, '#ff5a8a');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      c.globalAlpha = 0.2 + R() * 0.7; c.fillStyle = '#fff';
      c.fillRect(R() * w, R() * h * 0.55, 1 + R() * 1.6, 1 + R() * 1.6);
    }
    c.globalAlpha = 1;
  });
  const moon = layer(500, 500, (c) => {
    const g = c.createRadialGradient(250, 250, 30, 250, 250, 250);
    g.addColorStop(0, 'rgba(255,230,255,1)'); g.addColorStop(0.25, 'rgba(255,170,235,.5)'); g.addColorStop(1, 'rgba(255,100,200,0)');
    c.fillStyle = g; c.fillRect(0, 0, 500, 500);
    c.fillStyle = '#ffe9ff'; c.beginPath(); c.arc(250, 250, 62, 0, 7); c.fill();
    c.fillStyle = 'rgba(200,150,220,.5)'; c.beginPath(); c.arc(235, 240, 14, 0, 7); c.arc(270, 270, 9, 0, 7); c.fill();
  });
  const skyline = (seed, col, minH, maxH, bw0, bw1, windows, glow) => layer(LAYER_W, VIEW_H, (c) => {
    const r = rng(seed);
    let x = -20;
    while (x < LAYER_W) {
      const bw = bw0 + r() * (bw1 - bw0), bh = minH + r() * (maxH - minH);
      const y = 560 - bh;
      c.fillStyle = col; c.fillRect(x, y, bw, bh + 200);
      if (r() < 0.4) { c.fillRect(x + bw * 0.4, y - 30, 6, 30); c.fillStyle = '#ff3355'; c.fillRect(x + bw * 0.4 - 1, y - 34, 8, 4); c.fillStyle = col; }
      for (let wy = y + 12; wy < 560; wy += 14) {
        for (let wx = x + 8; wx < x + bw - 8; wx += 12) {
          if (r() < windows) {
            const k = r();
            c.fillStyle = k < 0.5 ? '#ffd86b' : k < 0.8 ? '#6be6ff' : '#ff6bd6';
            c.globalAlpha = 0.35 + r() * 0.5; c.fillRect(wx, wy, 5, 7); c.globalAlpha = 1;
          }
        }
      }
      if (glow && r() < 0.5) {
        const nc = ['#ff2fd0', '#2fe0ff', '#ffb02f'][(r() * 3) | 0];
        c.shadowColor = nc; c.shadowBlur = 18; c.fillStyle = nc;
        c.fillRect(x + 6, y + 40 + r() * 60, 5, 60 + r() * 60);
        c.shadowBlur = 0;
      }
      x += bw + 4 + r() * 10;
    }
  });
  const far = skyline(21, '#1b0d3b', 160, 360, 70, 140, 0.3, false);
  const mid = skyline(33, '#10082a', 200, 420, 90, 170, 0.22, true);
  const signs = [];
  for (let i = 0; i < 9; i++) signs.push({ x: 120 + i * 230 + R() * 60, y: 250 + R() * 120, w: 90 + R() * 60, h: 32, c: ['#ff2fd0', '#2fe0ff', '#ffb02f', '#7bff6b'][i % 4], ph: R() * 6 });
  const rain = Array.from({ length: 110 }, () => ({ x: R() * VIEW_W * 1.3, y: R() * VIEW_H, v: 14 + R() * 10, l: 10 + R() * 14 }));
  const floorGrad = [['#1a0d2e', 0], ['#0c0618', 1]];

  return {
    drawBack(ctx, camX, zoom, t, dy) {
      ctx.drawImage(sky, 0, 0);
      ctx.drawImage(moon, 780 - camX * 0.04, 40 + dy * 0.2);
      drawLayer(ctx, far, camX, 0.18, dy, zoom);
      drawLayer(ctx, mid, camX, 0.38, dy, zoom);
      // flickering neon signs
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of signs) {
        const x = s.x - camX * 0.52, f = 0.65 + 0.35 * Math.sin(t * 3 + s.ph) * (Math.sin(t * 0.7 + s.ph) > 0.85 ? 0.2 : 1);
        ctx.globalAlpha = 0.45 * f;
        ctx.shadowColor = s.c; ctx.shadowBlur = 24; ctx.strokeStyle = s.c; ctx.lineWidth = 4;
        ctx.strokeRect(x, s.y + dy, s.w, s.h);
        ctx.fillStyle = s.c; ctx.globalAlpha = 0.12 * f; ctx.fillRect(x, s.y + dy, s.w, s.h);
      }
      ctx.restore();
      // haze before floor
      const g = ctx.createLinearGradient(0, 470 + dy, 0, 640 + dy);
      g.addColorStop(0, 'rgba(255,80,160,0)'); g.addColorStop(1, 'rgba(255,80,160,.25)');
      ctx.fillStyle = g; ctx.fillRect(0, 470 + dy, VIEW_W, 200);
    },
    drawFloor(ctx, t) {
      const g = ctx.createLinearGradient(0, GROUND, 0, GROUND + 180);
      g.addColorStop(0, '#22123a'); g.addColorStop(1, '#07030f');
      ctx.fillStyle = g; ctx.fillRect(-300, GROUND, WORLD_W + 600, 260);
      // wet reflections
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 18; i++) {
        const x = i * 110 + 20, col = ['#ff2fd0', '#2fe0ff', '#ffb02f'][i % 3];
        const gg = ctx.createLinearGradient(0, GROUND, 0, GROUND + 90);
        gg.addColorStop(0, col + '55'); gg.addColorStop(1, col + '00');
        ctx.fillStyle = gg; ctx.fillRect(x, GROUND, 34 + (i % 4) * 16, 90);
      }
      ctx.restore();
      ctx.fillStyle = '#ff4fc8'; ctx.globalAlpha = 0.9; ctx.fillRect(-300, GROUND, WORLD_W + 600, 3);
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#fff';
      for (let x = -200; x < WORLD_W + 200; x += 180) ctx.fillRect(x, GROUND + 56, 90, 4);
      ctx.globalAlpha = 1;
    },
    drawFront(ctx, camX, t, dt) {
      if (settings.reducedFx) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(190,210,255,.35)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const r of rain) {
        r.y += r.v; r.x -= 3;
        if (r.y > VIEW_H) { r.y = -20; r.x = Math.random() * VIEW_W * 1.3; }
        if (r.x < -20) r.x += VIEW_W * 1.3;
        ctx.moveTo(r.x, r.y); ctx.lineTo(r.x - 2, r.y + r.l);
      }
      ctx.stroke();
      ctx.restore();
    },
  };
}

// ======================================================================= UNDERGROUND PIT
function makeUnderground() {
  const R = rng(77);
  const wall = layer(VIEW_W, VIEW_H, (c, w, h) => {
    c.fillStyle = '#1a0f0d'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < 640; y += 26) {
      for (let x = (y / 26) % 2 ? -30 : 0; x < w; x += 70) {
        const v = 20 + R() * 22;
        c.fillStyle = `rgb(${v + 22},${v * 0.55 + 8},${v * 0.45 + 6})`;
        c.fillRect(x + 2, y + 2, 66, 22);
      }
    }
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(0,0,0,.85)'); g.addColorStop(0.5, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,.4)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    // pipes
    c.fillStyle = '#2d2623'; c.fillRect(0, 70, w, 22); c.fillStyle = '#4a3e38'; c.fillRect(0, 74, w, 5);
    c.fillStyle = '#2d2623'; c.fillRect(0, 110, w, 12);
  });
  const crowd = [0, 1].map((frame) => layer(LAYER_W, 330, (c) => {
    const r = rng(5);
    for (let row = 0; row < 3; row++) {
      for (let x = -30 + row * 25; x < LAYER_W; x += 62 + r() * 22) {
        const bob = (r() < 0.5 ? frame : 1 - frame) * (6 + row * 2) * (r() < 0.6 ? 1 : 0.3);
        const y = 150 + row * 55 - bob, s = 0.9 + row * 0.12;
        const sh = 14 + row * 6;
        c.fillStyle = `rgb(${10 + row * 6},${7 + row * 4},${9 + row * 4})`;
        c.beginPath(); c.arc(x, y, 17 * s, 0, 7); c.fill();
        c.fillRect(x - 28 * s, y + 14 * s, 56 * s, 130);
        if (r() < 0.25 && frame) { c.fillRect(x + 20 * s, y - 40 - sh, 9, 60); c.beginPath(); c.arc(x + 24 * s, y - 44 - sh, 8, 0, 7); c.fill(); }
      }
    }
  }));
  const fence = layer(LAYER_W, VIEW_H, (c) => {
    c.strokeStyle = 'rgba(120,120,130,.45)'; c.lineWidth = 2;
    c.beginPath();
    for (let x = -700; x < LAYER_W + 700; x += 38) { c.moveTo(x, 160); c.lineTo(x + 520, 640); c.moveTo(x + 520, 160); c.lineTo(x, 640); }
    c.stroke();
    c.fillStyle = '#2a2a30'; c.fillRect(0, 150, LAYER_W, 12); c.fillRect(0, 636, LAYER_W, 8);
    c.fillStyle = '#3a3a42'; for (let x = 0; x < LAYER_W; x += 260) c.fillRect(x, 150, 10, 495);
  });
  const lamps = [250, 760, 1270, 1780].map((x, i) => ({ x, ph: i }));
  const steam = Array.from({ length: 14 }, () => ({ x: R() * 1300, y: 560 + R() * 160, r: 30 + R() * 50, v: 0.3 + R() * 0.5, a: R() }));
  return {
    drawBack(ctx, camX, zoom, t, dy) {
      ctx.drawImage(wall, 0, dy);
      const fr = ((t * 2.6) | 0) % 2;
      ctx.drawImage(crowd[fr], Math.round(-camX * 0.22), 260 + dy);
      // lamp cones
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const l of lamps) {
        const sw = Math.sin(t * 1.1 + l.ph) * 0.09;
        const x = l.x - camX * 0.5;
        ctx.save(); ctx.translate(x, 0 + dy); ctx.rotate(sw);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 150); ctx.stroke();
        const g = ctx.createLinearGradient(0, 150, 0, 650);
        g.addColorStop(0, 'rgba(255,200,120,.38)'); g.addColorStop(1, 'rgba(255,170,90,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-16, 156); ctx.lineTo(16, 156); ctx.lineTo(230, 650); ctx.lineTo(-230, 650); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffd9a0'; ctx.beginPath(); ctx.ellipse(0, 156, 22, 9, 0, 0, 7); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      drawLayer(ctx, fence, camX, 0.62, dy, zoom);
    },
    drawFloor(ctx, t) {
      const g = ctx.createLinearGradient(0, GROUND, 0, GROUND + 160);
      g.addColorStop(0, '#3b3230'); g.addColorStop(1, '#120d0c');
      ctx.fillStyle = g; ctx.fillRect(-300, GROUND, WORLD_W + 600, 260);
      ctx.fillStyle = '#6a5d58'; ctx.fillRect(-300, GROUND, WORLD_W + 600, 4);
      // painted ring marks
      ctx.strokeStyle = 'rgba(200,40,40,.55)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(WORLD_W / 2, GROUND + 52, 520, 34, 0, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(WORLD_W / 2, GROUND + 52, 140, 14, 0, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2;
      for (let x = -200; x < WORLD_W + 200; x += 150) { ctx.beginPath(); ctx.moveTo(x, GROUND + 6); ctx.lineTo(x - 40, GROUND + 130); ctx.stroke(); }
      // light pool
      const lg = ctx.createRadialGradient(WORLD_W / 2, GROUND + 30, 20, WORLD_W / 2, GROUND + 30, 700);
      lg.addColorStop(0, 'rgba(255,190,110,.22)'); lg.addColorStop(1, 'rgba(255,190,110,0)');
      ctx.fillStyle = lg; ctx.fillRect(-300, GROUND, WORLD_W + 600, 220);
    },
    drawFront(ctx, camX, t) {
      if (settings.reducedFx) return;
      ctx.save();
      for (const s of steam) {
        s.y -= s.v * 0.4; s.x += 0.2;
        if (s.y < 440) { s.y = 700; s.x = Math.random() * 1300; }
        if (s.x > 1400) s.x = -80;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
        g.addColorStop(0, `rgba(210,200,195,${0.08 * (0.5 + s.a)})`); g.addColorStop(1, 'rgba(210,200,195,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill();
      }
      ctx.restore();
    },
  };
}

// ======================================================================= FUTURE STAGE
function makeFuture() {
  const R = rng(303);
  const space = layer(VIEW_W, VIEW_H, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#02030c'); g.addColorStop(0.6, '#0a1236'); g.addColorStop(1, '#143a78');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x = R() * w, y = R() * 400, r = 160 + R() * 200;
      const n = c.createRadialGradient(x, y, 0, x, y, r);
      const col = ['120,60,255', '40,160,255', '255,60,160', '40,255,200'][i];
      n.addColorStop(0, `rgba(${col},.22)`); n.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = n; c.fillRect(0, 0, w, h);
    }
  });
  const stars = Array.from({ length: 120 }, () => ({ x: R() * VIEW_W, y: R() * 480, s: 0.5 + R() * 1.8, ph: R() * 6 }));
  const planet = layer(700, 700, (c) => {
    const g = c.createRadialGradient(260, 240, 30, 350, 350, 300);
    g.addColorStop(0, '#6fe0ff'); g.addColorStop(0.5, '#2a5fd0'); g.addColorStop(1, '#0a1240');
    c.fillStyle = g; c.beginPath(); c.arc(350, 350, 250, 0, 7); c.fill();
    c.globalAlpha = 0.25; c.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) { c.beginPath(); c.ellipse(350, 250 + i * 28, 240 - Math.abs(i - 3.5) * 22, 6, 0, 0, 7); c.fill(); }
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(190,230,255,.7)'; c.lineWidth = 8;
    c.beginPath(); c.ellipse(350, 360, 340, 70, -0.25, 0.05 * Math.PI, 0.95 * Math.PI); c.stroke();
    c.strokeStyle = 'rgba(120,180,255,.4)'; c.lineWidth = 16;
    c.beginPath(); c.ellipse(350, 360, 310, 62, -0.25, 0.05 * Math.PI, 0.95 * Math.PI); c.stroke();
  });
  const towers = layer(LAYER_W, VIEW_H, (c) => {
    const r = rng(9);
    for (let x = 0; x < LAYER_W; x += 60 + r() * 70) {
      const h = 120 + r() * 300, w = 24 + r() * 40, y = 570 - h;
      c.fillStyle = 'rgba(12,28,70,.85)'; c.fillRect(x, y, w, h + 60);
      c.strokeStyle = 'rgba(80,220,255,.65)'; c.lineWidth = 2; c.strokeRect(x + .5, y + .5, w, h);
      c.fillStyle = 'rgba(80,220,255,.5)';
      for (let k = 0; k < h / 18; k++) if (r() < 0.5) c.fillRect(x + 5, y + 8 + k * 18, w - 10, 3);
      c.fillStyle = '#7fffe0'; c.fillRect(x + w / 2 - 1, y - 14, 3, 14);
    }
  });
  const motes = Array.from({ length: 40 }, () => ({ x: R() * VIEW_W, y: R() * 600, v: 0.2 + R() * 0.6, s: 1 + R() * 2 }));
  return {
    drawBack(ctx, camX, zoom, t, dy) {
      ctx.drawImage(space, 0, 0);
      ctx.fillStyle = '#fff';
      for (const s of stars) { ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + s.ph)); ctx.fillRect(s.x - camX * 0.03, s.y, s.s, s.s); }
      ctx.globalAlpha = 1;
      ctx.drawImage(planet, 560 - camX * 0.06, 20 + dy * 0.3);
      drawLayer(ctx, towers, camX, 0.25, dy, zoom);
      // rotating hologram rings behind the arena
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const cx = 640 - camX * 0.5 + 400, cy = 330 + dy;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = ['#2fe0ff', '#7a5cff', '#ff4fd0'][i]; ctx.lineWidth = 3; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.ellipse(cx, cy, 210 + i * 46, (60 + i * 18) * (0.6 + 0.4 * Math.sin(t * 0.7 + i)), t * 0.25 * (i % 2 ? -1 : 1), 0, 7); ctx.stroke();
      }
      ctx.restore();
      const g = ctx.createLinearGradient(0, 470 + dy, 0, 640 + dy);
      g.addColorStop(0, 'rgba(60,160,255,0)'); g.addColorStop(1, 'rgba(60,160,255,.28)');
      ctx.fillStyle = g; ctx.fillRect(0, 470 + dy, VIEW_W, 200);
    },
    drawFloor(ctx, t) {
      const g = ctx.createLinearGradient(0, GROUND, 0, GROUND + 160);
      g.addColorStop(0, '#12254a'); g.addColorStop(1, '#050a1c');
      ctx.fillStyle = g; ctx.fillRect(-300, GROUND, WORLD_W + 600, 260);
      ctx.save();
      ctx.strokeStyle = 'rgba(70,220,255,.6)'; ctx.lineWidth = 2;
      for (let i = 1; i < 5; i++) { const y = GROUND + i * i * 6 + 4; ctx.globalAlpha = 0.55 - i * 0.08; ctx.beginPath(); ctx.moveTo(-300, y); ctx.lineTo(WORLD_W + 300, y); ctx.stroke(); }
      ctx.globalAlpha = 0.4;
      const vp = WORLD_W / 2;
      for (let x = -1200; x < WORLD_W + 1200; x += 120) { ctx.beginPath(); ctx.moveTo(x, GROUND + 4); ctx.lineTo(vp + (x - vp) * 2.1, GROUND + 160); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = '#4fe6ff'; ctx.fillRect(-300, GROUND, WORLD_W + 600, 3);
      // travelling light pulses
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = ((t * 240 + i * 520) % (WORLD_W + 400)) - 200;
        const lg = ctx.createLinearGradient(x - 90, 0, x + 90, 0);
        lg.addColorStop(0, 'rgba(80,230,255,0)'); lg.addColorStop(0.5, 'rgba(120,240,255,.8)'); lg.addColorStop(1, 'rgba(80,230,255,0)');
        ctx.fillStyle = lg; ctx.fillRect(x - 90, GROUND - 1, 180, 5);
      }
      ctx.restore();
    },
    drawFront(ctx, camX, t) {
      if (settings.reducedFx) return;
      ctx.save();
      ctx.fillStyle = 'rgba(160,240,255,.7)';
      for (const m of motes) {
        m.y -= m.v; if (m.y < 0) { m.y = 640; m.x = Math.random() * VIEW_W; }
        ctx.globalAlpha = 0.3 + 0.4 * Math.sin(t * 2 + m.x);
        ctx.fillRect(m.x, m.y, m.s, m.s);
      }
      ctx.restore();
    },
  };
}

const cache = {};
export function getArena(id) {
  if (!cache[id]) cache[id] = id === 'underground' ? makeUnderground() : id === 'future' ? makeFuture() : makeNeon();
  return cache[id];
}
