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

export function makeZoneSignTexture(label) {
  return makeTextTexture({ w: 512, h: 192, bg: '#2EC4B6', fg: '#ffffff', title: label.toUpperCase(), titleSize: 72 });
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
