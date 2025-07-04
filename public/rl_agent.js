   
   import { getGame, getBoard, getPlayerColor, getPlayerRating, setGameEnded, getUserId } from './state.js';
    import { highlightLastMove } from './board.js';
    import { updateUI, updateStatus, updateRatingRL } from './ui.js';
    import { convertUciToSan } from './utils.js';
    import { speak } from './voice-utils.js';

    export async function makeRLMove(rating) {
        const game = getGame();
        const board = getBoard();
        const fen = game.fen();
        const userId = getUserId();
        const elo=getPlayerRating();
        try {
            const res = await fetch('http://localhost:5001/rl-move', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen, user_id: userId,elo:elo })
            });

            if (!res.ok) {
                const errText = await res.text(); // 💡 show real server error
                throw new Error(`Server responded with ${res.status}: ${errText}`);
            }

            const data = await res.json(); // 💥 this was failing
            const moveUci = data.move;

            const move = game.move({
                from: moveUci.from,
                to: moveUci.to,
                promotion: moveUci.promotion || 'q'
            });

            if (move) {
                board.position(game.fen());
                highlightLastMove(move, false);
                updateUI();

                const san = convertUciToSan(fen, moveUci.from + moveUci.to);
                speak(san);

                if (game.game_over()) {
                    updateStatus();
                    setGameEnded(true);
                    updateRatingRL();
                }
            }
        } catch (err) {
            console.error("RL move error:", err);
        }
    }
