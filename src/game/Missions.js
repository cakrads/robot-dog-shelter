// Missions + scoring. Pure logic; Game wires audio/HUD/toast callbacks.
import { ZONES, EXPLORE_ZONES, MISSIONS, DOG, INTERACTIVE } from '../utils/constants.js';
import { dist2D, pointInZone } from '../utils/helpers.js';

export class Missions {
  constructor({ ballMesh, bagMesh, onToast, onScore, onMission, onComplete, onPickup, onDrop }) {
    this.ballMesh = ballMesh; this.bagMesh = bagMesh;
    this.onToast = onToast; this.onScore = onScore; this.onMission = onMission;
    this.onComplete = onComplete; this.onPickup = onPickup; this.onDrop = onDrop;
    this.mode = 'missions'; // 'missions' | 'sandbox'
    this.reset();
  }
  reset() {
    this.score = 0;
    this.fetchDone = false; this.feedDone = false;
    this.visited = new Set();
    this.carrying = null; // 'ball' | 'bag' | null
    this.ballPlaced = false;
    this._lastInteractHint = '';
    this.resetItems();
    this._emit();
  }
  resetItems() {
    if (this.ballMesh) this.ballMesh.position.set(INTERACTIVE.BALL_START.x, INTERACTIVE.BALL_START.y, INTERACTIVE.BALL_START.z);
    if (this.bagMesh) this.bagMesh.position.set(INTERACTIVE.BAG_START.x, INTERACTIVE.BAG_START.y, INTERACTIVE.BAG_START.z);
    this.carrying = null;
  }
  setMode(mode) { this.mode = mode; if (mode === 'sandbox') { /* missions hidden but still tracked silently */ } }
  get allComplete() { return this.fetchDone && this.feedDone && this.visited.size >= EXPLORE_ZONES.length; }
  get completedCount() { return (this.fetchDone ? 1 : 0) + (this.feedDone ? 1 : 0) + (this.visited.size >= EXPLORE_ZONES.length ? 1 : 0); }
  addScore(n) { this.score += n; this.onScore?.(this.score); }

  /** Called every frame with dog pos + mouth socket world pos. */
  update(dogPos, mouthWorldPos, dogHeading) {
    // Carried item follows mouth socket
    if (this.carrying === 'ball' && this.ballMesh) {
      this.ballMesh.position.copy(mouthWorldPos);
      this.ballMesh.rotation.y = dogHeading;
    }
    if (this.carrying === 'bag' && this.bagMesh) {
      this.bagMesh.position.copy(mouthWorldPos); this.bagMesh.position.y -= 0.1;
      this.bagMesh.rotation.y = dogHeading;
    }
    // Explore: zone visit
    for (const key of EXPLORE_ZONES) {
      if (!this.visited.has(key) && pointInZone(dogPos.x, dogPos.z, ZONES[key])) {
        this.visited.add(key);
        this.addScore(MISSIONS.EXPLORE_POINTS);
        this.onToast?.(`Explored ${ZONES[key].label} Zone  +${MISSIONS.EXPLORE_POINTS}`);
        this.onMission?.(this.snapshot());
        this._checkComplete();
      }
    }
  }

