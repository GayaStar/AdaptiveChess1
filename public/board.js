import {
    getGame,
    getPlayerColor,
    getBoard,
    setBoard,
    hasGameEnded,
    isStockfishThinking,
    setStockfishThinking,
    getPlayerRating
} from './state.js';

import { makeStockfishMove } from './stockfish.js';
import { makeRLMove } from './rl_agent.js'; // ✅ RL agent support
import { updateUI, updateStatus } from './ui.js';

export function initializeBoard() {
    const config = {
        draggable: true,
        position: 'start',
        pieceTheme: typeof wikipedia_piece_theme !== 'undefined' ? wikipedia_piece_theme : undefined,
        onDragStart,
        onDrop,
        onMoveEnd,
        onSnapEnd
    };
    const board = Chessboard('myBoard', config);
    setBoard(board);
    $(window).resize(board.resize);
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
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q' // always promote to queen by default
    });

    if (!move) return 'snapback';

    highlightLastMove(move, true);
    updateUI();

    if (game.game_over()) {
        updateStatus();
        return;
    }

    setTimeout(makeEngineMove, 250); // ✅ Use dynamic engine logic
}

function makeEngineMove() {
    const rating = getPlayerRating();
    if (rating < 1200) {
        makeRLMove(rating); // RL agent for lower-rated players
    } else {
        makeStockfishMove(); // Stockfish for 1200+
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
