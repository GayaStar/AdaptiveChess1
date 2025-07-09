let gameInstance = null;
let boardInstance = null;
let stockfishInstance = null;
let playerColor = 'w';
let isStockfishTurn = false;
let playerRating = 1000;
let stockfishLevel = 0;
let stockfishDepth = 5;
let gameEnded = false;
let gameSaved = false;
const API = 'http://localhost:8081';

// 🧠 RL Agent flag
let rlGame = false;

// 🧑‍💻 User info
let userId = null;

// ==== Game and Board Access ====
export function getGame() { return gameInstance; }
export function setGame(game) { gameInstance = game; }

export function getBoard() { return boardInstance; }
export function setBoard(board) { boardInstance = board; }

export function getStockfish() { return stockfishInstance; }
export function setStockfish(worker) { stockfishInstance = worker; }

// ==== Player and Turn ====
export function getPlayerColor() { return playerColor; }
export function setPlayerColor(color) { playerColor = color; }

export function isStockfishThinking() { return isStockfishTurn; }
export function setStockfishThinking(value) { isStockfishTurn = value; }

export function getPlayerRating() { return playerRating; }
export function setPlayerRating(rating) { playerRating = rating; }

export function getStockfishLevel() { return stockfishLevel; }
export function setStockfishLevel(level) { stockfishLevel = level; }

export function getStockfishDepth() { return stockfishDepth; }
export function setStockfishDepth(depth) { stockfishDepth = depth; }

export function hasGameEnded() { return gameEnded; }
export function setGameEnded(status) { gameEnded = status; }

export function isGameSaved() { return gameSaved; }
export function setGameSaved(status) { gameSaved = status; }

export function getApiUrl() { return API; }

// ==== RL Agent Game Mode ====
export function isRLGame() { return rlGame; }
export function setIsRLGame(value) { rlGame = value; }

// ==== User Identification ====
export function setUserId(id) { userId = id; }
export function getUserId() { return userId; }
