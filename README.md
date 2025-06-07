# adaptiveChess
this is a reinforcement+stockfish chess website (under progress)

Frontend Module Descriptions (public/js/)

main.js:	Entry point for the app. Fetches session data, initializes Stockfish, board, and sets up UI event listeners.

state.js:	Centralized state manager. Exposes getter/setter functions for global game state variables like board, game, rating, etc.

board.js:	Initializes the chessboard and handles user drag/drop, move validation, and visual move highlighting.

game.js:	Manages core gameplay actions like starting a new game, undoing moves, switching player color, and saving games to the backend.

stockfish.js:	Loads the Stockfish engine, communicates moves, adjusts difficulty level, and handles its turn logic.

ui.js:	Updates player ratings, move list, and game status. Also calculates ELO changes and triggers game-over UI states.

analysis.js:	Analyzes played moves using Stockfish. Labels them as "Good", "Mistake", or "Blunder" and provides best alternatives.

utils.js:	Provides helper functions to convert SAN ⇄ UCI notation and calculate expected score using ELO ratings.

ui-events.js:	Binds event listeners to all UI buttons like "New Game", "Undo", "Play as White/Black", and "Analyze".

Backend (server.js)
Endpoint	Description

POST /signup	Registers a new user (with hashed password). Initializes rating and Stockfish settings.

POST /login	Authenticates users and starts a session.

POST /logout	Destroys the session and logs out the user.

GET /user	Returns user profile including rating, Stockfish level/depth. Requires authentication.

POST /update_rating	Updates the user's ELO rating.

POST /update_stockfish	Updates Stockfish difficulty settings for the user.

POST /save_game	Saves game history, result, and rating to MongoDB.

🛠 Setup Instructions
Install dependencies:

npm install express mongodb bcryptjs connect-mongo express-session cors

Start the server:

node server.js

Open the app:
Visit http://localhost:8080 in your browser
