// game.js

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
    setStockfishThinking
} from './state.js';

import { updateUI } from './ui.js';
import { clearHighlights } from './board.js';
import { makeStockfishMove } from './stockfish.js';

export function startNewGame() {
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

    if (getPlayerColor() === 'b') {
        setTimeout(makeStockfishMove, 250);
    }
}

export function undoMove() {
    $('#move-list').show();
    $('#analysisResult').hide();

    const game = getGame();
    const board = getBoard();

    if (game.history().length <= 0) return;

    if (isStockfishThinking()) {
        const sf = getStockfish();
        if (sf) sf.postMessage('stop');
        setStockfishThinking(false);
    }

    game.undo();
    if (game.history().length > 0) {
        game.undo();
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
    startNewGame();
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
