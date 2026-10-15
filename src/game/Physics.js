// Rapier wrapper: world, static colliders, dog body, raycasts, grounded check.
import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS, SHELTER } from '../utils/constants.js';

export class Physics {
  constructor() { this.world = null; this.dogBody = null; this.dogCollider = null; }
  static async create() {
    await RAPIER.init();
    const p = new Physics();
    p.world = new RAPIER.World({ x: 0, y: PHYSICS.GRAVITY, z: 0 });
    p.world.timestep = PHYSICS.FIXED_DT;
    p.RAPIER = RAPIER;
    // Floor
    p.addStaticBox(0, -0.5, 0, SHELTER.WIDTH / 2 + 1, 0.5, SHELTER.DEPTH / 2 + 1);
    // Perimeter walls (invisible boundary = same as visible walls)
    const H = SHELTER.WALL_HEIGHT / 2, T = SHELTER.WALL_THICKNESS / 2;
    p.addStaticBox(0, H, -SHELTER.DEPTH / 2 - T, SHELTER.WIDTH / 2 + T, H, T); // north
    p.addStaticBox(0, H, SHELTER.DEPTH / 2 + T, SHELTER.WIDTH / 2 + T, H, T);  // south
    p.addStaticBox(-SHELTER.WIDTH / 2 - T, H, 0, T, H, SHELTER.DEPTH / 2 + T); // west
    p.addStaticBox(SHELTER.WIDTH / 2 + T, H, 0, T, H, SHELTER.DEPTH / 2 + T);  // east
    return p;
  }
  addStaticBox(x, y, z, hx, hy, hz) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    const col = this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
    return col;
  }
  addStaticCapsule(x, y, z, halfHeight, radius) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    return this.world.createCollider(RAPIER.ColliderDesc.capsule(halfHeight, radius), body);
  }
  createDog(x, y, z) {
    const desc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, y, z).lockRotations().setCcdEnabled(true).setLinearDamping(0.05);
    this.dogBody = this.world.createRigidBody(desc);
    this.dogCollider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(PHYSICS.CAPSULE_HALF_HEIGHT, PHYSICS.CAPSULE_RADIUS).setDensity(1).setFriction(0.2),
      this.dogBody);
    return this.dogBody;
  }
  step() { this.world.step(); }
  dogPosition() { const t = this.dogBody.translation(); return { x: t.x, y: t.y, z: t.z }; }
  dogVelocity() { const v = this.dogBody.linvel(); return { x: v.x, y: v.y, z: v.z }; }
  setDogVelocity(x, y, z) { this.dogBody.setLinvel({ x, y, z }, true); }
  setDogPosition(x, y, z) { this.dogBody.setTranslation({ x, y, z }, true); this.dogBody.setLinvel({ x: 0, y: 0, z: 0 }, true); }
  /** Grounded: raycast down from dog centre + contact normal check. */
  isGrounded() {
    const pos = this.dogPosition();
    const ray = new RAPIER.Ray({ x: pos.x, y: pos.y + 0.1, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRayAndGetNormal(ray, 0.95, true, undefined, undefined, this.dogCollider, this.dogBody);
    if (hit && hit.normal && hit.normal.y > 0.7) return true;
    // Fallback: vertical speed near zero and close to floor level
    if (Math.abs(this.dogVelocity().y) < 0.15 && pos.y < PHYSICS.CAPSULE_RADIUS + PHYSICS.CAPSULE_HALF_HEIGHT + 0.12) return true;
    return false;
  }
  /** Camera collision: ray from target toward desired camera pos. Returns distance to first hit or maxDist. */
  raycastCamera(from, dir, maxDist) {
    const ray = new RAPIER.Ray({ x: from.x, y: from.y, z: from.z }, { x: dir.x, y: dir.y, z: dir.z });
    const hit = this.world.castRayAndGetNormal(ray, maxDist, true, undefined, undefined, this.dogCollider, this.dogBody);
    // Rapier 0.21 compat names the field `timeOfImpact` (not `toi`).
    if (hit) return hit.timeOfImpact ?? hit.toi ?? maxDist;
    return maxDist;
  }
}
