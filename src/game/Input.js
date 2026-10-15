// Keyboard + mouse + touch. Listeners attached once in constructor, removed in dispose().
// No per-frame listener creation. Edge-triggered actions are consumed via consume().
const KEYMAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'back', ArrowDown: 'back',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  Space: 'jump',
};

export class Input {
  constructor(canvas, els = {}) {
    this.canvas = canvas; this.els = els;
    this.held = new Set();           // held logical keys
    this.pressed = new Set();        // edge-triggered, consumed by game
    this.moveX = 0; this.moveZ = 0;  // from keyboard, -1..1 (x: right, z: forward)
    this.joyX = 0; this.joyY = 0;   // touch joystick -1..1
    this.joyActive = false;
    this.mouseDX = 0; this.mouseDY = 0; // accumulated drag delta since last take
    this.wheelDelta = 0;
    this.dragging = false; this.lastMX = 0; this.lastMY = 0;
    this.touchOrbitDX = 0; this.touchOrbitDY = 0;
    this._bound = {};
    this._attach();
  }
  _on(el, type, fn, opts) { el.addEventListener(type, fn, opts); (this._bound[type] ??= []).push([el, fn]); }
  _attach() {
    const onKeyDown = (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      const mapped = KEYMAP[e.code];
      if (mapped) this.held.add(mapped);
      // Edge actions (not held-repeat)
      if (!e.repeat) {
        if (e.code === 'KeyE') this.pressed.add('interact');
        if (e.code === 'KeyF') this.pressed.add('bark');
        if (e.code === 'KeyR') this.pressed.add('reset');
        if (e.code === 'KeyP' || e.code === 'Escape') this.pressed.add('pause');
        if (e.code === 'KeyM') this.pressed.add('mute');
        if (e.code === 'Tab') { e.preventDefault(); this.pressed.add('minimap'); }
        if (e.code === 'Space') this.pressed.add('jumpPressed');
      }
    };
    const onKeyUp = (e) => { const m = KEYMAP[e.code]; if (m) this.held.delete(m); };
    const onBlur = () => { this.held.clear(); this.joyX = 0; this.joyY = 0; this.joyActive = false; };
    this._on(window, 'keydown', onKeyDown);
    this._on(window, 'keyup', onKeyUp);
    this._on(window, 'blur', onBlur);

    const c = this.canvas;
    const onMouseDown = (e) => { this.dragging = true; this.lastMX = e.clientX; this.lastMY = e.clientY; };
    const onMouseMove = (e) => {
      if (!this.dragging) return;
      this.mouseDX += e.clientX - this.lastMX; this.mouseDY += e.clientY - this.lastMY;
      this.lastMX = e.clientX; this.lastMY = e.clientY;
    };
    const onMouseUp = () => { this.dragging = false; };
    const onWheel = (e) => { e.preventDefault(); this.wheelDelta += e.deltaY; };
    const onCtx = (e) => e.preventDefault();
    this._on(c, 'mousedown', onMouseDown);
    this._on(window, 'mousemove', onMouseMove);
    this._on(window, 'mouseup', onMouseUp);
    this._on(c, 'wheel', onWheel, { passive: false });
    this._on(c, 'contextmenu', onCtx);

    // Touch joystick (left) + orbit (right half of canvas)
    const joy = this.els.joystick, knob = this.els.joystickKnob;
    let joyId = null, joyCX = 0, joyCY = 0;
    if (joy) {
      const start = (e) => {
        const t = e.changedTouches[0]; joyId = t.identifier;
        const r = joy.getBoundingClientRect(); joyCX = r.left + r.width / 2; joyCY = r.top + r.height / 2;
        this.joyActive = true; this._moveJoy(t, joyCX, joyCY, knob);
      };
      const move = (e) => {
        for (const t of e.changedTouches) if (t.identifier === joyId) { this._moveJoy(t, joyCX, joyCY, knob); e.preventDefault(); }
      };
      const end = (e) => {
        for (const t of e.changedTouches) if (t.identifier === joyId) {
          joyId = null; this.joyActive = false; this.joyX = 0; this.joyY = 0;
          if (knob) knob.style.transform = 'translate(-50%,-50%)';
        }
      };
      this._on(joy, 'touchstart', start, { passive: true });
      this._on(joy, 'touchmove', move, { passive: false });
      this._on(joy, 'touchend', end); this._on(joy, 'touchcancel', end);
    }
    // Right-half orbit drag on canvas
    let orbitId = null, ox = 0, oy = 0;
    const tStart = (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX > window.innerWidth / 2 && orbitId === null) { orbitId = t.identifier; ox = t.clientX; oy = t.clientY; }
      }
    };
    const tMove = (e) => {
      for (const t of e.changedTouches) if (t.identifier === orbitId) {
        this.touchOrbitDX += t.clientX - ox; this.touchOrbitDY += t.clientY - oy; ox = t.clientX; oy = t.clientY; e.preventDefault();
      }
    };
    const tEnd = (e) => { for (const t of e.changedTouches) if (t.identifier === orbitId) orbitId = null; };
    this._on(c, 'touchstart', tStart, { passive: true });
    this._on(c, 'touchmove', tMove, { passive: false });
    this._on(c, 'touchend', tEnd); this._on(c, 'touchcancel', tEnd);

    // Touch action buttons
    const bindBtn = (el, action, holdAction) => {
      if (!el) return;
      const down = (e) => { e.preventDefault(); if (holdAction) this.held.add(holdAction); else this.pressed.add(action); };
      const up = (e) => { e.preventDefault(); if (holdAction) this.held.delete(holdAction); };
      this._on(el, 'touchstart', down, { passive: false });
      this._on(el, 'touchend', up, { passive: false });
      this._on(el, 'touchcancel', up, { passive: false });
      this._on(el, 'mousedown', down); this._on(el, 'mouseup', up);
    };
    bindBtn(this.els.btnJump, 'jumpPressed');
    bindBtn(this.els.btnInteract, 'interact');
    bindBtn(this.els.btnBark, 'bark');
    bindBtn(this.els.btnSprint, null, 'sprint');
  }
  _moveJoy(t, cx, cy, knob) {
    const R = 48;
    let dx = (t.clientX - cx) / R, dy = (t.clientY - cy) / R;
    const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
    this.joyX = dx; this.joyY = dy;
    if (knob) knob.style.transform = `translate(calc(-50% + ${dx * 36}px), calc(-50% + ${dy * 36}px))`;
  }
  /** Keyboard move vector: x = right (+), z = forward (+) in camera space. */
  moveVector() {
    let x = 0, z = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('forward')) z += 1;
    if (this.held.has('back')) z -= 1;
    if (this.joyActive) { x += this.joyX; z += -this.joyY; }
    const len = Math.hypot(x, z);
    if (len > 1) { x /= len; z /= len; }
    return { x, z };
  }
  get sprinting() { return this.held.has('sprint'); }
  consume(action) { if (this.pressed.has(action)) { this.pressed.delete(action); return true; } return false; }
  takeMouseDelta() { const d = { dx: this.mouseDX + this.touchOrbitDX, dy: this.mouseDY + this.touchOrbitDY }; this.mouseDX = 0; this.mouseDY = 0; this.touchOrbitDX = 0; this.touchOrbitDY = 0; return d; }
  takeWheel() { const w = this.wheelDelta; this.wheelDelta = 0; return w; }
  clearTransient() { this.pressed.clear(); this.mouseDX = 0; this.mouseDY = 0; this.wheelDelta = 0; }
  dispose() {
    for (const [type, list] of Object.entries(this._bound)) for (const [el, fn] of list) el.removeEventListener(type, fn);
    this._bound = {};
  }
}
