import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createGame } from './world/game';
import { App } from './ui/App';
import './style.css';

const gameParent = document.getElementById('game');
const uiRoot = document.getElementById('ui');
if (!gameParent || !uiRoot) {
  throw new Error('index.html is missing #game or #ui mount points');
}

const game = createGame(gameParent);
if (import.meta.env.DEV) {
  // Dev-only handle for debugging in the browser console.
  (window as unknown as { __game?: unknown }).__game = game;
  void import('./shared/store').then(({ gameStore }) => {
    (window as unknown as { __store?: unknown }).__store = gameStore;
  });
}
createRoot(uiRoot).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
