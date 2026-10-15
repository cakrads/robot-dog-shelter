// MMORPG third-person camera: follow, orbit, zoom, collision, shake.
import * as THREE from 'three';
import { CAMERA } from '../utils/constants.js';
import { clamp, damp } from '../utils/helpers.js';

export class CameraRig {
  constructor(camera, physics) {
    this.camera = camera; this.physics = physics;
    this.yaw = 0; this.pitch = 0.42; // radians, looking slightly down
    this.targetDist = CAMERA.DEFAULT_DIST; this.dist = CAMERA.DEFAULT_DIST;
    this.currentTarget = new THREE.Vector3(0, 1.2, 14);
    this.smoothedTarget = new THREE.Vector3(0, 1.2, 14);
    this.shakeTime = 0; this.shakeAmp = 0;
    this._desired = new THREE.Vector3(); this._dir = new THREE.Vector3();
    this.sprinting = false;
  }
  addOrbit(dxPx, dyPx) {
    this.yaw -= dxPx * CAMERA.ORBIT_SENS;
    this.pitch = clamp(this.pitch + dyPx * CAMERA.ORBIT_SENS, CAMERA.PITCH_MIN, CAMERA.PITCH_MAX);
  }
  addZoom(wheelDeltaY) {
    const steps = wheelDeltaY > 0 ? 1 : -1;
    this.targetDist = clamp(this.targetDist + steps * CAMERA.WHEEL_STEP, CAMERA.MIN_DIST, CAMERA.MAX_DIST);
  }
  triggerLandShake() { this.shakeTime = CAMERA.LAND_SHAKE_TIME; this.shakeAmp = CAMERA.LAND_SHAKE_AMP; }
  triggerBarkShake() { this.shakeTime = CAMERA.BARK_SHAKE_TIME; this.shakeAmp = CAMERA.BARK_SHAKE_AMP; }
  reset(yaw = 0) { this.yaw = yaw; this.pitch = 0.42; this.targetDist = CAMERA.DEFAULT_DIST; this.dist = CAMERA.DEFAULT_DIST; }

  update(dt, dogHeadPos) {
    // Smooth zoom
    this.dist = damp(this.dist, this.targetDist, CAMERA.ZOOM_LERP, dt);
    // Smooth follow target
    this.currentTarget.copy(dogHeadPos); // dog head world pos
    this.currentTarget.y = dogHeadPos.y; // already includes head height; keep as-is
    // CameraRig target spec: dog head + (0,1.2,0) — headWorldPosition already ~0.85 above
    // floor, so add the remainder via the caller passing head pos; here we just smooth.
    this.smoothedTarget.x = damp(this.smoothedTarget.x, this.currentTarget.x, CAMERA.FOLLOW_LERP, dt);
    this.smoothedTarget.y = damp(this.smoothedTarget.y, this.currentTarget.y, CAMERA.FOLLOW_LERP, dt);
    this.smoothedTarget.z = damp(this.smoothedTarget.z, this.currentTarget.z, CAMERA.FOLLOW_LERP, dt);

    const sinP = Math.sin(this.pitch), cosP = Math.cos(this.pitch);
    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * cosP, sinP, Math.cos(this.yaw) * cosP).multiplyScalar(this.dist);
    this._desired.copy(this.smoothedTarget).add(offset);

    // Collision: raycast target -> desired, pull in to hit + 0.3m
    const dir = this._dir.copy(offset).normalize();
    const hitDist = this.physics.raycastCamera(this.smoothedTarget, dir, this.dist);
    let finalDist = this.dist;
    if (hitDist < this.dist) finalDist = Math.max(0.5, hitDist - CAMERA.COLLISION_OFFSET);
    const finalPos = new THREE.Vector3().copy(this.smoothedTarget).addScaledVector(dir, finalDist);
    finalPos.y = clamp(finalPos.y, CAMERA.MIN_Y, CAMERA.MAX_Y);

    // Shake (landing / bark only)
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeTime / 0.08;
      finalPos.x += (Math.random() - 0.5) * this.shakeAmp * s;
      finalPos.y += (Math.random() - 0.5) * this.shakeAmp * s;
    }
    this.camera.position.copy(finalPos);
    this.camera.lookAt(this.smoothedTarget);

    // FOV: 55, 58 when sprinting
    const targetFov = this.sprinting ? CAMERA.FOV_SPRINT : CAMERA.FOV;
    if (Math.abs(this.camera.fov - targetFov) > 0.01) {
      this.camera.fov = damp(this.camera.fov, targetFov, CAMERA.FOV_LERP, dt);
      this.camera.updateProjectionMatrix();
    }
  }
  /** Camera forward on XZ plane, for movement relative to camera. */
  forwardXZ() {
    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f); f.y = 0; f.normalize();
    // Camera looks from behind dog toward dog; movement forward should follow camera look dir.
    return f;
  }
  rightXZ() {
    const f = this.forwardXZ();
    return new THREE.Vector3(-f.z, 0, f.x); // note: right = forward x up? computed below in Player instead
  }
}
