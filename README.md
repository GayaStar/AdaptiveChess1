# adaptiveChess

this is a reinforcement+stockfish chess website (under progress)

Frontend Module Descriptions (public/js/)

main.js:
Entry point for the app. Initializes the chessboard, fetches session/user data, and sets up UI interactions including voice input. Instantiates Stockfish via Web Workers.

state.js:
Manages global application state (board, game object, rating, session info). Provides accessor methods for use across modules.

board.js:
Initializes the interactive chessboard (via Chessboard.js), handles click-based move input, highlights valid and recent moves, and manages pawn promotion UI.

game.js:
Controls overall gameplay flow: starting/resetting games, undoing moves, switching player colors, and saving game data to the backend.

stockfish.js:
Runs the Stockfish engine as a Web Worker, receives engine responses, and adjusts difficulty based on user performance (depth control). Coordinates AI move execution.

analysis.js:
Evaluates each player move using Stockfish’s centipawn loss and best move prediction. Labels user moves as "Good", "Inaccuracy", "Mistake", or "Blunder". Displays feedback in a categorized format.

utils.js:
Converts move notation between SAN and UCI formats. Includes helper functions like ELO score calculation and basic transformation logic for analysis and training.

ui.js:
Updates dynamic UI elements — move list, player ratings, game status, and final result. Triggers visual game-end states and manages adaptive feedback messages.

ui-events.js:
Binds UI buttons like New Game, Undo, Analyze, and Play as White/Black to corresponding logic. Also hooks into analysis and voice recognition toggles.

Backend (server.js)
Endpoint Description

POST /signup Registers a new user (with hashed password). Initializes rating and Stockfish settings.

POST /login Authenticates users and starts a session.

POST /logout Destroys the session and logs out the user.

GET /user Returns user profile including rating, Stockfish level/depth. Requires authentication.

POST /update_rating Updates the user's ELO rating.

POST /update_stockfish Updates Stockfish difficulty settings for the user.

POST /save_game Saves game history, result, and rating to MongoDB.

🛠 Setup Instructions
Install dependencies:

npm install express mongodb bcryptjs connect-mongo express-session cors

Start the server:

node server.js

Open the app:
Visit http://localhost:8080 in your browser
