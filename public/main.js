let board = null;
let game = new Chess();
let stockfish = null;
let playerColor = 'w';
let isStockfishTurn = false;
let playerRating = 1200;
let stockfishLevel = 0;
let stockfishDepth = 5;
let gameEnded = false;
let gameSaved = false;
const API = 'http://localhost:8080';

const highlightStyles = {
    playerMove: { backgroundColor: "rgba(255, 255, 0, 0.4)" },
    engineMove: { backgroundColor: "rgba(173, 216, 230, 0.4)" }
};

function loadStockfish() {
    return new Promise((resolve, reject) => {
        try {
            stockfish = new Worker('/stockfish-17-lite-single.js');
            stockfish.onmessage = (event) => onStockfishMessage(event.data);
            stockfish.onerror = (error) => reject(error);
            stockfish.postMessage('uci');
            stockfish.postMessage('isready');
            updateStockfishLevel(stockfishLevel, false);

            const messageHandler = function(event) {
                if (event.data === 'readyok') {
                    stockfish.removeEventListener('message', messageHandler);
                    resolve();
                }
            };
            stockfish.addEventListener('message', messageHandler);
        } catch (error) {
            reject(error);
        }
    });
}

function initializeBoard() {
    const config = {
        draggable: true,
        position: 'start',
        pieceTheme: typeof wikipedia_piece_theme !== 'undefined' ? wikipedia_piece_theme : undefined,
        onDragStart: onDragStart,
        onDrop: onDrop,
        onMoveEnd: onMoveEnd,
        onSnapEnd: onSnapEnd
    };
    board = Chessboard('myBoard', config);
    $(window).resize(board.resize);
}

function setupEventListeners() {
    $('#startBtn').on('click', startNewGame);
    $('#undoBtn').on('click', undoMove);
    $('#playAsWhite').on('click', () => setPlayerColor('w'));
    $('#playAsBlack').on('click', () => setPlayerColor('b'));
}

function updateUI() {
    $('#playerRating').text(playerRating);
    $('#stockfishLevel').text(stockfishLevel);
    $('#stockfishDepth').text(stockfishDepth);
    updateStatus();
    updateMoveList();
}

function updateStatus() {
    let status = '';
    if (game.in_checkmate()) {
        if (!gameEnded) {
            const playerWon = game.turn() !== playerColor[0];
            status = playerWon ? 'Congratulations! You won!' : 'Game over, Stockfish wins!';
            updateRatings(playerWon);
            saveGameOnce();
            gameEnded = true;
        } else {
            status = $('#status').text();
        }
    }
    else if (game.in_draw()) {
        if (!gameEnded) {
            status = 'Game over, drawn position';
            updateRatings(0.5);
            saveGameOnce();
            gameEnded = true;
        } else {
            status = $('#status').text();
        }
    }
    else if (game.in_stalemate()) {
        if (!gameEnded) {
            status = 'Game over, drawn by stalemate';
            updateRatings(0.5);
            saveGameOnce();
            gameEnded = true;
        } else {
            status = $('#status').text();
        }
    }
    else if (game.in_threefold_repetition()) {
        if (!gameEnded) {
            status = 'Game over, drawn by repetition';
            updateRatings(0.5);
            saveGameOnce();
            gameEnded = true;
        } else {
            status = $('#status').text();
        }
    }
    else if (game.insufficient_material()) {
        if (!gameEnded) {
            status = 'Game over, drawn by insufficient material';
            updateRatings(0.5);
            saveGameOnce();
            gameEnded = true;
        } else {
            status = $('#status').text();
        }
    }
    else {
        status = (game.turn() === playerColor[0]) ? 'Your turn' : 'Stockfish is thinking...';
        gameEnded = false;
    }
    $('#status').text(status);
}

function updateRatings(result) {
    const stockfishRating = 1000 + (stockfishLevel * 100);
    if (typeof result === 'boolean') {
        if (result) {
            // Player won
            playerRating = Math.round(playerRating + 32 * (1 - getExpectedScore(playerRating, stockfishRating)));
            stockfishLevel = Math.min(20, stockfishLevel + 1);
            stockfishDepth = Math.min(15, stockfishDepth + 1);
        } else {
            // Player lost
            playerRating = Math.round(playerRating + 32 * (0 - getExpectedScore(playerRating, stockfishRating)));
            stockfishLevel = Math.max(0, stockfishLevel - 1);
            stockfishDepth = Math.max(1, stockfishDepth - 1);
        }
    } else {
        // Draw
        playerRating = Math.round(playerRating + 32 * (0.5 - getExpectedScore(playerRating, stockfishRating)));
    }
    playerRating = Math.max(100, playerRating);

    // Update rating and stockfish settings in users collection
    fetch('/update_rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            rating: playerRating
        })
    });
    fetch('/update_stockfish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            stockfishLevel: stockfishLevel,
            stockfishDepth: stockfishDepth
        })
    });

    $('#playerRating').text(playerRating);
    $('#stockfishLevel').text(stockfishLevel);
    $('#stockfishDepth').text(stockfishDepth);
    updateStockfishLevel(stockfishLevel, false);
}

function getExpectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

function setPlayerColor(color) {
    playerColor = color;
    board.orientation(playerColor === 'w' ? 'white' : 'black');
    startNewGame();
}

function startNewGame() {
    game = new Chess();
    board.position(game.fen());
    clearHighlights();
    gameEnded = false;
    gameSaved = false;
    updateUI();

    // If player is black, let Stockfish move first
    if (playerColor === 'b') {
        setTimeout(makeStockfishMove, 250);
    }
}

function undoMove() {
    if (game.history().length <= 0) return;
    if (isStockfishTurn) {
        stockfish.postMessage('stop');
        isStockfishTurn = false;
    }
    game.undo();
    if (game.history().length > 0) {
        game.undo();
    }
    board.position(game.fen());
    clearHighlights();
    gameEnded = false;
    gameSaved = false;
    updateUI();
}

function clearHighlights() {
    $('#myBoard .square-55d63').css('background', '');
}

function highlightSquare(square, style) {
    $(`#myBoard .square-${square}`).css('background', style.backgroundColor);
}

function highlightLastMove(move, isPlayerMove) {
    clearHighlights();
    const style = isPlayerMove ? highlightStyles.playerMove : highlightStyles.engineMove;
    highlightSquare(move.from, style);
    highlightSquare(move.to, style);
}

function onStockfishMessage(message) {
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
            if (move) {
                board.position(game.fen());
                highlightLastMove(move, false);
                updateUI();
                isStockfishTurn = false;

                // Check if game ended after Stockfish move
                if (game.game_over() && !gameEnded) {
                    updateStatus();
                }
            }
        }
    }
}

function updateStockfishLevel(level, shouldUpdateUI = true) {
    if (!stockfish) return;
    stockfishLevel = Math.max(0, Math.min(20, level));
    stockfish.postMessage(`setoption name Skill Level value ${stockfishLevel}`);
    const errProb = Math.round((stockfishLevel * 6.35) + 1);
    const maxErr = Math.round((stockfishLevel * -0.5) + 10);
    stockfish.postMessage(`setoption name Skill Level Maximum Error value ${maxErr}`);
    stockfish.postMessage(`setoption name Skill Level Probability value ${errProb}`);
    if (shouldUpdateUI) updateUI();
}

function makeStockfishMove() {
    if (game.game_over()) {
        stockfish.postMessage('stop');
        return;
    }
    isStockfishTurn = true;
    stockfish.postMessage('ucinewgame');
    stockfish.postMessage(`position fen ${game.fen()}`);
    stockfish.postMessage(`go depth ${stockfishDepth}`);
}

function onDragStart(source, piece, position, orientation) {
    if (gameEnded) return false;
    if (game.turn() !== playerColor[0]) return false;
    if ((playerColor === 'w' && piece.search(/^b/) !== -1) ||
        (playerColor === 'b' && piece.search(/^w/) !== -1)) {
        return false;
    }
    return true;
}

function onDrop(source, target) {
    const move = game.move({
        from: source,
        to: target,
        promotion: 'q'
    });
    if (move === null) return 'snapback';

    highlightLastMove(move, true);
    updateUI();

    if (game.game_over()) {
        updateStatus();
        return;
    }

    setTimeout(makeStockfishMove, 250);
}

function onMoveEnd() {
    board.position(game.fen());
}

function onSnapEnd() {
    board.position(game.fen());
}

function updateMoveList() {
    const history = game.history({ verbose: true });
    let html = '';
    for (let i = 0; i < history.length; i += 2) {
        const moveNum = (i / 2) + 1;
        const whiteMove = history[i] ? history[i].san : '';
        const blackMove = history[i + 1] ? history[i + 1].san : '';
        html += `<div>${moveNum}. ${whiteMove} ${blackMove}</div>`;
    }
    $('#move-list').html(html);
}

function saveGameOnce() {
    if (gameSaved) return;
    let moves = game.history();
    let res = game.in_checkmate() ? (game.turn() !== playerColor[0] ? "1-0" : "0-1") : "1/2-1/2";
    saveGameToDB(moves, res);
    gameSaved = true;
}

function saveGameToDB(moves, result) {
    fetch(API + '/save_game', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify({
            moves: moves,
            result: result,
            rating: playerRating
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

// On page load, fetch user's data from server using session
$(async function() {
    // Check session and get user info
    const userRes = await fetch('/user', {
        method: 'GET',
        credentials: 'include'
    });
    if (!userRes.ok) {
        alert('Please login first.');
        window.location.href = "login.html";
        return;
    }
    const data = await userRes.json();
    playerRating = data.rating || 1200;
    stockfishLevel = typeof data.stockfishLevel === 'number' ? data.stockfishLevel : 0;
    stockfishDepth = typeof data.stockfishDepth === 'number' ? data.stockfishDepth : 5;

    await loadStockfish();
    updateStockfishLevel(stockfishLevel, false);
    initializeBoard();
    setupEventListeners();
    startNewGame();
});
