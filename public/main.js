import {
  setPlayerRating,
  setStockfishLevel,
  setStockfishDepth,
  setUserId,
  setIsRLGame
} from './state.js';

import { loadStockfish, updateStockfishLevel } from './stockfish.js';
import { initializeBoard } from './board.js';
import { setupUIEvents } from './ui-events.js';
import { startNewGame } from './game.js';

(async function () {
  try {
    const res = await fetch('/user', {
      method: 'GET',
      credentials: 'include'
    });

    if (!res.ok) {
      alert('Please login first.');
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();

    const rating = data.rating || 1000;
    const isRL = rating <= 1200;

    // ✅ Set initial state
    setPlayerRating(rating);
    setStockfishLevel(typeof data.stockfishLevel === 'number' ? data.stockfishLevel : 0);
    setStockfishDepth(typeof data.stockfishDepth === 'number' ? data.stockfishDepth : 5);
    setUserId(data.username || 'guest');
    setIsRLGame(isRL);  // ✅ Automatically choose opponent

    if (!isRL) {
      await loadStockfish();
      updateStockfishLevel(data.stockfishLevel, false);
    }

    initializeBoard();
    setupUIEvents();
    startNewGame();

  } catch (err) {
    console.error("Initialization failed:", err);
    alert("Error loading game. Check console for details.");
  }
})();
