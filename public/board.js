import {
    getGame,
    getPlayerColor,
    getBoard,
    setBoard,
    hasGameEnded,
    getPlayerRating
} from './state.js';

import { makeStockfishMove } from './stockfish.js';
import { makeRLMove } from './rl_agent.js'; // ✅ RL agent support
import { updateUI, updateStatus } from './ui.js';

let pendingPromotion = null;

export function initializeBoard() {
    const config = {
        draggable: true,
        position: 'start',
        pieceTheme: typeof wikipedia_piece_theme !== 'undefined' ? wikipedia_piece_theme : undefined,
        showNotation: false,
        onDragStart,
        onDrop,
        onMoveEnd,
        onSnapEnd
    };

    const board = Chessboard('myBoard', config);
    setBoard(board);
    $(window).resize(board.resize);

    // ⬇️ Setup promotion click listener
    document.getElementById('promotionOverlay').addEventListener('click', (e) => {
        if (!e.target.classList.contains('promo-piece')) return;

        const piece = e.target.dataset.piece;
        if (pendingPromotion) {
            const { source, target } = pendingPromotion;
            makeMoveWithPromotion(source, target, piece);
            pendingPromotion = null;
        }

        document.getElementById('promotionOverlay').classList.add('hidden');
    });
}

function onDragStart(source, piece) {
    const game = getGame();
    const playerColor = getPlayerColor();

    if (hasGameEnded()) return false;
    if (game.turn() !== playerColor[0]) return false;
    if ((playerColor === 'w' && piece.startsWith('b')) ||
        (playerColor === 'b' && piece.startsWith('w'))) {
        return false;
    }
    return true;
}

function onDrop(source, target) {
    const game = getGame();
    const piece = game.get(source);

    const isPromotionMove = piece?.type === 'p' &&
        ((piece.color === 'w' && target[1] === '8') ||
         (piece.color === 'b' && target[1] === '1'));

    if (isPromotionMove) {
        pendingPromotion = { source, target, color: piece.color };
        showPromotionOverlay(piece.color);
        return;
    }

    return makeMoveWithPromotion(source, target, 'q'); // fallback to queen
}

function makeMoveWithPromotion(from, to, promotion) {
    const game = getGame();
    const move = game.move({
        from,
        to,
        promotion
    });

    if (!move) return 'snapback';

    document.getElementById('promotionOverlay').classList.add('hidden');
    highlightLastMove(move, true);
    updateUI();

    if (game.game_over()) {
        updateStatus();
        return;
    }

    setTimeout(makeEngineMove, 250);
}

function makeEngineMove() {
    const rating = getPlayerRating();
    if (rating < 1200) {
        makeRLMove(rating);
    } else {
        makeStockfishMove();
    }
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

export function highlightLastMove(move, isPlayerMove) {
    clearHighlights();
    const style = isPlayerMove
        ? { backgroundColor: "rgba(255, 255, 0, 0.4)" }
        : { backgroundColor: "rgba(173, 216, 230, 0.4)" };
    highlightSquare(move.from, style);
    highlightSquare(move.to, style);
}

function highlightSquare(square, style) {
    $(`#myBoard .square-${square}`).css('background', style.backgroundColor);
}

export function clearHighlights() {
    $('#myBoard .square-55d63').css('background', '');
}

// 💡 New function to show promotion ribbon
function showPromotionOverlay(color) {
    const overlay = document.getElementById('promotionOverlay');
    overlay.innerHTML = '';

    ['q', 'r', 'b', 'n'].forEach(type => {
        const piece = document.createElement('div');
        piece.classList.add('promo-piece');
        piece.dataset.piece = type;
        piece.style.backgroundImage = `url('pieces/${color}${type.toUpperCase()}.png')`;
        overlay.appendChild(piece);
    });

    overlay.classList.remove('hidden');
}

// 👇 Promotion selection listener now moved to board.js
document.getElementById('promotionOverlay').addEventListener('click', e => {
  if (!pendingPromotion || !e.target.classList.contains('promo-piece')) return;

  const piece = e.target.dataset.piece;
  const { source, target } = pendingPromotion;
  makeMoveWithPromotion(source, target, piece);
  pendingPromotion = null;
  document.getElementById('promotionOverlay').classList.add('hidden');
});
