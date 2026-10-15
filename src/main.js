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
  try {
    const gl = canvas.getContext('webgl2');
    if (!gl) {
      document.getElementById('webglFallback')?.classList.remove('hidden');
      document.getElementById('loading')?.classList.add('hidden');
      return;
    }
    // Release the probe context; the renderer creates its own.
    const ext = gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
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
