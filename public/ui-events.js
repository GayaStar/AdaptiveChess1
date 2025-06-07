// ui-events.js

import { startNewGame, undoMove, switchPlayerColor } from './game.js';
import { generateAnalysis } from './analysis.js';

export function setupUIEvents() {
  document.getElementById('startBtn').addEventListener('click', startNewGame);
  document.getElementById('undoBtn').addEventListener('click', undoMove);
  document.getElementById('playAsWhite').addEventListener('click', () => switchPlayerColor('w'));
  document.getElementById('playAsBlack').addEventListener('click', () => switchPlayerColor('b'));
  document.getElementById('analyzeBtn').addEventListener('click', generateAnalysis);
}
