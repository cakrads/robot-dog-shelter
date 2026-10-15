// Named constants — no magic numbers elsewhere without importing these.
export const SHELTER = {
  WIDTH: 60, DEPTH: 40,
  MIN_X: -30, MAX_X: 30, MIN_Z: -20, MAX_Z: 20,
  WALL_HEIGHT: 6, WALL_THICKNESS: 0.4,
};

export const ZONES = {
  lobby:  { label: 'Lobby',   x0: -30, x1: 30,  z0: 14,  z1: 20,  floor: 0xd9c9a3, light: 0xfff2cc },
  play:   { label: 'Play',    x0: -30, x1: -10, z0: -5,  z1: 14,  floor: 0xffd9b3, light: 0xffe0b3 },
  sleep:  { label: 'Sleep',   x0: -10, x1: 10,  z0: -5,  z1: 14,  floor: 0xc9d6ff, light: 0xbfd0ff },
  eat:    { label: 'Eat',     x0: 10,  x1: 30,  z0: -5,  z1: 14,  floor: 0xc9f2d0, light: 0xd0ffd8 },
  groom:  { label: 'Groom',   x0: -30, x1: -10, z0: -20, z1: -5,  floor: 0xf2c9e0, light: 0xffd0e8 },
  garden: { label: 'Garden',  x0: -10, x1: 30,  z0: -20, z1: -5,  floor: 0xbfe8c9, light: 0xc8ffd0 },
};
export const EXPLORE_ZONES = ['play', 'sleep', 'eat', 'groom', 'garden'];

export const SPAWN = { x: 0, y: 0, z: 14, facing: Math.PI }; // facing north (-z): local +Z rotated PI => +Z maps to -Z

export const PHYSICS = {
  GRAVITY: -22,
  WALK_SPEED: 4.5,
  SPRINT_MULT: 1.6,
  SPRINT_SPEED: 7.2,
  JUMP_VELOCITY: 8.2,
  AIR_CONTROL: 0.6,
  ACCEL: 40, DECEL: 50,
  TURN_LERP: 12,
  COYOTE: 0.1, JUMP_BUFFER: 0.15,
  FIXED_DT: 1 / 60, MAX_SUBSTEPS: 3, MAX_DELTA: 0.033,
  CAPSULE_RADIUS: 0.35, CAPSULE_HALF_HEIGHT: 0.35,
};

export const CAMERA = {
  DEFAULT_DIST: 7, MIN_DIST: 3.5, MAX_DIST: 12, WHEEL_STEP: 0.5,
  ZOOM_LERP: 10, FOLLOW_LERP: 8, DAMPING: 8,
  PITCH_MIN: -5 * Math.PI / 180, PITCH_MAX: 55 * Math.PI / 180,
  FOV: 55, FOV_SPRINT: 58, FOV_LERP: 6,
  ORBIT_SENS: 0.35 * Math.PI / 180, // rad per px
  TARGET_HEIGHT: 1.2, MIN_Y: 0.4, MAX_Y: 5.5, COLLISION_OFFSET: 0.3,
  LAND_SHAKE_TIME: 0.08, LAND_SHAKE_AMP: 0.05,
  BARK_SHAKE_TIME: 0.05, BARK_SHAKE_AMP: 0.03,
};

export const DOG = {
  BODY_LENGTH: 0.9, SHOULDER_HEIGHT: 0.55,
  BLEND_TIME: 0.15, BARK_DURATION: 0.4, LAND_SQUASH_TIME: 0.12,
  EAR_TWITCH_MIN: 3, EAR_TWITCH_MAX: 6,
  INTERACT_RANGE_BALL: 1.2, INTERACT_RANGE_BASKET: 1.5,
  INTERACT_RANGE_BAG: 1.2, INTERACT_RANGE_BOWL: 1.8,
};

export const MISSIONS = {
  FETCH_POINTS: 100, FEED_POINTS: 100, EXPLORE_POINTS: 50,
};

export const RENDER = {
  TONE_EXPOSURE: 1.0, SHADOW_MAP_HIGH: 2048, SHADOW_MAP_LOW: 1024,
  BLOOM_THRESHOLD: 0.95, BLOOM_STRENGTH: 0.12, BLOOM_RADIUS: 0.4,
  MAX_DPR: 2,
};

// World-space anchors for missions / interactive props.
export const INTERACTIVE = {
  BALL_START: { x: -20, y: 0.18, z: 0 },
  BASKET_POS: { x: -20, y: 0, z: 10 },
  BAG_START: { x: 16, y: 0.3, z: 11 },
  BOWL_ZONE_CENTER: { x: 20, y: 0, z: 2 },
};
