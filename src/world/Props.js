// All shelter props — shared geometries/materials + InstancedMesh for repeats.
// Every solid prop gets a matching Rapier box collider. Pickup items (fetch ball,
// kibble bag) are visual-only so carrying never fights physics.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { INTERACTIVE } from '../utils/constants.js';
import { makeTextTexture } from '../utils/helpers.js';

const M = {
  wood: new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.7, metalness: 0.05 }),
  woodLight: new THREE.MeshStandardMaterial({ color: 0xc89b6a, roughness: 0.7, metalness: 0.05 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf4f6f6, roughness: 0.4, metalness: 0.3 }),
  teal: new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.4, metalness: 0.3 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xff8c42, roughness: 0.4, metalness: 0.3 }),
  red: new THREE.MeshStandardMaterial({ color: 0xe4572e, roughness: 0.45, metalness: 0.2 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x3a86ff, roughness: 0.45, metalness: 0.2 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xffc53d, roughness: 0.45, metalness: 0.2 }),
  green: new THREE.MeshStandardMaterial({ color: 0x4caf50, roughness: 0.6, metalness: 0 }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.7, metalness: 0 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.5, metalness: 0.4 }),
  pot: new THREE.MeshStandardMaterial({ color: 0xb5651d, roughness: 0.8, metalness: 0 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.3, metalness: 0.8 }),
  mirror: new THREE.MeshStandardMaterial({ color: 0xcfe8ff, roughness: 0.05, metalness: 1 }),
  bowlFood: new THREE.MeshStandardMaterial({ color: 0xff8c42, roughness: 0.4, metalness: 0.3 }),
  bowlWater: new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.4, metalness: 0.3 }),
  fabric: new THREE.MeshStandardMaterial({ color: 0x7fb3d5, roughness: 0.9, metalness: 0 }),
  fabric2: new THREE.MeshStandardMaterial({ color: 0xf2a65a, roughness: 0.9, metalness: 0 }),
  rope: new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.9, metalness: 0 }),
};
const dummy = new THREE.Object3D();
const _color = new THREE.Color();

function instanced(geo, mat, transforms, castShadow = true) {
  const im = new THREE.InstancedMesh(geo, mat, transforms.length);
  transforms.forEach((t, i) => {
    dummy.position.set(t.x, t.y ?? 0, t.z);
    dummy.rotation.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
    dummy.scale.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
    dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
    if (t.color !== undefined) im.setColorAt(i, _color.setHex(t.color));
  });
  im.castShadow = castShadow; im.receiveShadow = true;
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}

export class Props {
  constructor(scene, physics) {
    this.scene = scene; this.physics = physics;
    this.ballMesh = null; this.bagMesh = null;
    this.basketPos = INTERACTIVE.BASKET_POS;
    this._buildAll();
  }
  boxCollider(x, y, z, hx, hy, hz) { this.physics.addStaticBox(x, y, z, hx, hy, hz); }

  _buildAll() {
    this._housesAndBeds(); this._bowls(); this._playProps(); this._groomProps();
    this._gardenProps(); this._cratesAndBenches(); this._lightsAndPosters();
    this._interactive(); this._fencesAndDoors();
  }

