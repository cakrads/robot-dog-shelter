// Boot: WebGL2 check, error handling, resize is handled by Game.
import { Game } from './game/Game.js';

function showFatal(message) {
  const el = document.getElementById('fatalError');
  if (el) { el.classList.remove('hidden'); el.querySelector('p') && (el.querySelector('p').textContent = message); }
  const loading = document.getElementById('loading');
  loading?.classList.add('hidden');
  console.error(message);
}

async function boot() {
  const canvas = document.getElementById('gameCanvas');
  if (!canvas) { showFatal('Game canvas not found.'); return; }
  // WebGL2 availability check with a clear fallback message.
  // Probe on a throwaway offscreen canvas: probing #gameCanvas itself and
  // losing its context breaks the renderer Game creates right after
  // (Three.js then fails with "Cannot read properties of null (reading 'precision')").
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) {
      document.getElementById('webglFallback')?.classList.remove('hidden');
      document.getElementById('loading')?.classList.add('hidden');
      return;
    }
    // Release only the throwaway probe context; #gameCanvas is untouched.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  } catch (err) {
    document.getElementById('webglFallback')?.classList.remove('hidden');
    document.getElementById('loading')?.classList.add('hidden');
    console.error('WebGL2 probe failed', err);
    return;
  }
  const game = new Game(canvas);
  window.__robotDogGame = game;
  try {
    await game.init();
  } catch (err) {
    showFatal(`Failed to start the game: ${err?.message || err}. Try reloading, or use a modern desktop browser with WebGL2.`);
  }
  window.addEventListener('error', (e) => console.error('Runtime error:', e.message));
  window.addEventListener('unhandledrejection', (e) => console.error('Unhandled rejection:', e.reason));
}

boot();
