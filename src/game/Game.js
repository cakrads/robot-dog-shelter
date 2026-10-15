// State machine: LOADING / MENU / PLAYING / PAUSED / COMPLETE.
// Owns renderer, scene, loop, fixed-timestep physics, auto-quality, bloom.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PHYSICS, RENDER, CAMERA } from '../utils/constants.js';
import { DustPool } from '../utils/helpers.js';
import { Physics } from './Physics.js';
import { Player } from './Player.js';
import { CameraRig } from './CameraRig.js';
import { Missions } from './Missions.js';
import { Shelter } from '../world/Shelter.js';
import { RobotDog } from '../world/RobotDog.js';
import { HUD } from '../ui/HUD.js';
import { AudioManager } from '../audio/Audio.js';
import { Input } from './Input.js';

export const STATES = { LOADING: 'loading', MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', COMPLETE: 'complete' };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = STATES.LOADING;
    this.audio = new AudioManager();
    this.hud = new HUD({
      onReadyClick: () => {
        this.audio.unlock(); this.audio.uiClick();
        this.hud.showLoading(false); this.hud.showMenu(true);
        this.state = STATES.MENU;
      },
      onPlay: (mode) => this.startGame(mode || 'missions'),
      onPauseToggle: () => this.togglePause(),
      onResume: () => this.resume(),
      onRestart: () => this.restart(),
      onShowControls: () => this.hud.showControlsModal(),
      onMainMenu: () => this.toMenu(),
      onMute: () => { this.audio.setMuted(!this.audio.isMuted); this.hud.setMute(this.audio.isMuted); },
      onQuality: (q) => this.setQuality(q),
      onPlayAgain: () => this.startGame('missions'),
      onFreeRoam: () => this.startGame('sandbox'),
    });
    this.clock = new THREE.Clock();
    this.elapsed = 0; this.playTime = 0;
    this.accumulator = 0;
    this.fpsAccum = 0; this.fpsFrames = 0; this.lowFpsTime = 0;
    this.quality = 'high'; this.bloomOn = true;
    this._raf = 0; this._disposed = false;
    this._tmpV = new THREE.Vector3(); this._tmpMouth = new THREE.Vector3();
  }

  async init() {
    this.hud.setLoading(0.1, 'Starting renderer…');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.MAX_DPR));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = RENDER.TONE_EXPOSURE;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe8ff);
    this.scene.fog = new THREE.Fog(0xbfe8ff, 60, 120);
    this.camera = new THREE.PerspectiveCamera(CAMERA.FOV, window.innerWidth / window.innerHeight, 0.1, 300);

    // Environment reflections (no HDR file) — kept dim so it doesn't wash out the shelter
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();

    this._setupLights();
    this.hud.setLoading(0.35, 'Loading physics (Rapier)…');
    this.physics = await Physics.create();
    this.hud.setLoading(0.55, 'Building shelter…');
    this.shelter = new Shelter(this.scene, this.physics);
    this.dog = new RobotDog();
    this.scene.add(this.dog.group);
    this.dust = new DustPool(this.scene);
    this.cameraRig = new CameraRig(this.camera, this.physics);
    this.physics.createDog(0, 0.7, 14);
    this.player = new Player(this.physics, this.dog, this.cameraRig, this.audio, this.dust);
    this.player.onLand = () => this.cameraRig.triggerLandShake();
    this.player.spawn();

    this.missions = new Missions({
      ballMesh: this.shelter.props.ballMesh, bagMesh: this.shelter.props.bagMesh,
      onToast: (t) => this.hud.showToast(t),
      onScore: (s) => this.hud.setScore(s),
      onMission: (snap) => { this.hud.setMissions(snap); this._lastSnap = snap; },
      onComplete: () => { this.audio.missionComplete(); this.completeGame(); },
      onPickup: () => { this.audio.pickup(); this.dog.triggerInteract(); },
      onDrop: () => { this.audio.drop(); this.dog.triggerInteract(); },
    });
    this._lastSnap = this.missions.snapshot();
    this.hud.setMissions(this._lastSnap);

    // Post-processing: subtle bloom
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      RENDER.BLOOM_STRENGTH, RENDER.BLOOM_RADIUS, RENDER.BLOOM_THRESHOLD);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.input = new Input(this.canvas, {
      joystick: document.getElementById('joystick'),
      joystickKnob: document.getElementById('joystickKnob'),
      btnJump: document.getElementById('btnJump'),
      btnInteract: document.getElementById('btnInteract'),
      btnBark: document.getElementById('btnBark'),
      btnSprint: document.getElementById('btnSprint'),
    });

    window.addEventListener('resize', this._onResize);
    this.hud.setMute(this.audio.isMuted);
    this.hud.setQuality('high');
    this.hud.setLoading(1, 'Ready — click to enter!');
    this.hud.showClickToPlay(true);
    this.state = STATES.LOADING; // stays here until Click to Play (audio unlock gesture)
    this._lastTime = performance.now();
    this._loop();
  }

  _onResize = () => {
    if (!this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer?.setSize(window.innerWidth, window.innerHeight);
  };

  _setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a6a4a, 0.5));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.2);
    sun.position.set(10, 24, -8); sun.castShadow = true;
    sun.shadow.mapSize.set(RENDER.SHADOW_MAP_HIGH, RENDER.SHADOW_MAP_HIGH);
    sun.shadow.camera.left = -32; sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
    sun.shadow.camera.far = 60; sun.shadow.bias = -0.0004;
    this.scene.add(sun); this.sun = sun;
    // 6 warm point lights, one per zone — only the first 2 cast shadows
    const centres = [[0, 17], [-20, 4.5], [0, 4.5], [20, 4.5], [-20, -12.5], [10, -12.5]];
    this.pointLights = [];
    centres.forEach(([x, z], i) => {
      const p = new THREE.PointLight(0xffd9a0, 7, 22, 1.8);
      p.position.set(x, 5.2, z);
      if (i < 2) { p.castShadow = true; p.shadow.mapSize.set(512, 512); p.shadow.bias = -0.004; }
      this.scene.add(p); this.pointLights.push(p);
    });
  }

  startGame(mode = 'missions') {
    this.audio.unlock(); this.audio.uiClick();
    this.input.clearTransient();
    this.missions.setMode(mode);
    this.missions.reset();
    this.player.spawn();
    this.playTime = 0;
    this.hud.setMode(mode);
    this.hud.showMenu(false); this.hud.showComplete(false);
    this.hud.showPause(false); this.hud.showHUD(true);
    this.hud.showToast(mode === 'sandbox' ? 'Free Roam — explore the shelter!' : 'Missions started — check the tracker!');
    this.state = STATES.PLAYING;
  }
  restart() { this.audio.uiClick(); this.startGame(this.missions.mode); }
  toMenu() {
    this.audio.uiClick();
    this.state = STATES.MENU;
    this.hud.showHUD(false); this.hud.showPause(false); this.hud.showComplete(false);
    this.hud.showMenu(true);
    this.input.clearTransient();
  }
  togglePause() {
    if (this.state === STATES.PLAYING) { this.state = STATES.PAUSED; this.hud.showPause(true); }
    else if (this.state === STATES.PAUSED) this.resume();
  }
  resume() {
    if (this.state !== STATES.PAUSED) return;
    this.audio.uiClick(); this.state = STATES.PLAYING; this.hud.showPause(false);
    this.input.clearTransient();
  }
  completeGame() {
    this.state = STATES.COMPLETE;
    this.hud.showComplete(true, {
      time: this.hud.formatTime(this.playTime), score: this.missions.score, missions: 3,
    });
  }
  setQuality(q) {
    this.quality = q; this.hud.setQuality(q); this.audio.uiClick();
    if (q === 'low') { this.renderer.setPixelRatio(1); this.sun.shadow.mapSize.set(RENDER.SHADOW_MAP_LOW, RENDER.SHADOW_MAP_LOW); this.bloomOn = false; }
    else if (q === 'medium') { this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); this.sun.shadow.mapSize.set(RENDER.SHADOW_MAP_LOW, RENDER.SHADOW_MAP_LOW); this.bloomOn = false; }
    else { this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, RENDER.MAX_DPR)); this.sun.shadow.mapSize.set(RENDER.SHADOW_MAP_HIGH, RENDER.SHADOW_MAP_HIGH); this.bloomOn = true; }
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    if (this.bloomPass) this.bloomPass.enabled = this.bloomOn;
  }

  _handleActions() {
    if (this.input.consume('pause')) this.togglePause();
    if (this.input.consume('mute')) { this.audio.setMuted(!this.audio.isMuted); this.hud.setMute(this.audio.isMuted); }
    if (this.input.consume('minimap')) this.hud.toggleMinimap();
    if (this.state !== STATES.PLAYING) return;
    if (this.input.consume('reset')) { this.player.resetToSpawn(); this.hud.showToast('Dog reset to spawn'); }
    if (this.input.consume('bark')) { this.dog.triggerBark(); this.audio.bark(); this.cameraRig.triggerBarkShake(); }
    if (this.input.consume('interact')) {
      const pos = this.player.position();
      this.missions.interact(pos);
      // Interact pose + prompt refresh handled in fixed loop via snapshot
    }
  }

  _loop = () => {
    if (this._disposed) return;
    this._raf = requestAnimationFrame(this._loop);
    const now = performance.now();
    let dt = Math.min((now - this._lastTime) / 1000, PHYSICS.MAX_DELTA);
    this._lastTime = now;
    this.elapsed += dt;

    // FPS monitor for auto-quality
    this.fpsAccum += dt; this.fpsFrames++;
    if (this.fpsAccum >= 1) {
      const fps = this.fpsFrames / this.fpsAccum; this.fpsAccum = 0; this.fpsFrames = 0;
      if (this.state === STATES.PLAYING && fps < 45) {
        this.lowFpsTime += 1;
        if (this.lowFpsTime >= 3 && this.quality === 'high') { this.setQuality('medium'); this.hud.showToast('Auto quality: lowered for smooth framerate'); }
      } else this.lowFpsTime = 0;
    }

    // Camera orbit / zoom from input (even when paused, allow orbit? No — freeze when paused)
    if (this.state === STATES.PLAYING) {
      const md = this.input.takeMouseDelta();
      if (md.dx !== 0 || md.dy !== 0) this.cameraRig.addOrbit(md.dx, md.dy);
      const wheel = this.input.takeWheel();
      if (wheel !== 0) this.cameraRig.addZoom(wheel);
      this._handleActions();
      this.playTime += dt;
      this.hud.setTime(this.playTime);

      // Fixed-timestep physics
      this.accumulator += dt;
      let steps = 0;
      const mv = this.input.moveVector();
      const jumpPressed = this.input.consume('jumpPressed');
      while (this.accumulator >= PHYSICS.FIXED_DT && steps < PHYSICS.MAX_SUBSTEPS) {
        this.player.fixedUpdate(PHYSICS.FIXED_DT, {
          mx: mv.x, mz: mv.z, sprint: this.input.sprinting, jumpPressed: steps === 0 ? jumpPressed : false,
        });
        this.physics.step();
        this.accumulator -= PHYSICS.FIXED_DT; steps++;
      }
      if (steps === PHYSICS.MAX_SUBSTEPS) this.accumulator = 0;
      // Visual sync + missions + prompt
      this.player.syncVisual(this.elapsed, dt);
      const dogPos = this.player.position();
      const mouth = this.dog.mouthSocket.getWorldPosition(this._tmpMouth);
      this.missions.update(dogPos, mouth, this.player.heading);
      this.hud.setPrompt(this.missions.prompt(dogPos));
      const head = this.player.headPosition(this._tmpV);
      this.cameraRig.update(dt, head);
      this.dust.update(dt);
      // Minimap (throttled to every frame is fine — small canvas)
      this.hud.drawMinimap(dogPos, this.player.heading, this.missions.snapshot());
    } else if (this.state === STATES.MENU || this.state === STATES.COMPLETE || this.state === STATES.LOADING) {
      // Gentle menu orbit: slow yaw drift so the menu shows the shelter
      this.cameraRig.yaw += dt * 0.05;
      const head = this.player.headPosition(this._tmpV);
      this.cameraRig.update(dt, head);
      this.dust.update(dt);
      this.input.takeMouseDelta(); this.input.takeWheel(); this._handleActions();
    } else if (this.state === STATES.PAUSED) {
      this._handleActions(); // Esc/P resumes
      this.input.takeMouseDelta(); this.input.takeWheel();
    }

    // Render (bloom via composer when on, else direct)
    if (this.bloomOn && this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  dispose() { this._disposed = true; cancelAnimationFrame(this._raf); this.input?.dispose(); this.audio.dispose(); }
}
