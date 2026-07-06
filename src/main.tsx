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

createGame(gameParent);
createRoot(uiRoot).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
