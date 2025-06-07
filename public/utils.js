// utils.js

// Converts SAN (Standard Algebraic Notation) moves to UCI format
export function convertSanMovesToUci(sanMoves) {
    const chess = new Chess();
    const uciMoves = sanMoves.map(san => {
        const move = chess.move(san, { sloppy: true });
        return move ? move.from + move.to + (move.promotion || '') : null;
    }).filter(Boolean);

    console.log("Converted SAN to UCI:", uciMoves);
    return uciMoves;
}

// Converts a single UCI move to SAN using the FEN position
export function convertUciToSan(fen, uci) {
    const chessTmp = new Chess(fen);
    try {
        const moveObj = chessTmp.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci.length > 4 ? uci[4] : undefined
        });
        if (moveObj) return moveObj.san;
    } catch (e) {
        return uci; // fallback if move is invalid
    }
    return uci;
}

// Calculates expected win probability using ELO rating system
export function getExpectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}
