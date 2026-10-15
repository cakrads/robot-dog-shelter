// WebAudio synthesized SFX — no external files. No autoplay before a user gesture.
const MUTE_KEY = 'robot-dog-shelter-muted';

export class AudioManager {
  constructor() {
    this.ctx = null; this.master = null; this.ambientNodes = null;
    this.muted = false;
    try { this.muted = typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1'; } catch { this.muted = false; }
    this._distantBarkTimer = null;
  }
  /** Must be called from a user gesture (Click to Play). Safe to call repeatedly. */
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
      this.scheduleDistantBark();
    } catch { /* audio unavailable: game continues silently */ }
  }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* ignore */ }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.02);
    return this.muted;
  }
  toggleMute() { return this.setMuted(!this.muted); }
  get isMuted() { return this.muted; }

  _env(gain, t0, a, peak, d) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + a);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
  _tone({ type = 'sine', freq = 440, freqEnd = null, dur = 0.2, peak = 0.3, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator(); const g = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    this._env(g, t0, 0.01, peak, dur);
    osc.connect(g); g.connect(this.master); osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  _noise({ dur = 0.2, peak = 0.2, delay = 0, lowpass = 1200 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = lowpass;
    const g = this.ctx.createGain(); this._env(g, t0, 0.01, peak, dur);
    src.connect(filt); filt.connect(g); g.connect(this.master); src.start(t0); src.stop(t0 + dur + 0.05);
  }
  bark() {
    // Square + noise burst, two yips.
    this._tone({ type: 'square', freq: 620, freqEnd: 380, dur: 0.12, peak: 0.18 });
    this._noise({ dur: 0.08, peak: 0.12, lowpass: 2500 });
    this._tone({ type: 'square', freq: 560, freqEnd: 340, dur: 0.1, peak: 0.14, delay: 0.14 });
  }
  distantBark() {
    if (!this.ctx) return;
    this._tone({ type: 'square', freq: 500, freqEnd: 320, dur: 0.1, peak: 0.03 });
  }
  jumpWhoosh() { this._noise({ dur: 0.18, peak: 0.12, lowpass: 900 }); }
  landThud() { this._tone({ type: 'sine', freq: 110, freqEnd: 45, dur: 0.14, peak: 0.35 }); this._noise({ dur: 0.08, peak: 0.1, lowpass: 400 }); }
  pickup() { this._tone({ type: 'sine', freq: 660, dur: 0.09, peak: 0.22 }); this._tone({ type: 'sine', freq: 990, dur: 0.14, peak: 0.22, delay: 0.08 }); }
  drop() { this._tone({ type: 'sine', freq: 440, freqEnd: 220, dur: 0.12, peak: 0.2 }); }
  missionComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => this._tone({ type: 'triangle', freq: f, dur: 0.18, peak: 0.22, delay: i * 0.11 }));
  }
  zoneVisit() { this._tone({ type: 'triangle', freq: 880, dur: 0.12, peak: 0.15 }); }
  uiClick() { this._tone({ type: 'sine', freq: 800, dur: 0.05, peak: 0.1 }); }

  startAmbient() {
    if (!this.ctx || this.ambientNodes) return;
    // Low brown-ish noise room tone, very quiet.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const white = Math.random() * 2 - 1; last = (last + 0.02 * white) / 1.02; data[i] = last * 3.5; }
    const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filt = this.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 240;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    src.connect(filt); filt.connect(g); g.connect(this.master); src.start();
    this.ambientNodes = { src, g };
  }
  scheduleDistantBark() {
    const loop = () => {
      this._distantBarkTimer = window.setTimeout(() => { if (!this.muted) this.distantBark(); loop(); }, 9000 + Math.random() * 12000);
    };
    loop();
  }
  dispose() { if (this._distantBarkTimer) clearTimeout(this._distantBarkTimer); }
}
