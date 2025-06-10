// ui-events.js

import { startNewGame, undoMove, switchPlayerColor } from './game.js';
import { generateAnalysis } from './analysis.js';
import { getGame, getBoard } from './state.js';
import { highlightLastMove } from './board.js';
import { updateUI, updateStatus } from './ui.js';
import { makeStockfishMove } from './stockfish.js';

export function setupUIEvents() {
  document.getElementById('startBtn').addEventListener('click', startNewGame);
  document.getElementById('undoBtn').addEventListener('click', undoMove);
  document.getElementById('playAsWhite').addEventListener('click', () => switchPlayerColor('w'));
  document.getElementById('playAsBlack').addEventListener('click', () => switchPlayerColor('b'));
  document.getElementById('analyzeBtn').addEventListener('click', generateAnalysis);
}

document.getElementById('speakMoveBtn').addEventListener('click', () => {
  const recognition = new webkitSpeechRecognition(); // Chrome only
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.start();

  recognition.onresult = (event) => {
    const rawSpeech = event.results[0][0].transcript;
    const spokenSAN = normalizeSAN(rawSpeech.toLowerCase());
    console.log('🎤 Heard:', spokenSAN);

    const game = getGame();
    const board = getBoard();

    const move = game.move(spokenSAN, { sloppy: true });

    if (!move) {
      alert(`Invalid move: ${spokenSAN}`);
      return;
    }

    board.position(game.fen());
    highlightLastMove(move, true);
    updateUI();

    if (game.game_over()) {
      updateStatus();
      return;
    }

    setTimeout(makeStockfishMove, 500);
  };

  recognition.onerror = (event) => {
    alert('Speech recognition error: ' + event.error);
  };
});

function normalizeSAN(spoken) {
  let raw = spoken.toLowerCase().replace(/\s+/g, '').trim();

  // Castling
  if (raw.includes('kingside')) return 'O-O';
  if (raw.includes('queenside')) return 'O-O-O';

  // Replace piece names with SAN letters
  raw = raw
    .replace(/king/g, 'K')
    .replace(/queen/g, 'Q')
    .replace(/rook/g, 'R')
    .replace(/bishop/g, 'B')
    .replace(/(knight|night)/g, 'N')
    .replace(/pawn/g, '') // pawns are silent in SAN

    // Handle verbal captures like "cross"
    .replace(/cross/g, 'x')
    .replace(/equals/g, '=');

  // Fix for accidental lowercasing of valid SAN like "bxc6" (pawn moves)
  const game = getGame();
  const legalMoves = game.moves();

  // Exact match
  const exact = legalMoves.find(move => move.toLowerCase() === raw);
  if (exact) return exact;

  // If it starts with a piece letter (not a-h), capitalize it
  if (/^[nbrqk]/.test(raw)) {
    raw = raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  // Try fuzzy match only for piece moves
  if (/^[NBRQK]/.test(raw)) {
    const fuzzy = legalMoves.find(move => move.toLowerCase().includes(raw));
    if (fuzzy) return fuzzy;
  }

  return raw;
}
