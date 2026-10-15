import * as THREE from 'three';

export function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
export function dist2D(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
export function pointInZone(x, z, zone) { return x >= zone.x0 && x <= zone.x1 && z >= zone.z0 && z <= zone.z1; }

/** Canvas-generated radial-gradient texture (same-origin, no external file). Used for dust puffs. */
export function makeSoftCircleTexture(size = 64) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Canvas-generated sign/poster texture (same-origin). */
export function makeTextTexture({ w = 512, h = 256, bg = '#ffffff', fg = '#222222', title = '', lines = [], titleSize = 64, lineSize = 34 }) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = fg; ctx.lineWidth = 6; ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let y = title ? 70 : 40;
  if (title) { ctx.font = `bold ${titleSize}px system-ui, sans-serif`; ctx.fillText(title, w / 2, y); y += 70; }
  ctx.font = `${lineSize}px system-ui, sans-serif`;
  for (const line of lines) { ctx.fillText(line, w / 2, y); y += lineSize + 12; }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeZoneSignTexture(label, fg = '#0F4C46') {
  // Cream board + dark text (contrast ~10:1), NOT white-on-teal (was 2.17:1, R-25).
  return makeTextTexture({ w: 512, h: 192, bg: '#FFF8E7', fg, title: label.toUpperCase(), titleSize: 72 });
}

/** Deterministic pseudo-random (LCG) so generated textures are stable between loads. */
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** Procedural wood-plank texture (same-origin canvas). Purpose: break up the flat
 *  single-colour floor (audit 12) with plank seams + grain, no external file. */
export function makeWoodTexture() {
  const w = 512, h = 512;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#C89B6A'; ctx.fillRect(0, 0, w, h);
  const rnd = seededRandom(7);
  // Planks: horizontal boards with a darker seam + per-plank tone shift.
  const plankH = 64;
  for (let y = 0; y < h; y += plankH) {
    const tone = 0.92 + rnd() * 0.16;
    ctx.fillStyle = `rgba(${(200 * tone) | 0},${(155 * tone) | 0},${(106 * tone) | 0},0.55)`;
    ctx.fillRect(0, y, w, plankH);
    // Grain streaks inside the plank.
    ctx.strokeStyle = 'rgba(120, 80, 40, 0.18)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) {
      const gy = y + 6 + rnd() * (plankH - 12);
      ctx.beginPath(); ctx.moveTo(0, gy);
      for (let x = 0; x <= w; x += 32) ctx.lineTo(x, gy + Math.sin(x * 0.02 + rnd() * 6) * 2.5);
      ctx.stroke();
    }
    // Seam + staggered butt joints.
    ctx.fillStyle = 'rgba(90, 55, 25, 0.7)'; ctx.fillRect(0, y + plankH - 2, w, 2);
    const jointX = (y * 37) % w;
    ctx.fillRect(jointX, y, 2, plankH);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Procedural rug texture: cream field + accent border + paw prints.
 *  Purpose: one identity motif (paw print) per zone, breaks flat floor (audit 12). */
export function makeRugTexture(accent = '#0F4C46') {
  const w = 512, h = 384;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#EFE6D0'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = accent; ctx.lineWidth = 10; ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.lineWidth = 3; ctx.strokeRect(34, 34, w - 68, h - 68);
  // Paw prints: one pad ellipse + four toe circles, muted accent.
  const paw = (cx, cy, s, rot) => {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.fillStyle = accent; ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.ellipse(0, 10, 16 * s, 13 * s, 0, 0, Math.PI * 2); ctx.fill();
    for (const [dx, dy] of [[-18, -8], [-6, -16], [6, -16], [18, -8]]) {
      ctx.beginPath(); ctx.arc(dx * s, dy * s, 6.5 * s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  };
  paw(w * 0.25, h * 0.5, 1.1, -0.4); paw(w * 0.55, h * 0.5, 1.1, 0.35); paw(w * 0.8, h * 0.5, 1.1, -0.3);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Procedural window view: sky gradient + distant silhouette.
 *  Purpose: outdoor depth cue so windows stop reading as flat cyan slabs (audit 20). */
export function makeWindowTexture() {
  const w = 512, h = 320;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#D9F0FF'); g.addColorStop(0.55, '#BFE8FF'); g.addColorStop(1, '#FFE9C9');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // Sun glow, low-key.
  const sun = ctx.createRadialGradient(w * 0.72, h * 0.3, 4, w * 0.72, h * 0.3, 120);
  sun.addColorStop(0, 'rgba(255, 244, 200, 0.9)'); sun.addColorStop(1, 'rgba(255, 244, 200, 0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
  // Distant hills + rooftops in muted dark teal.
  ctx.fillStyle = 'rgba(30, 77, 74, 0.55)';
  ctx.beginPath(); ctx.moveTo(0, h * 0.72);
  ctx.quadraticCurveTo(w * 0.25, h * 0.5, w * 0.5, h * 0.68);
  ctx.quadraticCurveTo(w * 0.75, h * 0.82, w, h * 0.62);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(30, 77, 74, 0.7)';
  ctx.fillRect(w * 0.08, h * 0.6, w * 0.18, h * 0.2);
  ctx.beginPath(); ctx.moveTo(w * 0.06, h * 0.6); ctx.lineTo(w * 0.17, h * 0.48); ctx.lineTo(w * 0.28, h * 0.6); ctx.closePath(); ctx.fill();
  // One tree blob.
  ctx.beginPath(); ctx.arc(w * 0.82, h * 0.58, 34, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(w * 0.81, h * 0.58, 5, 46);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Shared dust-puff pool: sprites that fade + rise, no external textures. */
export class DustPool {
  constructor(scene, count = 24) {
    this.scene = scene; this.pool = [];
    const tex = makeSoftCircleTexture();
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, color: 0xd8c9a8 });
      const s = new THREE.Sprite(mat); s.scale.setScalar(0.4); s.visible = false;
      scene.add(s); this.pool.push({ sprite: s, life: 0, max: 0.5, vy: 0 });
    }
    this.cursor = 0;
  }
  puff(pos, n = 6, spread = 0.35) {
    for (let i = 0; i < n; i++) {
      const p = this.pool[this.cursor]; this.cursor = (this.cursor + 1) % this.pool.length;
      p.sprite.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y + 0.05, pos.z + (Math.random() - 0.5) * spread);
      p.sprite.scale.setScalar(0.25 + Math.random() * 0.3);
      p.life = p.max = 0.45 + Math.random() * 0.25; p.vy = 0.6 + Math.random() * 0.5;
      p.sprite.visible = true; p.sprite.material.opacity = 0.7;
    }
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.sprite.visible) continue;
      p.life -= dt;
      if (p.life <= 0) { p.sprite.visible = false; continue; }
      p.sprite.position.y += p.vy * dt; p.vy *= (1 - 2 * dt);
      const t = p.life / p.max;
      p.sprite.material.opacity = 0.7 * t;
      p.sprite.scale.multiplyScalar(1 + dt * 1.5);
    }
  }
}
