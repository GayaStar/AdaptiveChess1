const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const MongoStore = require('connect-mongo');

const app = express();
const PORT = 8080;
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'chess_app';

let db, usersCollection;

// Middleware
app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'chess-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    dbName: DB_NAME,
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 86400000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// MongoDB Connection
MongoClient.connect(MONGO_URI, { useUnifiedTopology: true })
  .then(client => {
    db = client.db(DB_NAME);
    usersCollection = db.collection('users');
    usersCollection.createIndex({ username: 1 }, { unique: true });
    console.log("Connected to MongoDB");
  })
  .catch(err => console.error("MongoDB connection error:", err));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.username) {
    return res.status(401).json({ msg: "Not authenticated" });
  }
  next();
};

// API Endpoints
app.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    const userExists = await usersCollection.findOne({ username });
    if (userExists) return res.status(400).json({ msg: "Username already exists" });

    const hash = await bcrypt.hash(password, 10);
    await usersCollection.insertOne({ 
      username, 
      password: hash,
      rating: 1000,
      stockfishLevel: 0,
      stockfishDepth: 5
    });
    res.json({ msg: "Signup successful" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ msg: "Invalid credentials" });

    req.session.username = user.username;
    res.json({ 
      msg: "Login successful",
      username: user.username,
      rating: user.rating,
      stockfishLevel: user.stockfishLevel,
      stockfishDepth: user.stockfishDepth
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

app.get('/user', requireAuth, async (req, res) => {
  try {
    const user = await usersCollection.findOne({ 
      username: req.session.username 
    });
    if (!user) return res.status(404).json({ msg: "User not found" });
    
    res.json({ 
      username: user.username,
      rating: user.rating,
      stockfishLevel: user.stockfishLevel,
      stockfishDepth: user.stockfishDepth
    });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

app.post('/update_rating', requireAuth, async (req, res) => {
  try {
    const { rating } = req.body;
    await usersCollection.updateOne(
      { username: req.session.username },
      { $set: { rating: parseInt(rating) } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/update_stockfish', requireAuth, async (req, res) => {
  try {
    const { stockfishLevel, stockfishDepth } = req.body;
    await usersCollection.updateOne(
      { username: req.session.username },
      { $set: { 
        stockfishLevel: parseInt(stockfishLevel),
        stockfishDepth: parseInt(stockfishDepth)
      }}
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post('/save_game', requireAuth, async (req, res) => {
  try {
    const { moves, result, rating } = req.body;
    if (!moves || !result || typeof rating === "undefined") {
      return res.status(400).json({ success: false, msg: "Incomplete data" });
    }

    const gamesCollection = db.collection('games');
    await gamesCollection.insertOne({
      username: req.session.username,
      moves,
      result,
      rating,
      timestamp: new Date()
    });
    res.json({ success: true });
  } catch (err) {
    console.error("Error saving game:", err);
    res.status(500).json({ success: false, msg: "Database error" });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ msg: "Error logging out" });
    }
    res.clearCookie('connect.sid');
    res.json({ msg: "Logged out" });
  });
});

// Server setup
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/login.html`);
});
