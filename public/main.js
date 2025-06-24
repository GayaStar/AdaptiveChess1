// main.js

import {
  setPlayerRating,
  setStockfishLevel,
  setStockfishDepth,
  setUserId
} from './state.js';

import { loadStockfish, updateStockfishLevel } from './stockfish.js';
import { initializeBoard } from './board.js';
import { setupUIEvents } from './ui-events.js';
import { startNewGame } from './game.js';

(async function () {
  try {
    const res = await fetch('/user', {
      method: 'GET',
      credentials: 'include'  // ✅ Include session cookie
    });

    if (!res.ok) {
      alert('Please login first.');
      window.location.href = "login.html";
      return;
    }

    const data = await res.json();

    // ✅ Set player info in state
    setPlayerRating(data.rating || 1000);
    setStockfishLevel(typeof data.stockfishLevel === 'number' ? data.stockfishLevel : 0);
    setStockfishDepth(typeof data.stockfishDepth === 'number' ? data.stockfishDepth : 5);
    setUserId(data.username || 'guest');  // ✅ Save user_id for RL agent

    await loadStockfish();
    updateStockfishLevel(data.stockfishLevel, false);
    initializeBoard();
    setupUIEvents();
    startNewGame();

  } catch (err) {
    console.error("Initialization failed:", err);
    alert("Error loading game. Check console for details.");
  }
})();
