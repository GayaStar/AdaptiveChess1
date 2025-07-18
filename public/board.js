import {
  getGame,
  getPlayerColor,
  getBoard,
  setBoard,
  hasGameEnded,
  getPlayerRating,
} from './state.js';
import { makeStockfishMove } from './stockfish.js';
import { makeRLMove } from './rl_agent.js';
import { updateUI, updateStatus } from './ui.js';

let pendingPromotion = null;

export function initializeBoard(playerColor = 'w') {
  const config = {
    draggable: false, // disable drag for pure click-to-move
    position: 'start',
    pieceTheme: typeof wikipedia_piece_theme !== 'undefined' ? wikipedia_piece_theme : undefined,
    showNotation: false,
    onMoveEnd,
    onSnapEnd,
  };

  const board = Chessboard('myBoard', config);
  setBoard(board);

  $(window).resize(board.resize);

  const orientation = playerColor === 'w' ? 'white' : 'black';
  board.orientation(orientation);
  updateFileRankLabels(orientation);

  setTimeout(() => {
    addClickToMoveListeners(board);
  }, 100);

  document.getElementById('promotionOverlay').addEventListener('click', (e) => {
    if (!e.target.classList.contains('promo-piece')) return;
    const piece = e.target.dataset.piece;
    if (pendingPromotion) {
      const { source, target } = pendingPromotion;
      makeMoveWithPromotion(source, target, piece);
      pendingPromotion = null;
      getBoard().position(getGame().fen());
      updateUI();
      clearHighlights();
    }
    document.getElementById('promotionOverlay').classList.add('hidden');
  });
}

function makeMoveWithPromotion(from, to, promotion) {
  const game = getGame();
  const move = game.move({ from, to, promotion });
  if (!move) return 'snapback';

  document.getElementById('promotionOverlay').classList.add('hidden');
  highlightLastMove(move, true);
  updateUI();

  const board = getBoard();
  board.position(game.fen());

  if (game.game_over()) {
    updateStatus();
    return;
  }
  setTimeout(makeEngineMove, 250);
}

function makeEngineMove() {
  const rating = getPlayerRating();
  if (rating < 1200) makeRLMove(rating);
  else makeStockfishMove();
}

function onMoveEnd() {
  const board = getBoard();
  const game = getGame();
  board.position(game.fen());
}

function onSnapEnd() {
  const board = getBoard();
  const game = getGame();
  board.position(game.fen());
}

function addClickToMoveListeners(board) {
  let selectedSquare = null;
  let validDestSquares = [];

  function clearClickHighlights() {
    document.querySelectorAll('.valid-move-highlight').forEach(el =>
      el.classList.remove('valid-move-highlight')
    );
    document.querySelectorAll('.selected-piece').forEach(el =>
      el.classList.remove('selected-piece')
    );
  }

  function highlightSquares(from, toSquares) {
    clearClickHighlights();
    document.querySelectorAll(`.square-${from}`).forEach(el =>
      el.classList.add('selected-piece')
    );
    toSquares.forEach(sq => {
      document.querySelectorAll(`.square-${sq}`).forEach(el =>
        el.classList.add('valid-move-highlight')
      );
    });
  }

  document.getElementById('myBoard').addEventListener('click', function (e) {
    let target = e.target;
    // climb up to find parent square with class square-[a-h][1-8]
    while (target && !(target.classList && Array.from(target.classList).some(c => /^square-[a-h][1-8]$/.test(c)))) {
      target = target.parentElement;
    }
    if (!target) return;

    // find square name from class
    const match = Array.from(target.classList).find(c => /^square-[a-h][1-8]$/.test(c));
    const square = match ? match.slice(7) : null;
    if (!square) return;

    const game = getGame();
    const playerColor = getPlayerColor();
    const turn = game.turn();

    if (!selectedSquare) {
      const piece = game.get(square);
      if (!piece || piece.color !== playerColor[0] || turn !== playerColor[0]) {
        clearClickHighlights();
        return;
      }
      const moves = game.moves({ square, verbose: true });
      if (!moves.length) return;

      selectedSquare = square;
      validDestSquares = moves.map(m => m.to);
      highlightSquares(square, validDestSquares);
    } else {
      // If clicking own piece again, switch selection
      const piece = game.get(square);
      if (piece && piece.color === playerColor[0] && turn === playerColor[0]) {
        selectedSquare = square;
        const moves = game.moves({ square, verbose: true });
        validDestSquares = moves.map(m => m.to);
        highlightSquares(square, validDestSquares);
        return;
      }
      // If click is on valid destination, make the move
      if (validDestSquares.includes(square)) {
        const movingPiece = game.get(selectedSquare);
        const isPromotion =
          movingPiece?.type === 'p' &&
          ((movingPiece.color === 'w' && square[1] === '8') || (movingPiece.color === 'b' && square[1] === '1'));

        if (isPromotion) {
          pendingPromotion = { source: selectedSquare, target: square, color: movingPiece.color };
          showPromotionOverlay(movingPiece.color);
        } else {
          const result = makeMoveWithPromotion(selectedSquare, square, 'q');
          if (result !== 'snapback') {
            board.position(game.fen());
            updateUI();
          }
        }
      }
      clearClickHighlights();
      selectedSquare = null;
      validDestSquares = [];
    }
  });
}

export function highlightLastMove(move, isPlayerMove) {
  clearHighlights();
  const fromSq = document.querySelector(`#myBoard .square-${move.from}`);
  const toSq = document.querySelector(`#myBoard .square-${move.to}`);
  if (fromSq) fromSq.classList.add(isPlayerMove ? 'last-move-player' : 'last-move-engine');
  if (toSq) toSq.classList.add(isPlayerMove ? 'last-move-player' : 'last-move-engine');
}

export function clearHighlights() {
  document.querySelectorAll('.last-move-player, .last-move-engine').forEach(el =>
    el.classList.remove('last-move-player', 'last-move-engine')
  );
  document.querySelectorAll('.valid-move-highlight, .selected-piece').forEach(el =>
    el.classList.remove('valid-move-highlight', 'selected-piece')
  );
}

// Show pawn promotion UI
function showPromotionOverlay(color) {
  const overlay = document.getElementById('promotionOverlay');
  overlay.innerHTML = '';
  ['q', 'r', 'b', 'n'].forEach((type) => {
    const piece = document.createElement('div');
    piece.classList.add('promo-piece');
    piece.dataset.piece = type;
    piece.style.backgroundImage = `url('pieces/${color}${type.toUpperCase()}.png')`;
    overlay.appendChild(piece);
  });
  overlay.classList.remove('hidden');
}

function updateFileRankLabels(orientation = 'white') {
  document.querySelectorAll('.file-labels, .rank-labels').forEach((el) => el.remove());
  const files =
    orientation === 'white'
      ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
      : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
  const ranks =
    orientation === 'white'
      ? ['8', '7', '6', '5', '4', '3', '2', '1']
      : ['1', '2', '3', '4', '5', '6', '7', '8'];
  const fileDiv = document.createElement('div');
  fileDiv.className = 'file-labels';
  files.forEach((f) => {
    const span = document.createElement('span');
    span.textContent = f;
    fileDiv.appendChild(span);
  });
  const rankDiv = document.createElement('div');
  rankDiv.className = 'rank-labels';
  ranks.forEach((r) => {
    const span = document.createElement('span');
    span.textContent = r;
    rankDiv.appendChild(span);
  });
  const boardArea = document.querySelector('.chessboard-area');
  boardArea.appendChild(fileDiv);
  boardArea.appendChild(rankDiv);
}