  /** E pressed. Returns a hint string for HUD prompt. */
  interact(dogPos) {
    // Carrying ball near basket -> complete FETCH
    if (this.carrying === 'ball') {
      if (dist2D(dogPos.x, dogPos.z, INTERACTIVE.BASKET_POS.x, INTERACTIVE.BASKET_POS.z) < DOG.INTERACT_RANGE_BASKET) {
        this.carrying = null;
        this.ballMesh.position.set(INTERACTIVE.BASKET_POS.x, 0.7, INTERACTIVE.BASKET_POS.z);
        this.fetchDone = true; this.addScore(MISSIONS.FETCH_POINTS);
        this.onDrop?.(); this.onToast?.(`FETCH complete!  +${MISSIONS.FETCH_POINTS}`);
        this.onMission?.(this.snapshot()); this._checkComplete();
        return 'fetch-done';
      }
      // Drop ball at feet otherwise
      this.carrying = null;
      this.ballMesh.position.set(dogPos.x, 0.18, dogPos.z + 0.9);
      this.onDrop?.(); this.onToast?.('Dropped the ball');
      return 'dropped';
    }
    // Carrying bag near food-bowl zone -> complete FEED
    if (this.carrying === 'bag') {
      const d = dist2D(dogPos.x, dogPos.z, INTERACTIVE.BOWL_ZONE_CENTER.x, INTERACTIVE.BOWL_ZONE_CENTER.z);
      if (d < 4.5) {
        this.carrying = null;
        this.bagMesh.position.set(INTERACTIVE.BOWL_ZONE_CENTER.x, 0.3, INTERACTIVE.BOWL_ZONE_CENTER.z + 1.5);
        this.feedDone = true; this.addScore(MISSIONS.FEED_POINTS);
        this.onDrop?.(); this.onToast?.(`FEED complete!  +${MISSIONS.FEED_POINTS}`);
        this.onMission?.(this.snapshot()); this._checkComplete();
        return 'feed-done';
      }
      this.carrying = null;
      this.bagMesh.position.set(dogPos.x, 0.3, dogPos.z + 0.9);
      this.onDrop?.(); this.onToast?.('Dropped the kibble bag');
      return 'dropped';
    }
    // Pick up ball
    const ballPos = this.ballMesh.position;
    if (!this.fetchDone && dist2D(dogPos.x, dogPos.z, ballPos.x, ballPos.z) < DOG.INTERACT_RANGE_BALL) {
      this.carrying = 'ball'; this.onPickup?.(); this.onToast?.('Picked up the ball — bring it to the basket!');
      return 'picked-ball';
    }
    // Pick up bag
    const bagPos = this.bagMesh.position;
    if (!this.feedDone && dist2D(dogPos.x, dogPos.z, bagPos.x, bagPos.z) < DOG.INTERACT_RANGE_BAG) {
      this.carrying = 'bag'; this.onPickup?.(); this.onToast?.('Picked up the kibble bag — bring it to the food bowls!');
      return 'picked-bag';
    }
    return 'nothing';
  }

  /** Contextual prompt for HUD ("Press E to ...") or '' when nothing nearby. */
  prompt(dogPos) {
    if (this.carrying === 'ball') {
      if (dist2D(dogPos.x, dogPos.z, INTERACTIVE.BASKET_POS.x, INTERACTIVE.BASKET_POS.z) < DOG.INTERACT_RANGE_BASKET)
        return 'Press E — drop ball in basket';
      return 'Press E — drop ball';
    }
    if (this.carrying === 'bag') {
      if (dist2D(dogPos.x, dogPos.z, INTERACTIVE.BOWL_ZONE_CENTER.x, INTERACTIVE.BOWL_ZONE_CENTER.z) < 4.5)
        return 'Press E — fill the food bowls';
      return 'Press E — drop kibble bag';
    }
    if (!this.fetchDone && dist2D(dogPos.x, dogPos.z, this.ballMesh.position.x, this.ballMesh.position.z) < DOG.INTERACT_RANGE_BALL)
      return 'Press E — pick up ball';
    if (!this.feedDone && dist2D(dogPos.x, dogPos.z, this.bagMesh.position.x, this.bagMesh.position.z) < DOG.INTERACT_RANGE_BAG)
      return 'Press E — pick up kibble bag';
    return '';
  }

  snapshot() {
    return {
      score: this.score, fetchDone: this.fetchDone, feedDone: this.feedDone,
      visited: new Set(this.visited), exploreDone: this.visited.size >= EXPLORE_ZONES.length,
      carrying: this.carrying, allComplete: this.allComplete,
      ballPos: this.ballMesh ? { x: this.ballMesh.position.x, z: this.ballMesh.position.z } : null,
      bagPos: this.bagMesh ? { x: this.bagMesh.position.x, z: this.bagMesh.position.z } : null,
    };
  }
  _emit() { this.onScore?.(this.score); this.onMission?.(this.snapshot()); }
  _checkComplete() { if (this.allComplete && this.mode === 'missions') this.onComplete?.(this.score); }
}
