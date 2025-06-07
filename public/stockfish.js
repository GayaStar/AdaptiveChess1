// stockfish.js

import {
    setStockfish,
    getStockfish,
    getStockfishLevel,
    getStockfishDepth,
    getGame,
    setStockfishThinking,
    hasGameEnded,
    setGameEnded,
    getBoard 
} from './state.js';

import { highlightLastMove } from './board.js';
import { updateUI, updateStatus } from './ui.js';

export function loadStockfish() {
    return new Promise((resolve, reject) => {
        try {
            const sf = new Worker('/stockfish-17-lite-single.js');
            setStockfish(sf);
            sf.onmessage = (event) => onStockfishMessage(event.data);
            sf.onerror = (error) => reject(error);
            sf.postMessage('uci');
            sf.postMessage('isready');

            const level = getStockfishLevel();
            updateStockfishLevel(level, false);

            const messageHandler = function (event) {
                if (event.data === 'readyok') {
                    sf.removeEventListener('message', messageHandler);
                    resolve();
                }
            };
            sf.addEventListener('message', messageHandler);
        } catch (error) {
            reject(error);
        }
    });
}

export function updateStockfishLevel(level, shouldUpdateUI = true) {
    const stockfish = getStockfish();
    if (!stockfish) return;

    level = Math.max(0, Math.min(20, level));
    stockfish.postMessage(`setoption name Skill Level value ${level}`);
    const errProb = Math.round((level * 6.35) + 1);
    const maxErr = Math.round((level * -0.5) + 10);
    stockfish.postMessage(`setoption name Skill Level Maximum Error value ${maxErr}`);
    stockfish.postMessage(`setoption name Skill Level Probability value ${errProb}`);

    if (shouldUpdateUI) updateUI();
}

export function makeStockfishMove() {
    const game = getGame();
    const stockfish = getStockfish();
    if (game.game_over()) {
        stockfish.postMessage('stop');
        return;
    }
    setStockfishThinking(true);
    stockfish.postMessage('ucinewgame');
    stockfish.postMessage(`position fen ${game.fen()}`);
    stockfish.postMessage(`go depth ${getStockfishDepth()}`);
}

function onStockfishMessage(message) {
    const game = getGame();
    const board = getBoard(); 

    if (typeof message !== 'string') return;

    if (message.startsWith('bestmove')) {
        const moveRegex = /bestmove\s+(\w+)(?:\s+ponder\s+(\w+))?/;
        const match = message.match(moveRegex);
        if (match && match[1]) {
            const moveString = match[1];
            const move = game.move({
                from: moveString.substring(0, 2),
                to: moveString.substring(2, 4),
                promotion: moveString.length === 5 ? moveString.substring(4, 5) : undefined
            });

            if (move && board) {
                board.position(game.fen()); 
                highlightLastMove(move, false);
                updateUI();
                setStockfishThinking(false);

                if (game.game_over() && !hasGameEnded()) {
                    updateStatus();
                    setGameEnded(true);
                }
            }
        }
    }
}
