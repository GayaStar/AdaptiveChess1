import { startNewGame, undoMove, switchPlayerColor } from './game.js';
import { generateAnalysis } from './analysis.js';
import { getGame, getBoard, getPlayerRating } from './state.js';
import { highlightLastMove } from './board.js';
import { updateUI, updateStatus } from './ui.js';
import { makeStockfishMove } from './stockfish.js';
import { makeRLMove } from './rl_agent.js';

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

    // ✅ Use RL or Stockfish based on rating
    const rating = getPlayerRating();
    if (rating < 1200) {
      makeRLMove(rating);
    } else {
      makeStockfishMove();
    }
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

  raw = raw
    .replace(/king/g, 'K')
    .replace(/queen/g, 'Q')
    .replace(/rook/g, 'R')
    .replace(/bishop/g, 'B')
    .replace(/(knight|night)/g, 'N')
    .replace(/pawn/g, '')
    .replace(/cross/g, 'x')
    .replace(/equals/g, '=');

  const game = getGame();
  const legalMoves = game.moves();

  const exact = legalMoves.find(move => move.toLowerCase() === raw);
  if (exact) return exact;

  if (/^[nbrqk]/.test(raw)) {
    raw = raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  if (/^[NBRQK]/.test(raw)) {
    const fuzzy = legalMoves.find(move => move.toLowerCase().includes(raw));
    if (fuzzy) return fuzzy;
  }

  return raw;
}
