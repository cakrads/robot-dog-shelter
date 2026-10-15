// Dog movement: accel/decel, turn lerp, jump with coyote + buffer, grounded state.
import * as THREE from 'three';
import { PHYSICS, SPAWN, CAMERA } from '../utils/constants.js';
import { clamp, damp } from '../utils/helpers.js';

export class Player {
  constructor(physics, dog, cameraRig, audio, dust) {
    this.physics = physics; this.dog = dog; this.camera = cameraRig; this.audio = audio; this.dust = dust;
    this.vel = new THREE.Vector3(); // horizontal velocity we command (physics body carries Y)
    this.heading = SPAWN.facing;    // yaw, forward = +Z rotated
    this.targetHeading = SPAWN.facing;
    this.grounded = true; this.coyote = 0; this.jumpBuffer = 0;
    this.wasGrounded = true; this.fallStartY = 0;
    this.speed = 0;
    this.onLand = null; this.onJump = null;
    this._tmp = new THREE.Vector3();
  }
  spawn() {
    this.physics.setDogPosition(SPAWN.x, 0.7, SPAWN.z);
    this.vel.set(0, 0, 0); this.heading = SPAWN.facing; this.targetHeading = SPAWN.facing;
    this.coyote = 0; this.jumpBuffer = 0; this.grounded = true;
    this.dog.setTransform(SPAWN.x, 0.7, SPAWN.z, this.heading);
    this.camera.reset(0);
  }

  /** dt is the fixed-step dt (1/60). input: {mx, mz} camera-space, sprint, jumpPressed */
  fixedUpdate(dt, input) {
    const body = this.physics.dogBody;
    const pos = this.physics.dogPosition();
    const curVel = this.physics.dogVelocity();
    this.grounded = this.physics.isGrounded();
    if (this.grounded) this.coyote = PHYSICS.COYOTE; else this.coyote = Math.max(0, this.coyote - dt);
    if (input.jumpPressed) this.jumpBuffer = PHYSICS.JUMP_BUFFER; else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    // Landing detection
    if (!this.wasGrounded && this.grounded) {
      const fallDist = this.fallStartY - pos.y;
      if (fallDist > 0.25) {
        this.dog.triggerLand(); this.audio.landThud(); this.onLand?.();
        this.dust.puff({ x: pos.x, y: 0.05, z: pos.z }, 7, 0.5);
      }
    }
    if (!this.grounded && this.wasGrounded) this.fallStartY = pos.y;
    this.wasGrounded = this.grounded;

    // Desired velocity relative to camera
    const camFwd = this.camera.forwardXZ(); // direction camera looks
    const camRight = new THREE.Vector3(-camFwd.z, 0, camFwd.x);
    const desired = this._tmp.set(0, 0, 0);
    // input.mz: +1 forward (W) -> move along camera forward
    desired.addScaledVector(camFwd, input.mz).addScaledVector(camRight, input.mx);
    const hasInput = desired.lengthSq() > 0.0001;
    if (hasInput) desired.normalize();
    const maxSpeed = input.sprint ? PHYSICS.SPRINT_SPEED : PHYSICS.WALK_SPEED;
    const control = this.grounded ? 1 : PHYSICS.AIR_CONTROL;
    desired.multiplyScalar(maxSpeed);

    // Accelerate / decelerate horizontally
    const accel = hasInput ? PHYSICS.ACCEL * control : PHYSICS.DECEL;
    this.vel.x = damp(this.vel.x, desired.x, accel / Math.max(maxSpeed, 0.001), dt);
    this.vel.z = damp(this.vel.z, desired.z, accel / Math.max(maxSpeed, 0.001), dt);
    // The damp lambda above: accel/maxSpeed gives ~ 40/4.5 ≈ 8.9/s — smooth but responsive.
    if (!hasInput) {
      // Stronger exponential decay when no input so the dog stops crisply
      const k = 1 - Math.exp(-(PHYSICS.DECEL / 4) * dt);
      this.vel.x *= (1 - k); this.vel.z *= (1 - k);
    }
    this.speed = Math.hypot(this.vel.x, this.vel.z);

    // Facing: only rotate dog when moving (camera rotation alone must not rotate dog)
    if (this.speed > 0.4) {
      this.targetHeading = Math.atan2(this.vel.x, this.vel.z);
      let diff = this.targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * (1 - Math.exp(-PHYSICS.TURN_LERP * dt));
      this._lastHeadingDelta = diff;
    } else this._lastHeadingDelta = 0;

    // Jump (grounded or coyote, with buffer), no double-jump
    let vy = curVel.y;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      vy = PHYSICS.JUMP_VELOCITY;
      this.jumpBuffer = 0; this.coyote = 0; this.grounded = false;
      this.audio.jumpWhoosh(); this.onJump?.();
      this.dust.puff({ x: pos.x, y: 0.05, z: pos.z }, 4, 0.4);
    }
    this.physics.setDogVelocity(this.vel.x, vy, this.vel.z);
    this.camera.sprinting = input.sprint && this.speed > 1;
  }

  /** Per-frame visual sync (after physics step). */
  syncVisual(time, dt) {
    const pos = this.physics.dogPosition();
    const vel = this.physics.dogVelocity();
    this.dog.setTransform(pos.x, pos.y, pos.z, this.heading);
    this.dog.update(dt, {
      speed: this.speed, grounded: this.grounded, moving: this.speed > 0.3,
      sprinting: this.camera.sprinting, vy: vel.y, time,
      headingDelta: this._lastHeadingDelta || 0,
    });
  }
  headPosition(out) {
    const p = this.dog.headWorldPosition(out || new THREE.Vector3());
    // Camera target spec: dog head + (0, 1.2m, 0) above feet ≈ head pos + 0.35
    p.y += 0.35;
    return p;
  }
  position() { return this.physics.dogPosition(); }
  resetToSpawn() { this.spawn(); }
}
