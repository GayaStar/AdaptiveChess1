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
    getBoard,
    getStockfishRandomness,
} from './state.js';
import { speak } from './voice-utils.js';
import { highlightLastMove } from './board.js';
import { updateUI, updateStatus } from './ui.js';
import { convertUciToSan } from './utils.js'; // At top
let playerRating = 800;
let stockfishLevel = 5;
let stockfishDepth = 10;
let stockfishRandomn = 2;

export function getStockfishRandomn() {
  return stockfishRandomn;
}

export function setStockfishRandomness(r) {
  stockfishRandomness = Math.max(0, Math.min(3, r));
}
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
    const randomness = Math.max(0, Math.min(3, getStockfishRandomness())); // ✅ Fix
    console.log(`[STOCKFISH] Randomness = ${randomness}`);

    stockfish.postMessage(`setoption name Skill Level value ${level}`);
    const errProb = Math.round((level * 6.35) + 1);
    const maxErr = Math.round((level * -0.5) + 10);
    stockfish.postMessage(`setoption name Skill Level Maximum Error value ${maxErr}`);
    stockfish.postMessage(`setoption name Skill Level Probability value ${errProb}`);
    stockfish.postMessage(`setoption name MultiPV value ${randomness + 1}`); // ✅ Controlled randomness

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
let topMoves = []; // ✅ Clear for next move

function onStockfishMessage(message) {
    const game = getGame();
    const board = getBoard();
    const randomness = getStockfishRandomness(); // 0 = perfect, 3 = very weak

    if (typeof message !== 'string') return;

    // ✅ Capture candidate moves (MultiPV)
    if (message.startsWith('info') && message.includes(' pv ')) {
        const match = message.match(/multipv (\d+).* pv ([a-h1-8 ]+)/);
        if (match) {
            const move = match[2].trim().split(' ')[0]; // First move in PV
            const index = parseInt(match[1], 10) - 1;
            topMoves[index] = move;
        }
    }

    if (message.startsWith('bestmove')) {
        let chosenMove;

        if (randomness > 0 && topMoves.length > 1) {
            const maxIndex = Math.min(randomness, topMoves.length - 1);
            const idx = Math.floor(Math.random() * (maxIndex + 1));
            chosenMove = topMoves[idx];
            console.log(idx,topMoves)
        } else {
            const moveRegex = /bestmove\s+(\w+)(?:\s+ponder\s+(\w+))?/;
            const match = message.match(moveRegex);
            if (match && match[1]) {
                chosenMove = match[1];
            }
        }

        topMoves = []; // ✅ Clear for next move

        if (chosenMove) {
            const from = chosenMove.slice(0, 2);
            const to = chosenMove.slice(2, 4);
            const promotion = chosenMove.length === 5 ? chosenMove[4] : undefined;
            const originalFen = game.fen();

            const tempGame = new Chess(originalFen);
            const tempMove = tempGame.move({ from, to, promotion });

            if (tempMove) {
                const san = tempMove.san;
                const realMove = game.move(tempMove);

                if (realMove && board) {
                    board.position(game.fen());
                    highlightLastMove(realMove, false);
                    speak(san);
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




