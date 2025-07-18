//game.js
import {
    setGame,
    getGame,
    getBoard,
    getPlayerColor,
    setPlayerColor,
    setGameEnded,
    setGameSaved,
    getApiUrl,
    getPlayerRating,
    isStockfishThinking,
    setStockfishThinking,
    getStockfish
} from './state.js';

import { makeRLMove } from './rl_agent.js';
import { updateUI } from './ui.js';
import { clearHighlights, initializeBoard } from './board.js';
import { makeStockfishMove } from './stockfish.js';

export function startNewGame(color='w') {
    initializeBoard(color);
    $('#move-list').show();
    $('#analysisResult').hide();

    const game = new Chess();
    setGame(game);

    const board = getBoard();
    board.position(game.fen());

    clearHighlights();
    setGameEnded(false);
    setGameSaved(false);
    updateUI();

    // 👇 If playing as black, let the engine play first move
    if (getPlayerColor() === 'b') {
        const rating = getPlayerRating();
        if (rating < 1200) {
            makeRLMove(rating);
        } else {
            makeStockfishMove();
        }
    }
}

export function undoMove() {
    $('#move-list').show();
    $('#analysisResult').hide();

    const game = getGame();
    const board = getBoard();

    if (game.history().length <= 0) return;

    // ❌ Stop Stockfish thinking, if needed
    if (isStockfishThinking()) {
        const sf = getStockfish();
        if (sf) sf.postMessage('stop');
        setStockfishThinking(false);
    }

    game.undo();  // undo user move
    if (game.history().length > 0) {
        game.undo();  // undo engine move
    }

    board.position(game.fen());
    clearHighlights();
    setGameEnded(false);
    setGameSaved(false);
    updateUI();
}

export function switchPlayerColor(color) {
    setPlayerColor(color);
    const board = getBoard();
    board.orientation(color === 'w' ? 'white' : 'black');
    startNewGame(color); // restart with new color
}

export function saveGameToDB(moves, result) {
    fetch(getApiUrl() + '/save_game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            moves: moves,
            result: result,
            rating: getPlayerRating()
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert("Game saved!");
        } else {
            alert("Failed to save game: " + (data.msg || "Unknown error"));
        }
    })
    .catch(err => {
        console.error("Error saving game:", err);
        alert("Error saving game.");
    });
}
