import { CHARACTERS } from '../entities/characters.js';

// Processed sprite store: normal / white-flash / red-hurt / recoloured (mirror matches) + portrait.
const store = {};

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function hasTransparency(c) {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const w = c.width, h = c.height;
  const pts = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3], [w >> 1, 2]];
  let t = 0;
  for (const [x, y] of pts) if (ctx.getImageData(x, y, 1, 1).data[3] < 20) t++;
  return t >= 3;
}

/** Fallback for plain-background art: flood-fill the background from the borders. */
export function removePlainBackground(c, tol = 40) {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const w = c.width, h = c.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const corner = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const cs = [corner(1, 1), corner(w - 2, 1), corner(1, h - 2), corner(w - 2, h - 2)];
  const ref = [0, 1, 2].map((k) => cs.reduce((s, c2) => s + c2[k], 0) / 4);
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (seen[p]) return;
    const i = p * 4;
    const diff = Math.abs(d[i] - ref[0]) + Math.abs(d[i + 1] - ref[1]) + Math.abs(d[i + 2] - ref[2]);
    if (diff > tol) return;
    seen[p] = 1; stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop(), x = p % w, y = (p / w) | 0;
    d[p * 4 + 3] = 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tinted(src, color) {
  const c = makeCanvas(src.width, src.height);
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

function recolour(src, filter) {
  const c = makeCanvas(src.width, src.height);
  const x = c.getContext('2d');
  if ('filter' in x) x.filter = filter;
  x.drawImage(src, 0, 0);
  return c;
}

function placeholder(cfg) {
  const c = makeCanvas(300, 560);
  const x = c.getContext('2d');
  x.fillStyle = cfg.color; x.beginPath(); x.arc(150, 80, 60, 0, 7); x.fill();
  x.fillRect(70, 150, 160, 400);
  x.fillStyle = '#000'; x.font = '28px sans-serif'; x.textAlign = 'center'; x.fillText(cfg.name, 150, 300);
  return c;
}

function portraitOf(c, face) {
  const p = makeCanvas(160, 160);
  const x = p.getContext('2d');
  const s = Math.max(face.w, face.h);
  x.imageSmoothingQuality = 'high';
  x.drawImage(c, face.x - (s - face.w) / 2, face.y - (s - face.h) / 2, s, s, 0, 0, 160, 160);
  return p.toDataURL('image/png');
}

export async function loadSprites() {
  for (const id of Object.keys(CHARACTERS)) {
    const cfg = CHARACTERS[id];
    const img = await loadImage(import.meta.env.BASE_URL + cfg.sprite.src);
    let base;
    let missing = false;
    if (!img) {
      console.warn('Missing character art for', id, '- using placeholder');
      base = placeholder(cfg);
      cfg.sprite.pivotX = 150; cfg.sprite.pivotY = 560; cfg.sprite.scale = 0.4;
      cfg.sprite.shoulderX = 30; cfg.sprite.shoulderH = 110;
      missing = true;
    } else {
      base = makeCanvas(img.naturalWidth, img.naturalHeight);
      base.getContext('2d').drawImage(img, 0, 0);
      if (!hasTransparency(base)) removePlainBackground(base);
    }
    const portrait = portraitOf(base, cfg.sprite.face);     // taken before any mirroring
    if (cfg.sprite.flip && !missing) {
      // the photo's body is turned to the left; the game draws everyone facing right
      if (cfg.sprite.pivotX0 === undefined) cfg.sprite.pivotX0 = cfg.sprite.pivotX;
      cfg.sprite.pivotX = base.width - cfg.sprite.pivotX0;
      const f = makeCanvas(base.width, base.height);
      const fx = f.getContext('2d');
      fx.translate(base.width, 0); fx.scale(-1, 1); fx.drawImage(base, 0, 0);
      base = f;
    }
    const alt = recolour(base, cfg.sprite.altFilter || 'hue-rotate(150deg) saturate(1.3)');
    store[id] = {
      missing,
      main: { img: base, flash: tinted(base, '#ffffff'), hurt: tinted(base, '#ff2a2a') },
      alt: { img: alt, flash: tinted(alt, '#ffffff'), hurt: tinted(alt, '#ff2a2a') },
      portrait,
    };
  }
}

export function getSprite(id, alt) {
  const s = store[id];
  return alt ? s.alt : s.main;
}
export function getPortrait(id) { return store[id] ? store[id].portrait : ''; }
