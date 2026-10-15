// HUD: mission tracker, score/time, minimap canvas, toasts, prompts, pause, completion.
// All buttons wired to callbacks supplied by Game — no dead buttons.
import { ZONES, EXPLORE_ZONES, INTERACTIVE } from '../utils/constants.js';

export class HUD {
  constructor(callbacks) {
    this.cb = callbacks;
    this.el = {};
    for (const id of ['loading', 'loadBar', 'loadTip', 'clickPlay', 'menu', 'hud', 'missionList',
      'scoreVal', 'timeVal', 'muteBtn', 'pauseBtn', 'hintBox', 'hintToggle', 'prompt', 'toast',
      'pauseMenu', 'completeScreen', 'completeStats', 'minimap', 'minimapCanvas',
      'qualityLow', 'qualityMed', 'qualityHigh', 'modeLabel', 'touchControls']) {
      this.el[id] = document.getElementById(id);
    }
    this.minimapVisible = true;
    this.toastTimer = null;
    this._wire();
  }
  _wire() {
    const on = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };
    on(this.el.clickPlay, 'click', () => this.cb.onReadyClick?.());
    on(this.el.muteBtn, 'click', () => this.cb.onMute?.());
    on(this.el.pauseBtn, 'click', () => this.cb.onPauseToggle?.());
    on(this.el.hintToggle, 'click', () => this.el.hintBox?.classList.toggle('collapsed'));
    // Menu buttons
    on(document.getElementById('playMissions'), 'click', () => this.cb.onPlay?.('missions'));
    on(document.getElementById('playSandbox'), 'click', () => this.cb.onPlay?.('sandbox'));
    // Pause menu
    on(document.getElementById('btnResume'), 'click', () => this.cb.onResume?.());
    on(document.getElementById('btnRestart'), 'click', () => this.cb.onRestart?.());
    on(document.getElementById('btnControls'), 'click', () => this.cb.onShowControls?.());
    on(document.getElementById('btnMainMenu'), 'click', () => this.cb.onMainMenu?.());
    on(document.getElementById('btnClosePause'), 'click', () => this.cb.onResume?.());
    on(this.el.qualityLow, 'click', () => this.cb.onQuality?.('low'));
    on(this.el.qualityMed, 'click', () => this.cb.onQuality?.('medium'));
    on(this.el.qualityHigh, 'click', () => this.cb.onQuality?.('high'));
    // Completion
    on(document.getElementById('btnPlayAgain'), 'click', () => this.cb.onPlayAgain?.());
    on(document.getElementById('btnFreeRoam'), 'click', () => this.cb.onFreeRoam?.());
    on(document.getElementById('btnCompleteMenu'), 'click', () => this.cb.onMainMenu?.());
    // Controls modal close
    on(document.getElementById('btnCloseControls'), 'click', () => this._showControls(false));
    on(document.getElementById('controlsModal'), 'click', (e) => { if (e.target.id === 'controlsModal') this._showControls(false); });
  }
  _showControls(show) {
    const m = document.getElementById('controlsModal');
    if (m) m.classList.toggle('hidden', !show);
  }
  showControlsModal() { this._showControls(true); }

  setLoading(pct, label) {
    if (this.el.loadBar) this.el.loadBar.style.width = `${Math.round(pct * 100)}%`;
    if (label && this.el.loadTip) this.el.loadTip.textContent = label;
  }
  showLoading(show) { this.el.loading?.classList.toggle('hidden', !show); }
  showClickToPlay(show) { this.el.clickPlay?.classList.toggle('hidden', !show); }
  showMenu(show) { this.el.menu?.classList.toggle('hidden', !show); }
  showHUD(show) { this.el.hud?.classList.toggle('hidden', !show); }
  showPause(show) { this.el.pauseMenu?.classList.toggle('hidden', !show); }
  showComplete(show, stats) {
    if (show && stats && this.el.completeStats) {
      this.el.completeStats.textContent = `Time ${stats.time}  •  Score ${stats.score}  •  Missions ${stats.missions}/3`;
    }
    this.el.completeScreen?.classList.toggle('hidden', !show);
  }
  setMode(mode) { if (this.el.modeLabel) this.el.modeLabel.textContent = mode === 'sandbox' ? 'Free Roam' : 'Missions'; }
  setMute(muted) { if (this.el.muteBtn) this.el.muteBtn.textContent = muted ? '🔇 Muted' : '🔊 Sound'; }
  setQuality(q) {
    for (const [key, el] of [['low', this.el.qualityLow], ['medium', this.el.qualityMed], ['high', this.el.qualityHigh]]) {
      el?.classList.toggle('active', key === q);
    }
  }
  setScore(score) { if (this.el.scoreVal) this.el.scoreVal.textContent = String(score); }
  setTime(seconds) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    if (this.el.timeVal) this.el.timeVal.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  setMissions(snap) {
    if (!this.el.missionList) return;
    const exploreCount = snap.visited ? snap.visited.size : 0;
    const items = [
      { done: snap.fetchDone, label: `FETCH — ball to basket (+100)` },
      { done: snap.feedDone, label: `FEED — kibble to bowls (+100)` },
      { done: snap.exploreDone, label: `EXPLORE — ${exploreCount}/5 zones (+50 each)` },
    ];
    this.el.missionList.innerHTML = items.map(i =>
      `<div class="mission ${i.done ? 'done' : ''}"><span class="box">${i.done ? '✓' : '○'}</span>${i.label}</div>`).join('');
  }
  setPrompt(text) {
    if (!this.el.prompt) return;
    this.el.prompt.textContent = text;
    this.el.prompt.classList.toggle('hidden', !text);
  }
  showToast(text, ms = 2600) {
    if (!this.el.toast) return;
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.el.toast?.classList.add('hidden'), ms);
  }
  toggleMinimap() {
    this.minimapVisible = !this.minimapVisible;
    this.el.minimap?.classList.toggle('hidden', !this.minimapVisible);
  }
  /** Draw minimap: zones, dog dot, mission markers (ball/basket/bag). */
  drawMinimap(dogPos, dogHeading, snap) {
    if (!this.minimapVisible || !this.el.minimapCanvas) return;
    const cv = this.el.minimapCanvas, ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const sx = (x) => (x + 30) / 60 * W, sz = (z) => (z + 20) / 40 * H;
    ctx.clearRect(0, 0, W, H);
    for (const [key, z] of Object.entries(ZONES)) {
      ctx.fillStyle = key === 'lobby' ? '#e8dcc0' : '#f5eedd';
      ctx.fillRect(sx(z.x0), sz(z.z0), sx(z.x1) - sx(z.x0), sz(z.z1) - sz(z.z0));
      ctx.strokeStyle = '#2ec4b6'; ctx.lineWidth = 1; ctx.strokeRect(sx(z.x0), sz(z.z0), sx(z.x1) - sx(z.x0), sz(z.z1) - sz(z.z0));
      ctx.fillStyle = '#555'; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(z.label, (sx(z.x0) + sx(z.x1)) / 2, (sz(z.z0) + sz(z.z1)) / 2);
    }
    const marker = (x, z, color, label) => {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(sx(x), sz(z), 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222'; ctx.font = 'bold 8px system-ui'; ctx.fillText(label, sx(x), sz(z) - 6);
    };
    if (snap && !snap.fetchDone) {
      if (snap.ballPos) marker(snap.ballPos.x, snap.ballPos.z, '#ff8c42', 'BALL');
      marker(INTERACTIVE.BASKET_POS.x, INTERACTIVE.BASKET_POS.z, '#8a5a2b', 'BASKET');
    }
    if (snap && !snap.feedDone && snap.bagPos) marker(snap.bagPos.x, snap.bagPos.z, '#c9a227', 'KIBBLE');
    // Dog dot + heading tick
    const dx = sx(dogPos.x), dz = sz(dogPos.z);
    ctx.fillStyle = '#e4572e'; ctx.beginPath(); ctx.arc(dx, dz, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
    const hx = dx + Math.sin(dogHeading) * 8, hz = dz + Math.cos(dogHeading) * 8;
    ctx.strokeStyle = '#e4572e'; ctx.beginPath(); ctx.moveTo(dx, dz); ctx.lineTo(hx, hz); ctx.stroke();
    // Unexplored zone hint: pulse dot on first unvisited zone
    if (snap && !snap.exploreDone && snap.visited) {
      for (const key of EXPLORE_ZONES) {
        if (!snap.visited.has(key)) {
          const z = ZONES[key];
          ctx.fillStyle = 'rgba(46,196,182,0.5)';
          ctx.beginPath(); ctx.arc((sx(z.x0) + sx(z.x1)) / 2, (sz(z.z0) + sz(z.z1)) / 2 + 10, 3, 0, Math.PI * 2); ctx.fill();
          break;
        }
      }
    }
  }
  formatTime(seconds) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}
