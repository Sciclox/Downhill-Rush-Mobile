import { Game } from './core/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  window.downhillGame = new Game(container);
});
