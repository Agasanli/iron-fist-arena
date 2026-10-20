import { settings } from '../game/settings.js';

const N = 600;

/** Pooled particle / spark / ring / floating text system. No allocation after construction. */
export class Effects {
  constructor() {
    this.p = Array.from({ length: N }, () => ({
      on: false, type: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, color: '#fff', grav: 0, text: '', rot: 0, a: 1, drag: 1,
    }));
    this.i = 0;
    this.ghosts = Array.from({ length: 14 }, () => ({ on: false, life: 0, max: 1, x: 0, y: 0, f: null, snap: null, color: '' }));
    this.gi = 0;
  }

  clear() {
    for (const p of this.p) p.on = false;
    for (const g of this.ghosts) g.on = false;
  }

  _get() {
    for (let k = 0; k < N; k++) {
      this.i = (this.i + 1) % N;
      if (!this.p[this.i].on) return this.p[this.i];
    }
    return this.p[(this.i = (this.i + 1) % N)];
  }

  // type ids: 0 dot, 1 spark, 2 ring, 3 text, 4 slash, 5 glow
  add(type, x, y, vx, vy, life, size, color, grav = 0, extra) {
    const p = this._get();
    p.on = true; p.type = type; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size;
    p.color = color; p.grav = grav; p.rot = extra || 0; p.a = 1; p.drag = 1; p.text = '';
    return p;
  }

  fxScale() { return settings.reducedFx ? 0.35 : 1; }

  spark(x, y, color, power = 1, facing = 1) {
    const s = this.fxScale();
    const q = this.add(1, x, y, 0, 0, 12, 34 + 26 * power, color, 0, Math.random() * 3);
    q.drag = facing;
    if (!settings.reducedFx) this.add(5, x, y, 0, 0, 9, 52 + 30 * power, '#ffffff');
    const n = Math.round((5 + 6 * power) * s);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 7 * (0.6 + power * 0.5);
      this.add(0, x, y, Math.cos(a) * v + facing * 2, Math.sin(a) * v - 1, 16 + Math.random() * 12, 2 + Math.random() * 3, color, 0.18);
    }
  }

  blockSpark(x, y) {
    this.add(2, x, y, 0, 0, 12, 40, '#7fd0ff');
    const n = Math.round(7 * this.fxScale());
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 2 + Math.random() * 5;
      this.add(0, x, y, Math.cos(a) * v, Math.sin(a) * v, 14, 2 + Math.random() * 2, '#bfe9ff', 0.1);
    }
  }

  dust(x, y, n = 4) {
    n = Math.max(1, Math.round(n * this.fxScale()));
    for (let i = 0; i < n; i++) {
      this.add(0, x + (Math.random() - 0.5) * 40, y - 2, (Math.random() - 0.5) * 2.6, -Math.random() * 1.4, 24 + Math.random() * 14,
        5 + Math.random() * 7, 'rgba(210,205,200,0.55)', -0.01);
    }
  }

  ring(x, y, size, color, life = 22) {
    this.add(2, x, y, 0, 0, life, size, color);
  }

  text(x, y, str, color, size = 28) {
    const p = this.add(3, x, y, 0, -1.6, 46, size, color);
    p.text = str; p.drag = 0.96;
  }

  slash(x, y, len, color, rot) {
    this.add(4, x, y, 0, 0, 10, len, color, 0, rot);
  }

  burst(x, y, n, color, speed = 8, life = 30, size = 4) {
    n = Math.max(1, Math.round(n * this.fxScale()));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = Math.random() * speed;
      this.add(0, x, y, Math.cos(a) * v, Math.sin(a) * v - 2, life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random()), color, 0.2);
    }
  }

  ghost(f, snap, color) {
    if (settings.reducedFx) return;
    const g = this.ghosts[this.gi = (this.gi + 1) % this.ghosts.length];
    g.on = true; g.life = 14; g.max = 14; g.f = f; g.color = color;
    g.x = f.x; g.y = f.y; g.facing = f.facing;
    if (!g.snap) g.snap = {};
    Object.assign(g.snap, snap);
  }

  update() {
    for (let k = 0; k < N; k++) {
      const p = this.p[k];
      if (!p.on) continue;
      if (--p.life <= 0) { p.on = false; continue; }
      p.x += p.vx; p.y += p.vy;
      p.vy += p.grav;
      if (p.type === 3) p.vx *= p.drag, p.vy *= p.drag;
    }
    for (const g of this.ghosts) if (g.on && --g.life <= 0) g.on = false;
  }

  draw(ctx) {
    for (let k = 0; k < N; k++) {
      const p = this.p[k];
      if (!p.on) continue;
      const t = p.life / p.max;      // 1 -> 0
      switch (p.type) {
        case 0:
          ctx.globalAlpha = Math.min(1, t * 1.6);
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + t * 0.6), 0, 7); ctx.fill();
          break;
        case 1: {
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = Math.min(1, t * 2);
          ctx.strokeStyle = p.color; ctx.lineCap = 'round';
          const L = p.size * (1.15 - t * 0.5);
          ctx.lineWidth = 3 + 4 * t;
          ctx.beginPath();
          for (let s = 0; s < 8; s++) {
            const a = s * Math.PI / 4, l = (s % 2 ? 0.55 : 1) * L;
            ctx.moveTo(Math.cos(a) * l * 0.25, Math.sin(a) * l * 0.25);
            ctx.lineTo(Math.cos(a) * l, Math.sin(a) * l);
          }
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 2:
          ctx.globalAlpha = t;
          ctx.strokeStyle = p.color; ctx.lineWidth = 2 + 6 * t;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, p.size * (1 - t * t) + 4, (p.size * (1 - t * t) + 4) * 0.32, 0, 0, 7); ctx.stroke();
          break;
        case 3:
          ctx.globalAlpha = Math.min(1, t * 2.5);
          ctx.font = `900 ${p.size}px Impact, "Arial Black", sans-serif`;
          ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.8)';
          ctx.strokeText(p.text, p.x, p.y);
          ctx.fillStyle = p.color; ctx.fillText(p.text, p.x, p.y);
          break;
        case 4:
          ctx.save();
          ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = t; ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(-p.size, 0); ctx.quadraticCurveTo(0, -12 * t - 4, p.size, 0); ctx.quadraticCurveTo(0, 6 * t, -p.size, 0);
          ctx.fill();
          ctx.restore();
          break;
        case 5: {
          ctx.globalAlpha = t;
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
          ctx.globalCompositeOperation = 'source-over';
          break;
        }
        default:
      }
    }
    ctx.globalAlpha = 1;
  }
}
