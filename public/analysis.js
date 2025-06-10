import { getGame, getPlayerColor } from './state.js';
import { convertUciToSan } from './utils.js';

export async function generateAnalysis() {
    $('#move-list').hide();
    const game = getGame();
    const moves = game.history();
    console.log("Game history:", moves);

    $('#analysisResult').html('<h3>Move Analysis:</h3>');

    try {
        const data = await analyzeMovesWithStockfish(moves, getPlayerColor());
        if (!data || data.length === 0) {
            $('#analysisResult').append('<div>No analysis available.</div>');
        } else {
            data.forEach(item => {
                const moveIndex = (item.moveNumber - 1) * 2;
                const whiteMove = moves[moveIndex] || "";
                const blackMove = moves[moveIndex + 1] || "";
                const movePairDisplay = `${whiteMove}-${blackMove}`;

                const html = `
                    <div class="analysis-entry">
                    <b>${item.moveNumber}. ${movePairDisplay}</b> - 
                    <span class="label ${item.label.toLowerCase()}">${item.label}</span><br>
                    <b>Best move possible:</b> ${item.bestMove}<br>
                    <span class="score">Evaluation: ${item.score}</span>
                    </div>`;
                $('#analysisResult').append(html);
            });

        }
    } catch (err) {
        console.error("Analysis error:", err);
        $('#analysisResult').append('<div>Analysis failed. Check console.</div>');
    }

    $('#analysisResult').show();
}

export async function analyzeMovesWithStockfish(sanMoves, playerColor = getPlayerColor()) {
    const analysis = [];
    const chess = new Chess();

    for (let i = 0; i < sanMoves.length; i++) {
        const fenBeforeMove = chess.fen();
        const sanMove = sanMoves[i];
        const move = chess.move(sanMove, { sloppy: true });

        if (!move) {
            console.warn(`Invalid move SAN: ${sanMove} at move index ${i}`);
            console.warn("Legal moves were:", chess.moves());
            break;  // or continue, depending on your policy
        }

        // Check if this move is by the player
        const moveByPlayer = (playerColor === 'w' && i % 2 === 0) || (playerColor === 'b' && i % 2 === 1);

        if (moveByPlayer) {
            // Analyze this user move

            const fenAfterMove = chess.fen();

            // Get best PV for fen before move (to see best move user could play here)
            const pvMoves = await getBestPV(fenBeforeMove, 12, 6);
            const userScore = await getStockfishScore(fenAfterMove);

            // Best move is first in PV
            const bestMoveUci = pvMoves[0];
            const chessBest = new Chess(fenBeforeMove);
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

            // Generate best move pairs string (optional)
            const bestMovePairs = [];
            const tmp = new Chess(fenBeforeMove);

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
                userMove: sanMove,
                stockfishMove: "None",
                label,
                bestMove: bestMovePairs.length ? bestMovePairs.join(', ') : "Not available",
                score: (userScore / 100).toFixed(2) + " pawns"
            });
        }
    }

    return analysis;
}


async function getBestPV(fen, depth = 12, maxMoves = 3) {
    return await new Promise(resolve => {
        const sf = new Worker('/stockfish-17-lite-single.js');
        let latestPV = [];

        sf.onmessage = (e) => {
            const line = e.data;
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
                    resolve(match[1] === 'cp' ? parseInt(match[2]) : (match[2] > 0 ? 10000 : -10000));
                }
            }
        };

        sf.postMessage(`position fen ${fen}`);
        sf.postMessage('go depth 12');
    });
}
