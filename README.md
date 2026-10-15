# Robot Dog Shelter — 3D Simulator

A polished, playable 3D robotic dog simulator with a third-person MMORPG-style camera,
inside a large indoor dog shelter. Vanilla JavaScript + Three.js + Rapier. Local only —
no deployment, no CDN game assets, no external fonts/textures/models.

## Tech stack (exact, pinned in `package.json`)

| Dependency | Version |
|---|---|
| three | 0.186.1 |
| @dimforge/rapier3d-compat | 0.21.0 |
| vite (dev + build) | 8.3.4 |
| Node | 20 LTS (tested on Node 24) |

Rendering: WebGL2, MeshStandardMaterial PBR, ACESFilmic tone mapping (exposure 1.1),
sRGB output, PCFSoft shadows, RoomEnvironment reflections (no HDR file), subtle
UnrealBloom (threshold 0.85, strength 0.25, auto-disabled under load).

## Run locally

```bash
npm install
npm run dev      # dev server → http://127.0.0.1:5173
npm run build    # production build
npm run preview  # serves the build → http://127.0.0.1:4173
```

Open the URL, click **Click to Play** (unlocks audio), then **Play Missions** or **Free Roam**.

## Controls

| Input | Action |
|---|---|
| W A S D / Arrow keys | Move relative to camera |
| SPACE | Jump (grounded only, coyote 0.1s, jump buffer 0.15s) |
| SHIFT (hold) | Sprint 1.6×, FOV +4 |
| Mouse drag (left or right) | Orbit camera (yaw 360°, pitch −5°…55°) |
| Mouse wheel | Zoom 3.5–12m |
| E | Interact / pick up / drop |
| F | Bark (animation + sound + camera shake) |
| R | Reset dog to spawn |
| P / Esc | Pause / resume |
| M | Mute / unmute (persists in localStorage) |
| Tab | Toggle minimap |
| Touch | Left joystick = move, right drag = orbit, buttons = Jump / Sprint / E / Bark |

## Gameplay

- **Sandbox / Free Roam:** explore freely.
- **Missions (5–10 min total):**
  1. **FETCH** — pick up the orange ball in the Play Zone (E), bring it to the basket. +100
  2. **FEED** — pick up the kibble bag in the Eat Zone (E), bring it to the food bowls (E). +100
  3. **EXPLORE** — visit all 5 zones: Play, Sleep, Eat, Groom, Garden. +50 each
- All missions complete → Completion screen with time + score, **Play Again** + **Free Roam**.

## Architecture

```
index.html                  UI overlay: loading, menu, HUD, pause, completion, touch, minimap
src/main.js                 Boot, WebGL2 check, error handling
src/game/Game.js            State machine LOADING / MENU / PLAYING / PAUSED / COMPLETE,
                            renderer, loop, fixed-timestep physics, auto-quality, bloom
src/game/Input.js           Keyboard + mouse + touch, edge-triggered actions, no listener leaks
src/game/Player.js          Dog movement, jump, grounded, turn lerp, visual sync
src/game/CameraRig.js       MMORPG camera: follow, orbit, zoom, raycast collision, shake
src/game/Physics.js         Rapier world, colliders, raycasts, grounded check
src/game/Missions.js        Objectives, scoring, pickup/carry/drop, completion
src/world/Shelter.js        Floor, walls, windows, ceiling/skylight, zone signs, info board
src/world/Props.js          Houses, beds, toys, ramps, bowls, plants… (InstancedMesh repeats)
src/world/RobotDog.js       Procedural dog + rig + blended animations
src/ui/HUD.js               HUD, minimap, toasts, pause, completion
src/audio/Audio.js          WebAudio synth SFX + ambient, mute persisted
src/utils/constants.js      All tuned numbers (physics, camera, zones, dog)
src/utils/helpers.js        Canvas textures, signs, dust-puff pool
```

## Exact numbers implemented

- Shelter 60m × 40m (x −30…30, z −20…20), walls 6m. Spawn (0, 0, 14) facing north (−z).
- Physics: gravity −22, walk 4.5 m/s, sprint 7.2 m/s, jump velocity 8.2 m/s (~1.5m),
  air control 0.6×, accel 40, decel 50, turn lerp 12/s, fixed timestep 1/60 (max 3 substeps),
  delta clamp 0.033. Dog capsule radius 0.35, half-height 0.35, fixed rotation.
  Grounded = downward raycast + contact normal Y > 0.7.
- Camera: default distance 7m, min 3.5m, max 12m, wheel step 0.5m, zoom lerp 10/s,
  pitch −5°…55°, FOV 55 (58 sprinting), target dog head + 1.2m, follow lerp 8/s,
  collision raycast pulls camera to hit + 0.3m, min y 0.4m, orbit 0.35°/px, damping 8/s.
  Shake only on landing (0.08s, 0.05m) and bark (0.05s).
- Dog: body ~0.9m, shoulder ~0.55m, 4 articulated legs, 2 ears + jaw, 3-segment tail,
  antenna + glowing chest core. Painted metal (metalness 0.6, roughness 0.35),
  white + teal + orange, emissive cyan eyes/core. Blend crossfade 0.15s.
  Stride length scales with speed so feet do not slide.

## Performance

- Shared geometries/materials + InstancedMesh for repeated props (houses, beds, bowls,
  plants, balls, crates, benches, fences, ceiling lights).
- Draw calls ≈ 70–90 (target < 120), triangles well under 150k.
- Shadows: sun (2048 map) + 2 nearest point lights only; other 4 point lights no shadows.
- DevicePixelRatio capped at 2, antialias on.
- Auto-quality: if FPS < 45 for 3s while playing, drops to Medium
  (shadow 1024, bloom off, pixelRatio ≤ 1.5). Manual Low/Medium/High in pause menu.

## Audio

All synthesized with WebAudio — no external files, no autoplay before a user gesture:
bark (square + noise), jump whoosh, land thud, pickup chime, mission jingle,
ambient brown-noise room tone + occasional distant bark.

## Verification

```bash
npm install && npm run build
npm run preview   # then open http://127.0.0.1:4173
```

Verification performed at build time: `npm run build` passes, `npm run preview`
serves HTTP 200 with the game canvas. Interactive playtest (movement, missions,
camera, touch) is intentionally left for a live-browser check — see acceptance
criteria in the project brief; nothing about playtest is claimed from the HTTP check.

## Notes / known limits

- No deployment is provided by design (local / preview only).
- The dog cannot climb ramps by walking (no step-up logic); ramps are low platforms
  the dog can jump onto, and the tunnel is walk-through.
- Fences along the lobby wall are decorative; the real boundary is the Rapier
  perimeter walls, so the dog can never leave the shelter or fall through the floor.
- Pickup items (ball, kibble bag) are visual + proximity logic, deliberately not
  physics bodies, so carrying never fights the physics solver.
