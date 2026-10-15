// Shelter shell: zone floors, walls, windows, ceiling + skylight, zone signs.
// Orchestrates Props placement. Lighting is set up by Game (sun + hemisphere + points).
import * as THREE from 'three';
import { SHELTER, ZONES } from '../utils/constants.js';
import { makeZoneSignTexture, makeTextTexture } from '../utils/helpers.js';
import { Props } from './Props.js';

export class Shelter {
  constructor(scene, physics) {
    this.scene = scene;
    this._buildFloors(); this._buildWalls(); this._buildCeiling(); this._buildSigns(); this._buildInfoBoard();
    this.props = new Props(scene, physics);
  }
  _floorMat(color) {
    return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.02 });
  }
  _buildFloors() {
    // Wood base floor (whole shelter)
    const base = new THREE.Mesh(new THREE.PlaneGeometry(SHELTER.WIDTH, SHELTER.DEPTH),
      new THREE.MeshStandardMaterial({ color: 0xc89b6a, roughness: 0.75, metalness: 0.02 }));
    base.rotation.x = -Math.PI / 2; base.receiveShadow = true; this.scene.add(base);
    // Zone tint overlays, slightly above base to avoid z-fighting
    for (const [key, z] of Object.entries(ZONES)) {
      const w = z.x1 - z.x0, d = z.z1 - z.z0;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, d - 0.06), this._floorMat(z.floor));
      m.rotation.x = -Math.PI / 2;
      m.position.set((z.x0 + z.x1) / 2, 0.01, (z.z0 + z.z1) / 2);
      m.receiveShadow = true; this.scene.add(m);
      // Zone border line (thin teal frame via 4 thin boxes)
      const lineMat = new THREE.MeshBasicMaterial({ color: 0x2ec4b6 });
      const mk = (ww, dd, x, zz) => {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(ww, dd), lineMat);
        l.rotation.x = -Math.PI / 2; l.position.set(x, 0.02, zz); this.scene.add(l);
      };
      const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2;
      mk(w, 0.12, cx, z.z0 + 0.06); mk(w, 0.12, cx, z.z1 - 0.06);
      mk(0.12, d, z.x0 + 0.06, cz); mk(0.12, d, z.x1 - 0.06, cz);
    }
  }
  _buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf5eedd, roughness: 0.9, metalness: 0 });
    const H = SHELTER.WALL_HEIGHT, W = SHELTER.WIDTH, D = SHELTER.DEPTH;
    const mkWall = (w, h, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true; this.scene.add(m);
    };
    mkWall(W, H, 0, H / 2, -D / 2, 0);            // north (faces +z into shelter)
    mkWall(W, H, 0, H / 2, D / 2, Math.PI);       // south
    mkWall(D, H, -W / 2, H / 2, 0, Math.PI / 2);  // west
    mkWall(D, H, W / 2, H / 2, 0, -Math.PI / 2);  // east
    // Skirting boards
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.6 });
    const skirt = (w, x, z, ry) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.25, 0.06), skirtMat);
      m.position.set(x, 0.125, z); m.rotation.y = ry; this.scene.add(m);
    };
    skirt(W, 0, -D / 2 + 0.03, 0); skirt(W, 0, D / 2 - 0.03, 0);
    skirt(D, -W / 2 + 0.03, 0, Math.PI / 2); skirt(D, W / 2 - 0.03, 0, Math.PI / 2);
    // Windows with outdoor glow (north + east walls)
    const winMat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    for (const x of [-22, -8, 8, 22]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 0.1), frameMat);
      frame.position.set(x, 3.8, -D / 2 + 0.02); this.scene.add(frame);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), winMat);
      glass.position.set(x, 3.8, -D / 2 + 0.08); this.scene.add(glass);
    }
    for (const z of [-10, 5]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 3), frameMat);
      frame.position.set(W / 2 - 0.02, 3.8, z); this.scene.add(frame);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), winMat);
      glass.rotation.y = -Math.PI / 2; glass.position.set(W / 2 - 0.08, 3.8, z); this.scene.add(glass);
    }
  }
  _buildCeiling() {
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xefe8d8, roughness: 0.95 });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(SHELTER.WIDTH, SHELTER.DEPTH), ceilMat);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = SHELTER.WALL_HEIGHT; this.scene.add(ceil);
    // Skylight over the garden (emissive soft-sky panel + frame)
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(16, 8),
      new THREE.MeshStandardMaterial({ color: 0xbfe8ff, emissive: 0xbfe8ff, emissiveIntensity: 0.9, roughness: 0.4 }));
    sky.rotation.x = Math.PI / 2; sky.position.set(10, SHELTER.WALL_HEIGHT - 0.02, -12.5); this.scene.add(sky);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(16.6, 0.12, 8.6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    frame.position.set(10, SHELTER.WALL_HEIGHT - 0.01, -12.5); this.scene.add(frame);
    // Beams across ceiling
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8 });
    for (let x = -25; x <= 25; x += 10) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, SHELTER.DEPTH), beamMat);
      beam.position.set(x, SHELTER.WALL_HEIGHT - 0.15, 0); this.scene.add(beam);
    }
  }
  _buildSigns() {
    for (const [key, z] of Object.entries(ZONES)) {
      const tex = makeZoneSignTexture(z.label);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({ map: tex }));
      const cx = (z.x0 + z.x1) / 2, cz = (z.z0 + z.z1) / 2;
      // Hang sign from ceiling near zone centre, double-sided
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      const s2 = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), mat);
      s2.position.set(cx, 4.6, cz); this.scene.add(s2);
      const hanger = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.06),
        new THREE.MeshStandardMaterial({ color: 0x2b2f33 }));
      hanger.position.set(cx, 5.3, cz); this.scene.add(hanger);
      void sign; void key;
    }
  }
  _buildInfoBoard() {
    // Info board + controls poster in lobby, near spawn, facing north (-z => rotation.y = PI)
    const tex = makeTextTexture({ w: 640, h: 420, bg: '#FFF8E7', fg: '#333', title: 'WELCOME!', lines: ['WASD move • SPACE jump', 'SHIFT sprint • E interact', 'F bark • R reset • P pause'] , titleSize: 56, lineSize: 32 });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), new THREE.MeshBasicMaterial({ map: tex }));
    board.position.set(-4, 2.2, 19.7); board.rotation.y = Math.PI; this.scene.add(board);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.4, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x8a5a2b }));
    frame.position.set(-4, 2.2, 19.78); this.scene.add(frame);
  }
}
