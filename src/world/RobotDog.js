// Procedural robotic dog: beveled shapes, PBR painted metal, glowing visor/core,
// articulated legs/ears/jaw/tail. All procedural — no external models/textures.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DOG } from '../utils/constants.js';
import { damp, clamp } from '../utils/helpers.js';

const WHITE = 0xf4f6f6, TEAL = 0x2ec4b6, ORANGE = 0xff8c42, DARK = 0x2b2f33, CYAN = 0x39e6ff;

function std(color, { metal = 0.6, rough = 0.35, emissive = 0x000000, eInt = 0 } = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, emissive, emissiveIntensity: eInt });
}

export class RobotDog {
  constructor() {
    this.group = new THREE.Group();
    this.bodyGroup = new THREE.Group(); // squash & stretch + lean applied here
    this.group.add(this.bodyGroup);
    this.mats = {
      white: std(WHITE), teal: std(TEAL), orange: std(ORANGE),
      dark: std(DARK, { metal: 0.4, rough: 0.5 }),
      eye: new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: CYAN, emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.2 }),
      core: new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: CYAN, emissiveIntensity: 2.6, metalness: 0.2, roughness: 0.2 }),
    };
    this._buildBody(); this._buildHead(); this._buildLegs(); this._buildTail();
    // Mouth socket for carrying the ball / bag
    this.mouthSocket = new THREE.Object3D(); this.mouthSocket.position.set(0, -0.06, 0.34);
    this.headGroup.add(this.mouthSocket);
    // Animation state
    this.gaitPhase = 0; this.distance = 0;
    this.barkTimer = 0; this.interactTimer = 0; this.landTimer = 0; this.squash = 0;
    this.earTwitchTimer = 2.5; this.earTwitch = 0;
    this.blend = { idle: 1, walk: 0, run: 0, jump: 0 };
    this.headLookYaw = 0; this.headLookPitch = 0;
    this.lastSpeed = 0;
  }

  _box(w, h, d, mat, x, y, z, r = 0.06) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  _cyl(rt, rb, h, mat, x, y, z, axis = 'z') {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 20), mat);
    m.position.set(x, y, z); m.castShadow = true;
    if (axis === 'x') m.rotation.z = Math.PI / 2;
    if (axis === 'z') m.rotation.x = Math.PI / 2;
    return m;
  }

  _buildBody() {
    const b = this.bodyGroup;
    // Torso: length ~0.9 along Z, centred at shoulder height
    const torso = this._box(0.42, 0.34, 0.9, this.mats.white, 0, 0.55, 0, 0.12);
    b.add(torso);
    // Teal side panels + orange stripe
    b.add(this._box(0.44, 0.1, 0.7, this.mats.teal, 0, 0.62, -0.02, 0.04));
    b.add(this._box(0.44, 0.05, 0.9, this.mats.orange, 0, 0.47, 0, 0.02));
    // Back panel + vents (dark thin boxes)
    b.add(this._box(0.3, 0.03, 0.5, this.mats.dark, 0, 0.73, -0.05, 0.01));
    for (let i = 0; i < 4; i++) b.add(this._box(0.32, 0.012, 0.04, this.mats.dark, 0, 0.745, -0.22 + i * 0.12, 0.005));
    // Chest core (glowing) + ring
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 16), this.mats.core);
    core.position.set(0, 0.52, 0.42); b.add(core); this.coreMesh = core;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 10, 28), this.mats.teal);
    ring.position.set(0, 0.52, 0.44); b.add(ring);
    // Antenna on back
    const ant = this._cyl(0.012, 0.012, 0.3, this.mats.dark, 0.12, 0.85, -0.3, 'y');
    b.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 12), this.mats.core);
    tip.position.set(0.12, 1.02, -0.3); b.add(tip); this.antennaTip = tip;
    // Hip/shoulder joint hubs
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), this.mats.dark);
      hub.position.set(sx * 0.24, 0.5, sz * 0.3); hub.castShadow = true; b.add(hub);
    }
  }

  _buildHead() {
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.68, 0.55);
    this.bodyGroup.add(this.headGroup);
    const h = this.headGroup;
    h.add(this._box(0.3, 0.26, 0.34, this.mats.white, 0, 0, 0, 0.08));
    // Snout
    h.add(this._box(0.2, 0.13, 0.22, this.mats.teal, 0, -0.06, 0.22, 0.05));
    // Jaw (articulated)
    this.jaw = new THREE.Group(); this.jaw.position.set(0, -0.12, 0.18);
    this.jaw.add(this._box(0.16, 0.05, 0.24, this.mats.dark, 0, 0, 0.05, 0.02));
    h.add(this.jaw);
    // Eye visor (glowing)
    const visor = this._box(0.26, 0.07, 0.03, this.mats.eye, 0, 0.03, 0.17, 0.015);
    h.add(visor);
    // Ears (articulated, pivot at top sides)
    this.ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(s * 0.13, 0.13, -0.02);
      const flap = this._box(0.05, 0.2, 0.12, this.mats.orange, 0, 0.08, 0, 0.02);
      const tipM = this._box(0.055, 0.06, 0.13, this.mats.dark, 0, 0.17, 0, 0.02);
      ear.add(flap); ear.add(tipM);
      ear.rotation.z = s * -0.25;
      h.add(ear); this.ears.push(ear);
    }
    // Cheek lights
    for (const s of [-1, 1]) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), this.mats.core);
      dot.position.set(s * 0.16, -0.03, 0.14); h.add(dot);
    }
  }

  _buildLegs() {
    this.legs = []; // {hip, knee, phaseOffset}
    const offsets = [[-0.22, 0.3, 0], [0.22, 0.3, Math.PI], [-0.22, -0.3, Math.PI], [0.22, -0.3, 0]]; // 4-beat gait
    for (const [x, z, phase] of offsets) {
      const hip = new THREE.Group(); hip.position.set(x, 0.5, z);
      const upper = this._box(0.09, 0.28, 0.11, this.mats.white, 0, -0.13, 0, 0.03);
      hip.add(upper);
      const knee = new THREE.Group(); knee.position.set(0, -0.27, 0);
      const lower = this._box(0.07, 0.26, 0.09, this.mats.dark, 0, -0.12, 0, 0.02);
      knee.add(lower);
      const paw = this._box(0.11, 0.06, 0.16, this.mats.orange, 0, -0.27, 0.02, 0.02);
      knee.add(paw);
      hip.add(knee);
      this.bodyGroup.add(hip);
      this.legs.push({ hip, knee, phase, upper });
    }
  }

  _buildTail() {
    this.tailSegs = [];
    let parent = this.bodyGroup; let z = -0.46; let y = 0.62;
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Group(); seg.position.set(0, i === 0 ? y : 0, i === 0 ? z : -0.16);
      const mesh = this._box(0.06, 0.06, 0.18, i === 2 ? this.mats.orange : this.mats.teal, 0, 0, -0.07, 0.02);
      seg.add(mesh); parent.add(seg); parent = seg; this.tailSegs.push(seg);
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), this.mats.core);
    tip.position.set(0, 0, -0.18); parent.add(tip);
  }

  triggerBark() { this.barkTimer = DOG.BARK_DURATION; }
  triggerInteract() { this.interactTimer = 0.5; }
  triggerLand() { this.landTimer = DOG.LAND_SQUASH_TIME; this.squash = 1; }

  /** state: {speed, grounded, moving, sprinting, vy, time, headingDelta} */
  update(dt, state) {
    const t = state.time;
    const speed = state.speed;
    // Stride scales with speed so feet don't slide: phase advances by distance / stride.
    const stride = clamp(0.35 + speed * 0.09, 0.35, 1.1);
    if (state.grounded && speed > 0.1) this.distance += speed * dt;
    this.gaitPhase = (this.distance / Math.max(stride, 0.01)) * Math.PI * 2;

    // Blend weights toward target (crossfade 0.15s)
    const target = { idle: 0, walk: 0, run: 0, jump: 0 };
    if (!state.grounded) target.jump = 1;
    else if (speed > 0.3) { if (state.sprinting) target.run = 1; else target.walk = 1; }
    else target.idle = 1;
    const k = 1 - Math.exp(-dt / DOG.BLEND_TIME);
    for (const key of Object.keys(this.blend)) this.blend[key] += (target[key] - this.blend[key]) * k;

    const walkAmp = 0.55 * this.blend.walk + 0.75 * this.blend.run;
    const idleW = this.blend.idle, jumpW = this.blend.jump;

    // Legs: 4-beat gait
    for (const leg of this.legs) {
      const ph = this.gaitPhase + leg.phase;
      const swing = Math.sin(ph) * walkAmp;
      const lift = Math.max(0, Math.cos(ph)) * 0.35 * walkAmp;
      if (jumpW > 0.1) {
        // Tuck on rise (vy>0), extend on fall
        const tuck = state.vy > 0 ? -0.7 : 0.45;
        leg.hip.rotation.x = damp(leg.hip.rotation.x, tuck * jumpW + swing * (1 - jumpW), 12, dt);
        leg.knee.rotation.x = damp(leg.knee.rotation.x, (state.vy > 0 ? 1.1 : 0.15) * jumpW, 12, dt);
      } else {
        leg.hip.rotation.x = swing;
        leg.knee.rotation.x = lift;
      }
      // Idle subtle stance
      if (idleW > 0.5) { leg.hip.rotation.x *= (1 - idleW * 0.9); leg.knee.rotation.x *= (1 - idleW * 0.9); }
    }

    // Body bob + breathing + lean
    const bob = Math.abs(Math.sin(this.gaitPhase)) * 0.03 * (this.blend.walk + this.blend.run);
    const breathe = Math.sin(t * 2.1) * 0.008 * idleW;
    const lean = (this.blend.run * 8 * Math.PI / 180) + (state.grounded ? 0 : clamp(state.vy * 0.01, -0.12, 0.12));
    this.bodyGroup.rotation.x = damp(this.bodyGroup.rotation.x, lean, 10, dt);
    this.bodyGroup.position.y = bob + breathe;

    // Squash & stretch on land
    if (this.landTimer > 0) {
      this.landTimer -= dt;
      const s = Math.max(0, this.landTimer / DOG.LAND_SQUASH_TIME);
      this.bodyGroup.scale.set(1 + 0.12 * s, 1 - 0.18 * s, 1 + 0.12 * s);
    } else {
      this.bodyGroup.scale.x = damp(this.bodyGroup.scale.x, 1, 14, dt);
      this.bodyGroup.scale.y = damp(this.bodyGroup.scale.y, 1, 14, dt);
      this.bodyGroup.scale.z = damp(this.bodyGroup.scale.z, 1, 14, dt);
    }
    // Air stretch
    if (!state.grounded) {
      const stretch = clamp(Math.abs(state.vy) * 0.008, 0, 0.06);
      this.bodyGroup.scale.y = 1 + stretch;
    }

    // Tail: wag (idle) / streams back (run)
    const wagSpeed = 4 + speed * 1.2;
    this.tailSegs.forEach((seg, i) => {
      const wag = Math.sin(t * wagSpeed - i * 0.7) * (0.35 - i * 0.05) * (idleW + this.blend.walk * 0.6);
      const back = this.blend.run * -0.9;
      seg.rotation.y = wag;
      seg.rotation.x = damp(seg.rotation.x, back + (idleW * 0.15), 8, dt);
    });

    // Ears: twitch every 3–6s, back when barking
    this.earTwitchTimer -= dt;
    if (this.earTwitchTimer <= 0) { this.earTwitch = 0.35; this.earTwitchTimer = DOG.EAR_TWITCH_MIN + Math.random() * (DOG.EAR_TWITCH_MAX - DOG.EAR_TWITCH_MIN); }
    this.earTwitch = Math.max(0, this.earTwitch - dt * 2.5);
    const barking = this.barkTimer > 0;
    this.ears.forEach((ear, i) => {
      const side = i === 0 ? -1 : 1;
      const tw = (i === 0 ? this.earTwitch : 0) * 0.8;
      ear.rotation.z = side * -0.25 + (barking ? side * -0.5 : 0) + tw * side;
      ear.rotation.x = barking ? -0.4 : 0;
    });

    // Head: look toward movement, bark pose, interact pose
    if (this.barkTimer > 0) this.barkTimer -= dt;
    if (this.interactTimer > 0) this.interactTimer -= dt;
    let headPitch = 0, headYaw = 0;
    if (barking) { headPitch = -0.35; }
    else if (this.interactTimer > 0) { headPitch = 0.5; }
    else {
      // Gentle look toward movement direction
      headYaw = damp(this.headLookYaw, clamp((state.headingDelta || 0) * 0.4, -0.4, 0.4), 6, dt);
      this.headLookYaw = headYaw;
      headPitch = Math.sin(t * 1.3) * 0.04;
    }
    this.headGroup.rotation.x = damp(this.headGroup.rotation.x, headPitch, 10, dt);
    this.headGroup.rotation.y = damp(this.headGroup.rotation.y, headYaw, 10, dt);

    // Jaw
    const jawTarget = barking ? 0.55 : (this.interactTimer > 0 ? 0.25 : 0.02 + Math.max(0, Math.sin(t * 2.1)) * 0.01);
    this.jaw.rotation.x = damp(this.jaw.rotation.x, jawTarget, 14, dt);

    // Glow pulse
    const pulse = 2.1 + Math.sin(t * 3.2) * 0.35 + (barking ? 0.8 : 0);
    this.mats.core.emissiveIntensity = pulse;
    this.mats.eye.emissiveIntensity = 2.0 + Math.sin(t * 3.2) * 0.3;
    if (this.antennaTip) this.antennaTip.scale.setScalar(1 + Math.sin(t * 5) * 0.12);
    this.lastSpeed = speed;
  }

  /** Set world transform from physics body. heading = yaw radians (forward = +Z rotated). */
  setTransform(x, y, z, heading) {
    // Physics capsule centre is at ~0.7 (halfHeight+radius) above feet when standing.
    // Dog group origin is at floor level, so offset down.
    this.group.position.set(x, y - (0.35 + 0.35), z);
    this.group.rotation.y = heading;
  }
  headWorldPosition(out) {
    const p = new THREE.Vector3(0, 0.85, 0.5);
    return this.group.localToWorld(out.copy(p));
  }
}
