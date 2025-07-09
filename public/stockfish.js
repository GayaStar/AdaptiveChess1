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
import { speak } from './voice-utils.js';
import { highlightLastMove } from './board.js';
import { updateUI, updateStatus } from './ui.js';
import { convertUciToSan } from './utils.js'; // At top

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

    if (!stockfish) {
        console.warn('Stockfish is not initialized yet.');
        return;
    }

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
            const originalFen = game.fen(); // Capture FEN before making move
            
            // Make the move on a temporary game instance for SAN conversion
            const tempGame = new Chess(originalFen);
            const tempMove = tempGame.move({
                from: moveString.substring(0, 2),
                to: moveString.substring(2, 4),
                promotion: moveString.length === 5 ? moveString.substring(4, 5) : undefined
            });

            if (tempMove) {
                const san = tempMove.san; // Get accurate SAN from temporary game
                
                // Now make the actual move on the real game
                const realMove = game.move(tempMove);
                if (realMove && board) {
                    board.position(game.fen());
                    highlightLastMove(realMove, false);
                    speak(san); // Use the properly converted SAN
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
}