  _housesAndBeds() {
    const housePos = [[-8, 10], [-3, 10], [2, 10], [7, 10], [-5, 4], [5, 4]];
    const houseBody = new THREE.BoxGeometry(1.2, 0.8, 1.1);
    const roofGeo = new THREE.ConeGeometry(0.95, 0.6, 4);
    // Bodies alternate orange/teal; scale varies slightly so houses stop reading as clones (audit 7).
    const bodies = housePos.map(([x, z], i) => ({ x, y: 0.4, z, ry: i % 2 ? 0.2 : -0.15, sx: i === 0 ? 1.07 : i === 3 ? 0.94 : 1, color: i % 2 ? 0xff8c42 : 0x2ec4b6 }));
    // Roofs alternate too (were all teal); white base material so instance colours stay true.
    const roofs = housePos.map(([x, z], i) => ({ x, y: 1.1, z, ry: Math.PI / 4, color: i % 2 ? 0x2ec4b6 : 0xff8c42 }));
    const bodyIM = instanced(houseBody, M.white, bodies); this.scene.add(bodyIM);
    const roofIM = instanced(roofGeo, M.white, roofs); this.scene.add(roofIM);
    // Door holes: dark inset boxes on front face
    const doors = housePos.map(([x, z]) => ({ x, y: 0.25, z: z + 0.56 }));
    this.scene.add(instanced(new THREE.BoxGeometry(0.4, 0.5, 0.04), M.dark, doors, false));
    housePos.forEach(([x, z]) => this.boxCollider(x, 0.5, z, 0.6, 0.5, 0.55));

    const bedPos = [[-8, -1], [-3, -1], [2, -1], [7, -1], [-5, 6.5], [5, 6.5]];
    // White base so instance colours stay true (audit 7): the old blue fabric base
    // multiplied with orange instances and came out muddy brown. Third colour: cream.
    const bedCols = [0x7fb3d5, 0xf2a65a, 0xefe6d0];
    const bedBase = instanced(new RoundedBoxGeometry(1.1, 0.18, 0.8, 2, 0.06),
      M.white, bedPos.map(([x, z], i) => ({ x, y: 0.09, z, color: bedCols[i % 3] })));
    // Pillows alternate sides so beds stop reading as clones (audit 7).
    const bedPillow = instanced(new RoundedBoxGeometry(0.5, 0.12, 0.4, 2, 0.05),
      M.white, bedPos.map(([x, z], i) => ({ x: x + (i % 2 ? 0.25 : -0.25), y: 0.22, z })));
    this.scene.add(bedBase, bedPillow);
    bedPos.forEach(([x, z]) => this.boxCollider(x, 0.12, z, 0.55, 0.12, 0.4));
  }

