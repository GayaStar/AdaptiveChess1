# hybrid_agent.py
import chess
import chess.engine
import random
from chess_rl_agent import RLChessAgent

class HybridChessAgent:
    def __init__(self, model_path, stockfish_path="D:/Adaptive_Chess/stockfish/stockfish-windows-x86-64-avx2.exe"):
        self.rl_agent = RLChessAgent(model_path)
        self.engine = chess.engine.SimpleEngine.popen_uci(stockfish_path)
        print("[INIT] HybridChessAgent initialized with RL model and Stockfish.")

    def set_user_elo(self, elo):
        print(f"[SET_ELO] User Elo set to {elo}")
        self.rl_agent.update_user_elo(elo)

    def select_move(self, board):
        legal_moves = list(board.legal_moves)
        user_elo = self.rl_agent.user_elo
        print(f"[SELECT_MOVE] Evaluating {len(legal_moves)} legal moves at Elo {user_elo}")
        
        # 1. Tactical Moves: Checkmate > Capture > Check
        tactical_moves = []
        for move in legal_moves:
            board.push(move)
            is_checkmate = board.is_checkmate()
            is_check = board.is_check()
            board.pop()

            if user_elo >= 700 and is_checkmate:
                tactical_moves.append((move, 3))
            elif user_elo >= 800 and board.is_capture(move):
                tactical_moves.append((move, 2))
            elif user_elo >= 900 and is_check:
                tactical_moves.append((move, 1))

        if tactical_moves:
            tactical_moves.sort(key=lambda x: -x[1])
            chosen = tactical_moves[0]
            print(f"[TACTIC] Tactical move chosen: {chosen[0]} with priority {chosen[1]}")
            return chosen[0]
        else:
            print("[TACTIC] No tactical move triggered.")

        # 2. Try RL Agent
        try:
            rl_move = self.rl_agent.select_move(board)
            print(f"[RL_AGENT] Suggested move: {rl_move}")
            if rl_move in legal_moves:
                print(f"[RL_AGENT] Move accepted.")
                return rl_move
            else:
                print(f"[RL_AGENT] Move rejected, not legal.")
        except Exception as e:
            print(f"[RL_AGENT] RL agent failed with error: {e}")

        # 3. Stockfish fallback
        try:
            result = self.engine.play(board, chess.engine.Limit(time=0.1))
            print(f"[STOCKFISH] Move chosen: {result.move}")
            return result.move
        except Exception as e:
            print(f"[STOCKFISH] Fallback failed with error: {e}")

        # 4. Final fallback: random
        fallback_move = random.choice(legal_moves)
        print(f"[FALLBACK] Random move selected: {fallback_move}")
        return fallback_move
