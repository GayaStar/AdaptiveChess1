import {
  getGame,
  getPlayerColor,
  getPlayerRating,
  setPlayerRating,
  getStockfishLevel,
  setStockfishLevel,
  getStockfishDepth,
  setStockfishDepth,
  hasGameEnded,
  setGameEnded,
  isGameSaved,
  setGameSaved,
  isRLGame
} from './state.js';

import { updateStockfishLevel } from './stockfish.js';
import { saveGameToDB } from './game.js';

export function updateUI() {
  $('#playerRating').text(getPlayerRating());
  $('#stockfishLevel').text(getStockfishLevel());
  $('#stockfishDepth').text(getStockfishDepth());
  updateStatus();
  updateMoveList();
}

export function updateStatus() {
  const game = getGame();
  let status = '';
  const playerColor = getPlayerColor();

  if (game.in_checkmate()) {
    if (!hasGameEnded()) {
      const playerWon = game.turn() !== playerColor[0];
      status = playerWon ? 'Congratulations! You won!' : 'Game over, Stockfish wins!';
      updateRatings(playerWon);
      saveGameOnce();
      setGameEnded(true);
    } else {
      status = $('#status').text();
    }
  } else if (
    game.in_draw() ||
    game.in_stalemate() ||
    game.in_threefold_repetition() ||
    game.insufficient_material()
  ) {
    if (!hasGameEnded()) {
      status = 'Game over, drawn position';
      updateRatings(0.5);
      saveGameOnce();
      setGameEnded(true);
    } else {
      status = $('#status').text();
    }
  } else {
    status = game.turn() === playerColor[0] ? 'Your turn' : 'Stockfish is thinking...';
    setGameEnded(false);
  }

  $('#status').text(status);

  if (game.game_over()) {
    $('#analyzeBtn').removeClass('hidden').show();
    $('#analysisResult').removeClass('hidden').show();
  } else {
    $('#analyzeBtn').addClass('hidden').hide();
    $('#analysisResult').addClass('hidden').html('');
  }
}

function updateRatings(result) {
  const playerRating = getPlayerRating();
  const stockfishRating = 1200 + getStockfishLevel() * 100;
  let updatedRating = playerRating;

  // If playing against RL agent, only update player rating
  if (isRLGame()) {
    if (typeof result === 'boolean') {
      updatedRating += result ? 25 : -15;
    } else {
      updatedRating += 0; // draw
    }

    updatedRating = Math.max(100, updatedRating);
    setPlayerRating(updatedRating);

    fetch('/update_rating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ rating: updatedRating })
    });

    $('#playerRating').text(updatedRating);
    return;
  }

  // Stockfish-based opponent: update rating + level/depth
  let level = getStockfishLevel();
  let depth = getStockfishDepth();

  const expected = 1 / (1 + Math.pow(10, (stockfishRating - playerRating) / 400));

  if (typeof result === 'boolean') {
    if (result) {
      updatedRating += Math.round(32 * (1 - expected));
      level = Math.min(20, level + 1);
      depth = Math.min(15, depth + 1);
    } else {
      updatedRating += Math.round(32 * (0 - expected));
      level = Math.max(0, level - 1);
      depth = Math.max(1, depth - 1);
    }
  } else {
    updatedRating += Math.round(32 * (0.5 - expected));
  }

  updatedRating = Math.max(100, updatedRating);

  setPlayerRating(updatedRating);
  setStockfishLevel(level);
  setStockfishDepth(depth);

  fetch('/update_rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ rating: updatedRating })
  });

  fetch('/update_stockfish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ stockfishLevel: level, stockfishDepth: depth })
  });

  $('#playerRating').text(updatedRating);
  $('#stockfishLevel').text(level);
  $('#stockfishDepth').text(depth);
  updateStockfishLevel(level, false);
}

function saveGameOnce() {
  if (isGameSaved()) return;

  const game = getGame();
  const moves = game.history();
  const result = game.in_checkmate()
    ? (game.turn() !== getPlayerColor()[0] ? "1-0" : "0-1")
    : "1/2-1/2";

  saveGameToDB(moves, result);
  setGameSaved(true);
}

export function updateMoveList() {
  const game = getGame();
  const history = game.history({ verbose: true });

  // 🔁 Reset captured piece containers
  document.getElementById('capturedWhite').innerHTML = '';
  document.getElementById('capturedBlack').innerHTML = '';

  let html = '';

  for (let i = 0; i < history.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;

    const whiteMove = history[i];
    const blackMove = history[i + 1];

    const white = formatMove(whiteMove);
    if (whiteMove) updateCapturedPieces(whiteMove);

    const black = blackMove ? formatMove(blackMove) : '';
    if (blackMove) updateCapturedPieces(blackMove);

    html += `<div>${moveNum}. ${white} ${black}</div>`;
  }

  $('#move-list').html(html);
}

function formatMove(move) {
  if (!move) return '';
  let captureImage = '';

  if (move.captured) {
    const isWhite = move.color === 'w';
    const capturedPiece = move.captured.toUpperCase();
    const prefix = isWhite ? 'b' : 'w';
    const pieceKey = `${prefix}${capturedPiece}`;
    const pieceImageURL = `./pieces/${pieceKey}.png`;

    captureImage = ` <img src="${pieceImageURL}" alt="${pieceKey}" style="width:18px; height:18px; vertical-align:middle;" />`;
  }

  return `${move.san}${captureImage}`;
}

export function updateRatingRL() {
  const game = getGame();
  const userWon = game.in_checkmate() && game.turn() !== getPlayerColor()[0];

  let current = getPlayerRating();
  let newRating = current + (userWon ? 25 : -15);
  newRating = Math.max(1200, Math.min(newRating, 1200));

  setPlayerRating(newRating);
  $('#playerRating').text(newRating);

  fetch('/update_rating', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ rating: newRating })
  });
}

export function speakSAN(san) {
  const text = formatSANForSpeech(san);
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'en-US';
  utter.rate = 0.9;
  window.speechSynthesis.speak(utter);
}

function formatSANForSpeech(san) {
  if (san === 'O-O') return 'Castles kingside';
  if (san === 'O-O-O') return 'Castles queenside';

  return san
    .replace(/x/g, ' takes ')
    .replace(/=/g, ' promotes to ')
    .replace(/K/g, 'King ')
    .replace(/Q/g, 'Queen ')
    .replace(/R/g, 'Rook ')
    .replace(/B/g, 'Bishop ')
    .replace(/N/g, 'Knight ')
    .replace(/\s+/g, ' ')
    .trim();
}

function updateCapturedPieces(move) {
  if (!move || !move.captured) return;

  const isWhite = move.color === 'w';
  const containerId = isWhite ? 'capturedWhite' : 'capturedBlack';
  const captured = move.captured.toUpperCase();
  const prefix = isWhite ? 'b' : 'w';
  const img = document.createElement('img');
  img.src = `./pieces/${prefix}${captured}.png`;
  img.alt = `${prefix}${captured}`;
  document.getElementById(containerId).appendChild(img);
}
