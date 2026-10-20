/** A travelling hitbox (energy orb, etc). Pooled by the Match to avoid per-hit allocations. */
export class Projectile {
  constructor() { this.active = false; this.rect = { x0: 0, x1: 0, y0: 0, y1: 0 }; }

  spawn(owner, def) {
    this.active = true;
    this.owner = owner;
    this.def = def;
    this.dir = owner.facing;
    this.x = owner.x + owner.facing * def.x;
    this.y = owner.y - def.y;
    this.px = this.x;
    this.vx = owner.facing * def.vx;
    this.life = def.life;
    this.age = 0;
    this.color = owner.cfg.color;
    return this;
  }

  update() {
    this.px = this.x;
    this.x += this.vx;
    this.age++;
    if (--this.life <= 0) this.active = false;
    if (this.x < -100 || this.x > 1900) this.active = false;
  }

  /** swept rectangle (previous -> current position) so fast shots never tunnel */
  getRect() {
    const d = this.def, r = this.rect;
    const a = Math.min(this.px, this.x) - d.w / 2, b = Math.max(this.px, this.x) + d.w / 2;
    r.x0 = a; r.x1 = b; r.y0 = this.y - d.h / 2; r.y1 = this.y + d.h / 2;
    return r;
  }

  draw(ctx, t) {
    const st = this.def.style;
    if (st === 'wave') return this.drawWave(ctx);
    if (st === 'flash') return this.drawFlash(ctx);
    if (st === 'sphere') return this.drawSphere(ctx);
    if (st === 'laser') return this.drawLaser(ctx);
    if (st === 'pizza') return this.drawPizza(ctx);
    this.drawContract(ctx);
  }

  /** Vusal: expanding sonic arcs */
  drawWave(ctx) {
    const d = this.def, dir = this.dir, p = this.age;
    ctx.save();
    ctx.translate(this.x, this.y); ctx.scale(dir, 1);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const ph = ((p * 0.07 + i * 0.25) % 1), r = 18 + ph * 62;
      ctx.globalAlpha = (1 - ph) * 0.9;
      ctx.strokeStyle = i % 2 ? '#fff0c8' : '#ffb347';
      ctx.lineWidth = 7 - ph * 4;
      ctx.beginPath(); ctx.arc(-34 + ph * 20, 0, r, -0.95, 0.95); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, d.h * 0.6);
    g.addColorStop(0, 'rgba(255,240,200,.9)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, d.h * 0.6, 0, 7); ctx.fill();
    ctx.restore();
  }

  /** Fatima: camera flash */
  drawFlash(ctx) {
    const p = this.age, dir = this.dir;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 4; i > 0; i--) {
      ctx.globalAlpha = 0.1 * (5 - i);
      ctx.fillStyle = '#ff9fd6';
      ctx.beginPath(); ctx.ellipse(-dir * i * 16, 0, 22, 9, 0, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 40);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, 'rgba(255,190,235,.85)'); g.addColorStop(1, 'rgba(200,80,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 40, 0, 7); ctx.fill();
    ctx.rotate(p * 0.25);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.moveTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.lineTo(Math.cos(a) * 34, Math.sin(a) * 34); }
    ctx.stroke();
    ctx.restore();
  }

  /** Emin: twin laser beam from the glasses */
  drawLaser(ctx) {
    const d = this.def, dir = this.dir;
    ctx.save();
    ctx.translate(this.x, this.y); ctx.scale(dir, 1);
    ctx.globalCompositeOperation = 'lighter';
    const L = d.w;
    const g = ctx.createLinearGradient(-L, 0, L * 0.5, 0);
    g.addColorStop(0, 'rgba(80,160,255,0)'); g.addColorStop(0.7, 'rgba(120,220,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.fillRect(-L, -9, L * 1.5, 18);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillRect(-L * 0.7, -3, L * 1.2, 6);
    const h = ctx.createRadialGradient(L * 0.5, 0, 1, L * 0.5, 0, 26);
    h.addColorStop(0, '#fff'); h.addColorStop(1, 'rgba(90,180,255,0)');
    ctx.fillStyle = h; ctx.beginPath(); ctx.arc(L * 0.5, 0, 26, 0, 7); ctx.fill();
    ctx.restore();
  }

  /** Vakil: a spinning pizza */
  drawPizza(ctx) {
    const d = this.def, p = this.age, dir = this.dir, r = d.w * 0.5;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 4; i > 0; i--) { ctx.globalAlpha = 0.07 * (5 - i); ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.arc(-dir * i * 18, 0, r * (1 - i * 0.1), 0, 7); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.rotate(p * 0.3 * dir);
    ctx.fillStyle = '#d99a3b'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();         // crust
    ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, 7); ctx.fill();   // cheese
    ctx.fillStyle = '#d23a2a';
    for (let i = 0; i < 7; i++) { const a = i * 0.9; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.15, 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(160,90,20,.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 4; ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85); ctx.lineTo(-Math.cos(a) * r * 0.85, -Math.sin(a) * r * 0.85); } ctx.stroke();
    ctx.restore();
  }

  /** Zaur's ultimate: a heavy dark sphere with a golden ring */
  drawSphere(ctx) {
    const d = this.def, p = this.age, dir = this.dir, r = d.w * 0.5;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 6; i > 0; i--) {
      ctx.globalAlpha = 0.07 * (7 - i);
      ctx.fillStyle = '#7a5cff';
      ctx.beginPath(); ctx.arc(-dir * i * 22, 0, r * (1 - i * 0.08), 0, 7); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 4, 0, 0, r);
    g.addColorStop(0, '#6f7cff'); g.addColorStop(0.55, '#1a1f6a'); g.addColorStop(1, '#07081f');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 6;
    ctx.save(); ctx.rotate(p * 0.12 * dir); ctx.scale(1, 0.32);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.18, 0, 7); ctx.stroke(); ctx.restore();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(190,170,255,.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, r + 4 + Math.sin(p * 0.4) * 3, 0, 7); ctx.stroke();
    ctx.restore();
  }

  drawContract(ctx) {
    const d = this.def, p = this.age;
    const x = this.x, y = this.y, dir = this.dir;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = 'lighter';
    // trail
    for (let i = 5; i > 0; i--) {
      ctx.globalAlpha = 0.09 * (6 - i);
      ctx.fillStyle = '#6fe3ff';
      ctx.beginPath();
      ctx.ellipse(-dir * i * 12, 0, d.w * 0.35, d.h * 0.28 * (1 - i * 0.1), 0, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, d.w * 0.6);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#7fe0ff'); g.addColorStop(1, 'rgba(30,110,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, d.w * 0.6, 0, 7); ctx.fill();
    // spinning "contract" sheets
    ctx.globalCompositeOperation = 'source-over';
    ctx.rotate(p * 0.35 * dir);
    ctx.fillStyle = '#f5fbff';
    ctx.fillRect(-13, -17, 26, 34);
    ctx.fillStyle = '#2f6bff';
    ctx.fillRect(-9, -12, 18, 3); ctx.fillRect(-9, -6, 14, 3); ctx.fillRect(-9, 0, 18, 3);
    ctx.fillStyle = '#d33';
    ctx.beginPath(); ctx.arc(5, 11, 4, 0, 7); ctx.fill();
    ctx.restore();
  }
}