  _bowls() {
    const food = [[14, 0], [20, 0], [26, 0], [14, 5], [20, 5], [26, 5]];
    const water = [[17, 0], [23, 0], [17, 5], [23, 5], [14, 8], [26, 8]];
    const bowlGeo = new THREE.CylinderGeometry(0.32, 0.22, 0.18, 18);
    this.scene.add(instanced(bowlGeo, M.bowlFood, food.map(([x, z]) => ({ x, y: 0.09, z }))));
    this.scene.add(instanced(bowlGeo, M.bowlWater, water.map(([x, z]) => ({ x, y: 0.09, z }))));
    // Kibble inside food bowls (small flattened spheres, instanced)
    const kib = instanced(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 }),
      food.map(([x, z]) => ({ x, y: 0.16, z, sy: 0.35 })), false);
    this.scene.add(kib);
    [...food, ...water].forEach(([x, z]) => this.boxCollider(x, 0.1, z, 0.32, 0.1, 0.32));
    // Kibble station + feeding table (eat zone)
    const station = new THREE.Mesh(new RoundedBoxGeometry(1.4, 1.0, 0.7, 2, 0.05), M.wood);
    station.position.set(12, 0.5, 11); station.castShadow = station.receiveShadow = true; this.scene.add(station);
    this.boxCollider(12, 0.5, 11, 0.7, 0.5, 0.35);
    const sack = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.7, 12), M.rope);
    sack.position.set(12, 1.35, 11); sack.castShadow = true; this.scene.add(sack);
    const table = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.12, 0.9, 2, 0.04), M.woodLight);
    table.position.set(28, 0.75, 10); table.castShadow = table.receiveShadow = true; this.scene.add(table);
    const legT = [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]];
    for (const [dx, dz] of legT) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.75, 0.08), M.wood); leg.position.set(28 + dx, 0.37, 10 + dz); this.scene.add(leg); }
    this.boxCollider(28, 0.45, 10, 0.9, 0.45, 0.45);
  }

  _playProps() {
    // Ramps x3 (low boxes the dog can jump onto) — slopes alternate brand colours (audit 7, 8).
    const ramps = [[-25, 5, 0.4], [-15, 5, -0.3], [-25, -2, 0.2]];
    const rampMats = [M.teal, M.orange, M.woodLight];
    ramps.forEach(([x, z, ry], i) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
      const slope = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.9), rampMats[i % 3]);
      slope.position.set(0, 0.3, 0); slope.rotation.z = -0.18; slope.castShadow = slope.receiveShadow = true;
      const sup = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.8), M.wood);
      sup.position.set(-0.9, 0.15, 0);
      g.add(slope, sup); this.scene.add(g);
      this.boxCollider(x, 0.25, z, 1.0, 0.25, 0.45);
    });
    // Tunnel: two side walls + arched top, dog passes through the middle
    const tunnel = new THREE.Group(); tunnel.position.set(-15, 0, -2); tunnel.rotation.y = 0;
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.15), M.orange);
      wall.position.set(0, 0.45, s * 0.55); wall.castShadow = wall.receiveShadow = true; tunnel.add(wall);
      this.boxCollider(-15, 0.45, -2 + s * 0.55, 1.1, 0.45, 0.08);
    }
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.2, 16, 1, true, 0, Math.PI), M.teal);
    top.rotation.z = Math.PI / 2; top.rotation.y = Math.PI / 2; top.position.y = 0.9; top.castShadow = true; tunnel.add(top);
    this.scene.add(tunnel);
    // Decorative balls x7 (fetch ball is separate + movable).
    // Palette-tightened (audit 17: blue out, deep teal in) + one hero ball, larger (audit 7).
    const ballPos = [[-26, -3], [-12, 8], [-24, 12], [-12, -3], [-27, 9], [-18, 13], [-12, 12]];
    const ballCols = [0xe4572e, 0x178a80, 0xffc53d, 0x2ec4b6, 0xff8c42, 0xe4572e, 0x178a80];
    this.scene.add(instanced(new THREE.SphereGeometry(0.18, 16, 12), M.white,
      ballPos.map(([x, z], i) => ({ x, y: 0.18, z, color: ballCols[i], sx: i === 0 ? 1.3 : 1, sy: i === 0 ? 1.3 : 1, sz: i === 0 ? 1.3 : 1 }))));
    // Rope toys x3 (torus) + frisbees x2 (flat cylinders)
    const ropes = [[-22, 3], [-16, 9], [-26, 7]];
    this.scene.add(instanced(new THREE.TorusGeometry(0.22, 0.05, 8, 20), M.rope, ropes.map(([x, z]) => ({ x, y: 0.1, z, rx: Math.PI / 2 }))));
    const fris = [[-18, 6], [-24, -4]];
    this.scene.add(instanced(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 20), M.red, fris.map(([x, z]) => ({ x, y: 0.08, z }))));
    // Basket (FETCH target) — open box frame + orange rim + one ball inside,
    // so the target reads at a glance instead of as an empty wooden tube (audit 7).
    const basket = new THREE.Group(); basket.position.set(INTERACTIVE.BASKET_POS.x, 0, INTERACTIVE.BASKET_POS.z);
    const bb = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.55, 16, 1, true), M.wood);
    bb.position.y = 0.28; bb.castShadow = bb.receiveShadow = true; basket.add(bb);
    const bBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16), M.wood);
    bBase.position.y = 0.03; basket.add(bBase);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.035, 10, 28), M.orange);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.56; rim.castShadow = true; basket.add(rim);
    const insideBall = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), M.orange);
    insideBall.position.set(0.12, 0.18, -0.08); insideBall.castShadow = true; basket.add(insideBall);
    this.scene.add(basket);
    this.boxCollider(INTERACTIVE.BASKET_POS.x, 0.28, INTERACTIVE.BASKET_POS.z, 0.55, 0.28, 0.55);
  }

  _groomProps() {
    // Grooming table + towel + brush on top, so it reads as in-use, not bare (audit 7).
    const table = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.14, 0.8, 2, 0.04), M.metal);
    table.position.set(-22, 0.8, -12); table.castShadow = table.receiveShadow = true; this.scene.add(table);
    const towel = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.03, 0.5, 2, 0.01), M.white);
    towel.position.set(-22.3, 0.89, -12); towel.castShadow = true; this.scene.add(towel);
    const tableBrush = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.12), M.orange);
    tableBrush.position.set(-21.5, 0.91, -12.15); tableBrush.rotation.y = 0.5; tableBrush.castShadow = true; this.scene.add(tableBrush);
    for (const [dx, dz] of [[-0.7, -0.3], [0.7, -0.3], [-0.7, 0.3], [0.7, 0.3]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), M.dark);
      leg.position.set(-22 + dx, 0.4, -12 + dz); this.scene.add(leg);
    }
    this.boxCollider(-22, 0.45, -12, 0.8, 0.45, 0.4);
    // Mirrors on north wall (groom zone)
    for (const x of [-26, -20, -14]) {
      const mir = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), M.mirror);
      mir.position.set(x, 2.2, -19.78); this.scene.add(mir);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.9, 0.05), M.wood);
      frame.position.set(x, 2.2, -19.82); this.scene.add(frame);
    }
    // Brushes shelf
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.4), M.wood);
    shelf.position.set(-15, 1.6, -19.75); shelf.castShadow = true; this.scene.add(shelf);
    const brushCols = [0xe4572e, 0x2ec4b6, 0xffc53d];
    brushCols.forEach((c, i) => {
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.2), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
      br.position.set(-15.7 + i * 0.7, 1.75, -19.75); br.castShadow = true; this.scene.add(br);
    });
    this.boxCollider(-15, 1.6, -19.7, 1.1, 0.2, 0.2);
  }

  _gardenProps() {
    const plantPos = [[-5, -18], [0, -18], [5, -18], [12, -18], [20, -18], [27, -18],
      [-5, -8], [3, -8], [14, -8], [22, -8], [27, -8], [8, -13]];
    this.scene.add(instanced(new THREE.CylinderGeometry(0.28, 0.22, 0.4, 12), M.pot,
      plantPos.map(([x, z]) => ({ x, y: 0.2, z }))));
    // Foliage: white base so instance colours stay true; per-plant size + tone jitter (audit 7).
    const leafCols = [0x2e8b57, 0x3da35d, 0x276b43];
    this.scene.add(instanced(new THREE.IcosahedronGeometry(0.5, 1), M.white,
      plantPos.map(([x, z], i) => ({ x, y: 0.85, z, sx: 0.9 + (i % 3) * 0.12, sy: 0.8 + (i % 3) * 0.15, sz: 0.9 + ((i + 1) % 3) * 0.12, color: leafCols[i % 3] }))));
    plantPos.forEach(([x, z]) => this.boxCollider(x, 0.4, z, 0.28, 0.4, 0.28));
    // Watering cans x2
    for (const [x, z] of [[-2, -10], [18, -10]]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.3, 12), M.teal);
      can.position.set(x, 0.15, z); can.castShadow = true; this.scene.add(can);
    }
  }

  _cratesAndBenches() {
    const crates = [[-28, 18], [28, 18], [-28, -18], [28, -18], [-28, -3]];
    this.scene.add(instanced(new THREE.BoxGeometry(0.8, 0.8, 0.8), M.wood, crates.map(([x, z]) => ({ x, y: 0.4, z, ry: 0.4 }))));
    crates.forEach(([x, z]) => this.boxCollider(x, 0.4, z, 0.4, 0.4, 0.4));
    const benches = [[0, -12], [10, -12], [20, -12], [5, -17]];
    this.scene.add(instanced(new RoundedBoxGeometry(1.8, 0.12, 0.5, 2, 0.04), M.woodLight,
      benches.map(([x, z]) => ({ x, y: 0.5, z }))));
    this.scene.add(instanced(new THREE.BoxGeometry(0.1, 0.5, 0.45), M.wood,
      benches.flatMap(([x, z]) => [{ x: x - 0.75, y: 0.25, z }, { x: x + 0.75, y: 0.25, z }])));
    benches.forEach(([x, z]) => this.boxCollider(x, 0.3, z, 0.9, 0.3, 0.25));
  }

  _lightsAndPosters() {
    // Ceiling lights: one per zone centre, hanging discs with warm emissive
    const centres = [[0, 17], [-20, 4.5], [0, 4.5], [20, 4.5], [-20, -12.5], [10, -12.5]];
    const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2cc, emissive: 0xffe6a3, emissiveIntensity: 1.0 });
    this.scene.add(instanced(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 20), lightMat,
      centres.map(([x, z]) => ({ x, y: 5.85, z }))));
    this.scene.add(instanced(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8), M.dark,
      centres.map(([x, z]) => ({ x, y: 5.6, z })), false));
    // Wall posters (canvas textures, same-origin). Compositions vary (wide / tall / square),
    // all pulled into the brand palette with passing contrast (audit 13, 17).
    const poster = (tex, x, y, z, ry, w = 1.6, h = 1.1) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(x, y, z); m.rotation.y = ry; this.scene.add(m);
    };
    // PLAY: wide typographic banner, cream + dark teal.
    poster(makeTextTexture({ w: 640, h: 280, bg: '#FFF8E7', fg: '#0F4C46', title: 'PLAY!', lines: ['Fetch', 'Jump', 'Bark'] }), -29.78, 3, 4, Math.PI / 2, 2.2, 0.95);
    // SLEEP: tall inverted poster, dark teal + cream (calm).
    poster(makeTextTexture({ w: 384, h: 512, bg: '#0F4C46', fg: '#FFF8E7', title: 'SLEEP', lines: ['Quiet paws', 'please'] }), 0, 3, 19.78, Math.PI, 1.1, 1.5);
    // EAT: square poster, cream + burnt orange.
    poster(makeTextTexture({ w: 448, h: 448, bg: '#FFF8E7', fg: '#7A2E00', title: 'EAT', lines: ['Kibble o\'clock'] }), 29.78, 3, 4, -Math.PI / 2, 1.3, 1.3);
    // GROOM: wide poster, cream + dark rose.
    poster(makeTextTexture({ w: 640, h: 280, bg: '#FFF8E7', fg: '#6B1F3D', title: 'GROOM', lines: ['Look sharp!', 'Brushes inside'] }), -29.78, 3, -12, Math.PI / 2, 2.0, 0.9);
    // GARDEN: tall poster, dark leaf green + pale mint.
    poster(makeTextTexture({ w: 384, h: 512, bg: '#1E4D2B', fg: '#EAF5EC', title: 'GARDEN', lines: ['Fresh air', 'inside'] }), 10, 3, -19.78, 0, 1.1, 1.5);
  }

  _interactive() {
    // FETCH ball — movable, orange with white stripe
    const ball = new THREE.Group();
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), M.orange);
    s.castShadow = true; ball.add(s);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 8, 24), M.white);
    stripe.rotation.x = Math.PI / 2; ball.add(stripe);
    ball.position.set(INTERACTIVE.BALL_START.x, INTERACTIVE.BALL_START.y, INTERACTIVE.BALL_START.z);
    this.scene.add(ball); this.ballMesh = ball;
    // Kibble bag — movable, sack shape
    const bag = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.55, 12), M.rope);
    body.castShadow = true; bag.add(body);
    const labelTex = makeTextTexture({ w: 256, h: 128, bg: '#FF8C42', fg: '#fff', title: 'KIBBLE', titleSize: 44 });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: labelTex }));
    label.position.set(0, 0, 0.3); bag.add(label);
    bag.position.set(INTERACTIVE.BAG_START.x, INTERACTIVE.BAG_START.y, INTERACTIVE.BAG_START.z);
    this.scene.add(bag); this.bagMesh = bag;
  }

  _fencesAndDoors() {
    // Low visible fence along the inside of the south wall (lobby) — decorative, collider-free
    // so it never blocks the dog; the real boundary is the Rapier perimeter walls.
    const fenceMat = M.white;
    const posts = [];
    for (let x = -28; x <= 28; x += 2) posts.push({ x, y: 0.4, z: 19.3 });
    this.scene.add(instanced(new THREE.BoxGeometry(0.08, 0.8, 0.08), fenceMat, posts, false));
    const rail = new THREE.Mesh(new THREE.BoxGeometry(56, 0.08, 0.05), M.wood);
    rail.position.set(0, 0.65, 19.3); this.scene.add(rail);
    // 2 doors on the south wall (visual frames + panels) — cream panels (was teal, audit 8) + knobs.
    for (const x of [-15, 15]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 0.15), M.wood);
      frame.position.set(x, 1.5, 19.9); this.scene.add(frame);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.7, 0.08), M.white);
      panel.position.set(x, 1.35, 19.82); this.scene.add(panel);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), M.dark);
      knob.position.set(x + (x < 0 ? 0.6 : -0.6), 1.35, 19.76); this.scene.add(knob);
    }
  }
}
