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

            const messageHandler = function (event) {
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
    $('#analyzeBtn').on('click', generateAnalysis);
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
    if (game.in_checkmate() || game.in_draw() || game.in_stalemate() ||
        game.in_threefold_repetition() || game.insufficient_material()) {
        $('#analyzeBtn').show();
        $('#analysisResult').show();
    } else {
        $('#analyzeBtn').hide();
        $('#analysisResult').html('');
    }

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



function generateAnalysis() {
    // alert("Clicked!");
    $('#move-list').hide();
    console.log("Game history:", game.history());
    $('#analysisResult').html('<h3>Move Analysis:</h3>');

    analyzeMovesWithStockfish(game.history())
        .then(data => {
            if (!data || data.length === 0) {
                $('#analysisResult').append('<div>No analysis available.</div>');
                $('#analysisResult').show();
                return;
            }
            data.forEach(item => {
                const movePair = `${item.userMove}${item.stockfishMove ? ' - ' + item.stockfishMove : ''}`;
                const html = `
                    <div class="analysis-entry">
                        <b>${item.moveNumber}. ${movePair}</b> - <span class="label ${item.label.toLowerCase()}">${item.label}</span><br>
                        <b>Best move possible:</b> ${item.bestMove}<br>
                        <span class="score">Evaluation: ${item.score}</span>
                    </div>
                    `;

                $('#analysisResult').append(html);
            });
            $('#analysisResult').show(); // <-- Ensure the result is always visible
        }).catch(err => {
            console.error("Analysis error:", err);
            $('#analysisResult').append('<div>Analysis failed. Check console.</div>');
            $('#analysisResult').show();
        });
}

async function analyzeMovesWithStockfish(sanMoves, playerColor = 'w') {
    console.log("Analyzing", sanMoves.length, "moves");

    const analysis = [];
    const chess = new Chess();
    const startIdx = playerColor === 'w' ? 0 : 1;

    for (let i = startIdx; i < sanMoves.length; i += 2) {
        const fenBeforeUser = chess.fen();
        const userSan = sanMoves[i];
        const userMove = chess.move(userSan, { sloppy: true });

        if (!userMove) {
            console.warn(`Invalid user move SAN: ${userSan} at move ${i}`);
            break;
        }

        let stockfishSan = null;
        if (i + 1 < sanMoves.length) {
            stockfishSan = sanMoves[i + 1];
            chess.move(stockfishSan, { sloppy: true });
        }

        const fenAfterUser = chess.fen();
        const pvMoves = await getBestPV(fenBeforeUser, 12, 6);  // Request longer PV for pairs

        const userScore = await getStockfishScore(fenAfterUser);
        const bestMoveUci = pvMoves[0];

        const chessBest = new Chess(fenBeforeUser);
        chessBest.move({
            from: bestMoveUci.slice(0, 2),
            to: bestMoveUci.slice(2, 4),
            promotion: bestMoveUci.length > 4 ? bestMoveUci[4] : undefined
        });
        const bestScore = await getStockfishScore(chessBest.fen());
        const diff = Math.abs(bestScore - userScore);

        let label = "Good";
        if (diff > 150) label = "Blunder";
        else if (diff > 75) label = "Mistake";
        else if (diff > 30) label = "Inaccuracy";

        // 🟨 Format best variation as PAIRS: Ng4-Nf3, Nbd7-Qe3
        const bestMovePairs = [];
        const tmp = new Chess(fenBeforeUser);

        for (let j = 0; j + 1 < pvMoves.length; j += 2) {
            try {
                const move1 = pvMoves[j];
                const move2 = pvMoves[j + 1];

                const san1 = convertUciToSan(tmp.fen(), move1);
                tmp.move({
                    from: move1.slice(0, 2),
                    to: move1.slice(2, 4),
                    promotion: move1.length > 4 ? move1[4] : undefined
                });

                const san2 = convertUciToSan(tmp.fen(), move2);
                tmp.move({
                    from: move2.slice(0, 2),
                    to: move2.slice(2, 4),
                    promotion: move2.length > 4 ? move2[4] : undefined
                });

                if (san1 && san2) {
                    bestMovePairs.push(`${san1}-${san2}`);
                }
            } catch (err) {
                console.warn("Could not convert PV to move pair:", err);
                break;
            }
        }

        analysis.push({
            moveNumber: Math.floor(i / 2) + 1,
            userMove: userSan,
            stockfishMove: stockfishSan || "None",
            label,
            bestMove: bestMovePairs.length ? bestMovePairs.join(', ') : "Not available",
            score: (userScore / 100).toFixed(2) + " pawns"
        });
    }

    return analysis;
}


async function getBestPV(fen, depth = 12, maxMoves = 3) {

    return await new Promise(resolve => {
        const sf = new Worker('/stockfish-17-lite-single.js');
        let latestPV = [];

        sf.onmessage = (e) => {
            const line = e.data;
            console.log("SF:", line);
            if (line.startsWith('info') && line.includes(' pv ')) {
                const pvString = line.split(' pv ')[1];
                latestPV = pvString.split(' ').slice(0, maxMoves);
            }
            if (line.startsWith('bestmove')) {
                sf.terminate();
                resolve(latestPV);
            }
        };

        sf.postMessage(`position fen ${fen}`);
        sf.postMessage(`go depth ${depth}`);
    });
}

async function getStockfishScore(fen) {
    return await new Promise(resolve => {
        const sf = new Worker('/stockfish-17-lite-single.js');
        let scoreFound = false;

        sf.onmessage = (e) => {
            const line = e.data;

            if (line.includes('score') && !scoreFound) {
                const match = line.match(/score (cp|mate) ([\-0-9]+)/);
                if (match) {
                    scoreFound = true;
                    sf.terminate();
                    resolve(
                        match[1] === 'cp'
                            ? parseInt(match[2])
                            : (match[2] > 0 ? 10000 : -10000)
                    );
                }
            }
        };

        sf.postMessage(`position fen ${fen}`);
        sf.postMessage('go depth 12');
    });
}

function convertSanMovesToUci(sanMoves) {
    const chess = new Chess();
    const uciMoves= sanMoves.map(san => {
        const move = chess.move(san, { sloppy: true });
        return move ? move.from + move.to + (move.promotion || '') : null;
    }).filter(Boolean);
    console.log("Converted SAN to UCI:", uciMoves);
    return uciMoves;
}

function convertUciToSan(fen, uci) {
    const chessTmp = new Chess(fen);
    try {
        const moveObj = chessTmp.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined });
        if (moveObj) return moveObj.san;
    } catch (e) {
        return uci; // fallback to uci if move invalid
    }
    return uci;
}




function setPlayerColor(color) {
    playerColor = color;
    board.orientation(playerColor === 'w' ? 'white' : 'black');
    startNewGame();
}

function startNewGame() {
    $('#move-list').show();
    $('#analysisResult').hide();
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
    $('#move-list').show();
    $('#analysisResult').hide();
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
        headers: { 'Content-Type': 'application/json' },
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
$(async function () {
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
