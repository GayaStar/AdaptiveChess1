import os
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
import chess

# ======== Neural Network ========

class ChessNet(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(12, 128, 3, padding=1)
        self.conv2 = nn.Conv2d(128, 256, 3, padding=1)
        self.conv3 = nn.Conv2d(256, 256, 3, padding=1)
        self.fc1 = nn.Linear(256 * 8 * 8, 1024)
        self.policy_head = nn.Linear(1024, 4672)
        self.value_head = nn.Linear(1024, 1)

    def forward(self, x):
        x = F.relu(self.conv1(x))
        x = F.relu(self.conv2(x))
        x = F.relu(self.conv3(x))
        x = x.view(-1, 256 * 8 * 8)
        x = F.relu(self.fc1(x))
        policy = self.policy_head(x)
        value = torch.tanh(self.value_head(x))
        return policy, value

# ======== Utility ========

def board_to_tensor(board):
    piece_map = {
        'P': 0, 'N': 1, 'B': 2, 'R': 3, 'Q': 4, 'K': 5,
        'p': 6, 'n': 7, 'b': 8, 'r': 9, 'q': 10, 'k': 11
    }
    tensor = np.zeros((12, 8, 8), dtype=np.float32)
    for square, piece in board.piece_map().items():
        idx = piece_map[piece.symbol()]
        row, col = divmod(square, 8)
        tensor[idx, row, col] = 1
    return torch.tensor(tensor)

def estimate_user_elo(results):
    if len(results) < 10:
        return 600
    avg_score = sum(results) / len(results)
    return int(600 + 600 * (avg_score - 0.2) / 0.6)

# ======== RL Agent ========

class RLChessAgent:
    def __init__(self, model_path):
        self.model = ChessNet()
        self.model.load_state_dict(torch.load(model_path, map_location=torch.device("cpu")))
        self.model.eval()
        self.temperature = 1.0
        self.user_elo = 800

    def update_user_elo(self, new_elo):
        self.user_elo = new_elo
        self.temperature = max(0.3, 1.7 - (self.user_elo - 600) / 400)
        print(f"[INFO] Agent temperature updated to {self.temperature:.2f} based on ELO {self.user_elo}")

    def select_move(self, board):
        state = board_to_tensor(board).unsqueeze(0)
        with torch.no_grad():
            logits, _ = self.model(state)
        legal_moves = list(board.legal_moves)
        move_indices = [m.from_square * 64 + m.to_square for m in legal_moves]
        scaled_logits = logits[0][move_indices] / self.temperature
        probs = torch.softmax(scaled_logits, dim=0).numpy()
        selected_move = np.random.choice(legal_moves, p=probs)

        print(f"[DEBUG] Selected move: {selected_move}, Temperature: {self.temperature:.2f}")
        return selected_move
