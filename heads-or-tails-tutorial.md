# Building a Turn-Based Heads or Tails Game in Kubic-Kode

This tutorial will guide you through creating a complete turn-based heads or tails game using the kubic-kode framework. We'll build both the backend game logic and a frontend interface using Alpine.js.

## Prerequisites

- Node.js (version 20.x or later)
- npm (comes with Node.js)
- Basic knowledge of JavaScript, Express.js, and HTML

## Project Structure

We'll create the following structure:
```
heads-or-tails-game/
├── game/
│   ├── backend-hot/
│   │   ├── hot.js
│   │   ├── route/
│   │   │   └── hot-routes.js
│   │   └── game-entity/
│   │       ├── player-entity.js
│   │       └── coin-entity.js
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── game.js
├── package.json
└── .env
```

## Step 1: Project Setup

First, create a new directory and initialize the project:

```bash
mkdir heads-or-tails-game
cd heads-or-tails-game
npm init -y
```

Install the required dependencies:

```bash
npm install express kubic-kode dotenv
npm install --save-dev nodemon
```

## Understanding Kubic-Kode Concepts

Before diving into the implementation, let's understand the key concepts of the kubic-kode framework:

### Game Contract

The **GameContract** defines what methods game implementations must provide:

#### **Required Methods** (MUST implement):
- `getGameEngine()` - Return the game engine instance
- `playTurn()` - Handle a player's turn
- `addPlayer()` - Add a new player to the game
- `startGame()` - Start the game
- `resetForRestart()` - Reset game state for restart

#### **Optional Methods** (CAN implement, defaults provided):
- `getTileMap()` - Return the game board
- `getCurrentTurnPlayers()` - Get players whose turn it is
- `getWinner()` - Get the current winner
- `getInactivityTimeout()` - Get inactivity timeout duration
- `isGameActive()` - Check if game is active
- `getGameStats()` - Get game statistics
- `stopGame()` - Stop the game
- `handleInactivity()` - Handle inactive players
- `initializeGameOptions()` - Set up game options
- `calculateComputerMove()` - Calculate AI moves

#### **Wrapper Methods** (Always provided by KubicKodeGame):
- `getGameOptions()` - Access game options
- `getOptionValue()` - Get current option values
- `resetGameOptions()` - Reset options to defaults
- `applyGameOptions()` - Apply option changes
- `recordCustomEvent()` - Record custom events

### Game Options System

The **GameOptions** system provides a centralized way to manage configurable game settings:

```javascript
// In initializeGameOptions()
this.getGameOptions().addConfigurable('maxRounds', 10, (value) => {
  if (value < 1 || value > 50) return 'Max rounds must be 1-50';
  return true;
});

// Access values anywhere in your game
const maxRounds = this.getOptionValue('maxRounds');
```

**Key Features:**
- **Validation**: Options are validated when applied
- **Applied Values**: Tracks currently applied values
- **Frozen vs Configurable**: Some options can be locked after game starts
- **No Boilerplate**: Games don't need to implement option handling manually

### Game Entities
A **Game Entity** is a fundamental object in kubic-kode that represents any game object (players, pieces, etc.). Entities have:
- **ID**: Unique identifier
- **Name**: Human-readable name
- **Position**: Location on the game board (x, y coordinates)
- **Custom properties**: Game-specific data (like score, player type, etc.)

In our heads or tails game, we create two types of entities:
- **PlayerEntity**: Represents each player with their score, guess history, and player type
- **CoinEntity**: Represents the coin that gets flipped

### Game Engine
The **GameEngine** is the core component that manages:
- **Turn sequencing**: Who plays when
- **Player management**: Adding/removing players
- **Game state**: Whether the game is active, started, or stopped
- **Tile map**: The game board (even if we don't use it visually)

### KubicKodeGame Wrapper
**KubicKodeGame** is a proxy class that wraps your game implementation and provides:
- **History recording**: Automatically logs all game events
- **Method delegation**: Forwards calls to your actual game instance
- **Session integration**: Connects your game to the session management system
- **Game options management**: Handles option validation and application
- **No boilerplate**: Automatically handles common operations like tile map resizing

### Session Management
**GameSession** handles multiplayer functionality:
- **Participant tracking**: Who's in the game
- **Session state**: Whether the game has started
- **Game instance**: The actual game logic
- **WebSocket integration**: Real-time communication

### Core Routes
kubic-kode provides two main route systems:
- **sessionRoutes**: Handle session creation, joining, and management
- **gameRoutes**: Handle game lifecycle (start, restart, get stats, etc.)

### WebSocket Communication
**WebSockets** provide real-time bidirectional communication:
- **Server to Client**: Game state updates, turn notifications, player actions
- **Client to Server**: Player moves, game actions
- **Automatic reconnection**: Handles connection drops gracefully
- **Session-based**: Messages are scoped to specific game sessions

### Game Registry
The **GameRegistry** is a factory system that:
- **Registers game types**: Associates game IDs with factory functions
- **Creates game instances**: Spawns new games when sessions are created
- **Enables extensibility**: Allows multiple game types in one server

## Step 2: Create the Backend Game Logic

### Step 2.1: Create the Player Entity

The PlayerEntity extends the base GameEntity class from kubic-kode. This entity represents a player in our game and stores their game-specific data like score and guess history.

Create `game/backend-hot/game-entity/player-entity.js`:

```javascript
import { GameEntity } from "kubic-kode";

class PlayerEntity extends GameEntity {
  constructor(name) {
    // Generate a simple ID using a static counter
    // In a real application, you might use UUIDs or database IDs
    const playerId = PlayerEntity.nextId++;
    
    // Call the parent constructor with id, name, and position
    // Position is null since we don't use a visual grid in this game
    super(playerId, name, null);
    
    // Custom properties for our heads or tails game
    this.score = 0; // Track correct guesses
    this.guesses = []; // Array of { round: number, guess: 'heads'|'tails', correct: boolean }
  }

  // Static counter for generating unique player IDs
  static nextId = 1;

  addGuess(round, guess, correct) {
    this.guesses.push({ round, guess, correct });
    if (correct) {
      this.score++;
    }
  }

  clearGuesses() {
    this.guesses = [];
    this.score = 0;
  }

  toJSON() {
    // This method is called when the entity is serialized to JSON
    // It's used when sending data to the browser client via API responses
    // Only include properties that should be visible to the client
    return {
      id: this.id,
      name: this.name,
      score: this.score,
      guesses: this.guesses,
    };
  }
}

export default PlayerEntity;
```

### Step 2.2: Create the Coin Entity

The CoinEntity represents the coin that gets flipped in our game. Unlike PlayerEntity, this doesn't extend GameEntity because it's not a player - it's a game object that manages the coin flip logic.

Create `game/backend-hot/game-entity/coin-entity.js`:

```javascript
export class CoinEntity {
  constructor() {
    this.sides = ['heads', 'tails'];
    this.currentSide = null; // Tracks the result of the last flip
  }

  flip() {
    // Randomly select heads or tails
    this.currentSide = this.sides[Math.floor(Math.random() * this.sides.length)];
    return this.currentSide;
  }

  getCurrentSide() {
    return this.currentSide;
  }

  reset() {
    this.currentSide = null;
  }

  toJSON() {
    return {
      currentSide: this.currentSide,
    };
  }
}
```

### Step 2.3: Create the Main Game Logic

This is the core game class that implements the GameInterface contract. It manages the entire game flow, from player management to turn handling and win conditions.

Create `game/backend-hot/hot.js`:

```javascript
import { GameEngine } from "kubic-kode";
import PlayerEntity from "./game-entity/player-entity.js";
import { CoinEntity } from "./game-entity/coin-entity.js";
import hotRouter from "./route/hot-routes.js";

// HeadsOrTailsGame is implemented according to the GameContract.
// This means it can override methods to customize behavior
// Some methods are required (like getGameEngine and playTurn)
// Others are optional and provide default behavior if not implemented
class HeadsOrTailsGame {
  constructor({ maxRounds = 10 } = {}) {
    // Create the game engine with a 1x1 grid
    // We use a minimal grid since we don't need visual positioning
    const turnConfig = { playStyle: "single-set" }; // One player per turn
    this.engine = new GameEngine(1, 1, turnConfig);

    // Game-specific properties
    this.maxRounds = maxRounds;
    this.currentRound = 0;
    this.winner = null;
    this.coin = new CoinEntity(); // Our coin for flipping
    this.gameHistory = []; // Track all game events
  }

  // Required methods that MUST be implemented
  getGameEngine() {
    return this.engine;
  }

  addPlayer(name) {
    // Create a new player entity with a unique ID
    const player = new PlayerEntity(name);
    
    // Register the player with the game engine
    // This enables turn management and other engine features
    this.engine.registerPlayerEntity(player);
    return player;
  }

  startGame() {
    // Reset restart-specific state before starting
    this.resetForRestart();

    this.engine.resetTileMap();
    this.engine.startGame();
    this.currentRound = 1;
  }

  resetForRestart() {
    // Reset game state
    this.currentRound = 0;
    this.winner = null;
    this.coin.reset();
    this.gameHistory = [];

    // Reset player ID counter for new games
    PlayerEntity.nextId = 1;

    // Clear player histories
    this.engine.getPlayerEntities().forEach((player) => {
      if (typeof player.clearGuesses === "function") {
        player.clearGuesses();
      }
    });
  }

  playTurn(playerId, guess, metadata = {}) {
    // Get the current player from the engine
    const currentPlayer = this.engine.getCurrentTurnPlayers()[0];
    
    console.log(`[HeadsOrTailsGame] playTurn called - playerId: ${playerId}, guess: ${guess}`);
    console.log(`[HeadsOrTailsGame] Current player:`, currentPlayer);

    // Validate the guess - must be either 'heads' or 'tails'
    if (guess !== 'heads' && guess !== 'tails') {
      return {
        status: "invalid",
        type: "invalid_guess",
        player_has_won: false,
        player_id: currentPlayer.getPlayerId(),
      };
    }

    // Flip the coin and check if the guess was correct
    const coinResult = this.coin.flip();
    const isCorrect = guess === coinResult;

    // Record the player's guess
    currentPlayer.addGuess(this.currentRound, guess, isCorrect);

    // Record game history
    this.gameHistory.push({
      round: this.currentRound,
      playerId: currentPlayer.getPlayerId(),
      playerName: currentPlayer.getPlayerName(),
      guess: guess,
      coinResult: coinResult,
      isCorrect: isCorrect
    });

    // Check if game is over (all rounds completed)
    if (this.currentRound >= this.maxRounds) {
      this.endGame();
      return {
        status: "ok",
        player_has_won: false,
        player_id: currentPlayer.getPlayerId(),
        round: this.currentRound,
        guess: guess,
        coinResult: coinResult,
        isCorrect: isCorrect,
        game_ended: true,
        winner: this.winner
      };
    }

    // Move to next round
    this.currentRound++;
    this.engine.nextTurn();

    return {
      status: "ok",
      player_has_won: false,
      player_id: currentPlayer.getPlayerId(),
      round: this.currentRound - 1,
      guess: guess,
      coinResult: coinResult,
      isCorrect: isCorrect
    };
  }

  // Optional methods that provide custom behavior
  getTileMap() {
    return this.engine.getTileMap();
  }

  getCurrentTurnPlayers() {
    return this.engine.getCurrentTurnPlayers();
  }

  getGameStats() {
    const players = this.engine.getPlayerEntities();
    return {
      maxRounds: this.maxRounds,
      currentRound: this.currentRound,
      winner: this.winner,
      isActive: this.isGameActive(),
      playerCount: players.length,
      players: players.map(p => ({
        id: p.getPlayerId(),
        name: p.getPlayerName(),
        score: p.score
      }))
    };
  }

  getWinner() {
    return this.winner;
  }

  isGameActive() {
    return this.engine.isGameStarted() && !this.engine.isGameStopped();
  }

  // Optional: Handle inactive players
  // These methods are only needed if you want to handle player inactivity
  getInactivityTimeout() {
    return 30_000; // 30 seconds
  }

  handleInactivity() {
    const players = this.engine.getPlayerEntities();
    const currentPlayerId = this.engine.getCurrentPlayer().getPlayerId();

    const winner = players.find(
      (player) => player.getPlayerId() !== currentPlayerId
    );
    this.winner = winner || null;
    return {
      inactivePlayerId: currentPlayerId,
      winnerPlayerId: this.winner?.getPlayerId(),
    };
  }

  getGameHistory() {
    return this.gameHistory;
  }

  // Game Options Pattern (Optional)
  // This allows the game to be configurable via the game options system
  initializeGameOptions() {
    // Register configurable options
    this.getGameOptions().addConfigurable('maxRounds', 10, (value) => {
      if (value < 1 || value > 50) return 'Max rounds must be 1-50';
      return true;
    });

    // Register frozen options (cannot be changed after game starts)
    this.getGameOptions().addFrozen('gameType', 'heads-or-tails');
  }

  // Custom option handling (optional)
  // This is only needed for custom logic that can't be automated
  applyGameOptions(options) {
    // Handle custom option logic
    if (options.maxRounds) {
      this.maxRounds = options.maxRounds;
    }
  }
}

export { HeadsOrTailsGame, hotRouter };
```

### Step 2.4: Create the Game Routes

The routes handle HTTP requests for our game-specific actions. These are separate from the core kubic-kode routes and provide custom endpoints for our heads or tails game.

Create `game/backend-hot/route/hot-routes.js`:

```javascript
import express from "express";
import { sessionManager } from "kubic-kode";
import { GameEventService } from "kubic-kode";

const hotRouter = express.Router();

// Play a turn (make a guess)
hotRouter.post("/hot/play-turn/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { guess } = req.body;

  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();
  
  // Get the current player from the game engine
  const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();

  let roundStatus = gameInstance.playTurn(currentPlayer.getPlayerId(), guess);
  
  res.json(roundStatus);

  // Broadcast the event after sending the response
  try {
    GameEventService.broadcastToSession(gameSession, {
      type: "turnPlayed",
      payload: roundStatus,
    });
  } catch (error) {
    console.error("Error broadcasting turn event:", error);
  }
});

// Get game history
hotRouter.get("/hot/history/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();
  
  const history = gameInstance.getGameHistory();
  res.json(history);
});

export default hotRouter;
```

## Step 3: Create the Main Server File

This is the main entry point that sets up the Express server, registers our game with kubic-kode, and connects all the components together.

Create `game.js`:

```javascript
import express from 'express';
import path from 'path';

// Import the core kubic-kode components
import { sessionRoutes, gameRoutes } from "kubic-kode";
import { gameEventService } from "kubic-kode";
import { gameRegistry } from "kubic-kode";

import { fileURLToPath } from "url";
import 'dotenv/config';

import {
  HeadsOrTailsGame,
  hotRouter,
} from "./game/backend-hot/hot.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// Add game routes
app.use('/api', sessionRoutes);
app.use('/api', gameRoutes);

// Factory function that creates new game instances
// This is required by the game registry system
function HeadsOrTailsFactory(sessionId, options = {}) {
  return new HeadsOrTailsGame({ sessionId, maxRounds: 10, ...options });
}

// Register our custom routes with the Express app
const gameRouters = [{ path: "/api/hot", router: hotRouter }];

// Dynamically register game specific routers
gameRouters.forEach(({ path, router }) => {
  app.use(path, router);
});

// Register our game with the kubic-kode registry
// This allows the framework to create our game when sessions are created
gameRegistry.register("hot", HeadsOrTailsFactory);

const server = app.listen(PORT, () => {
  console.log(`Heads or Tails game running at http://localhost:${PORT}`);
});

gameEventService.GameEventService.initWebSocketServer(server);
```

## Step 4: Create the Frontend

The frontend uses Alpine.js for reactive state management and provides a modern, responsive interface for the game. Alpine.js is a lightweight alternative to Vue.js that works directly in HTML.

**Note**: The client can be implemented in any framework (React, Vue, Angular, etc.) or even vanilla JavaScript. Alpine.js is used here for simplicity and ease of implementation, but you're free to choose your preferred frontend technology.

### Step 4.1: Create the HTML File

Create `public/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Heads or Tails Game</title>
    <link rel="stylesheet" href="style.css">
    <script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>
</head>
<body>
    <div x-data="headsOrTailsGame()" class="container">
        <!-- Loading Screen -->
        <div x-show="gamePhase === 'loading'" class="loading-screen">
            <h2>Initializing game...</h2>
        </div>

        <!-- Name Entry Modal -->
        <div x-show="showNameModal" class="modal-overlay">
            <div class="modal">
                <h2>Join the Game</h2>
                <p>Enter your name to join the Heads or Tails game:</p>
                <input 
                    x-model="playerName" 
                    @keyup.enter="handleNameSubmit()"
                    placeholder="Your name"
                    class="name-input"
                >
                <button @click="handleNameSubmit()" class="btn btn-primary">Join Game</button>
            </div>
        </div>

        <!-- Game Interface -->
        <div x-show="gamePhase === 'playing'" class="game-interface">
            <header class="game-header">
                <h1>Heads or Tails</h1>
                <div class="game-info">
                    <p>Round: <span x-text="currentRound"></span> / <span x-text="maxRounds"></span></p>
                    <p x-show="winner">Winner: <span x-text="winner?.name || 'Tie!'"></span></p>
                </div>
            </header>

            <!-- Player Status -->
            <div class="player-status">
                <div class="player" :class="{ 'current-turn': isMyTurn }">
                    <h3 x-text="currentPlayer?.name || 'Waiting...'"></h3>
                    <p>Score: <span x-text="currentPlayer?.score || 0"></span></p>
                    <p>Type: <span x-text="currentPlayer?.playerType || ''"></span></p>
                </div>
                <div class="player">
                    <h3 x-text="opponent?.name || 'Waiting...'"></h3>
                    <p>Score: <span x-text="opponent?.score || 0"></span></p>
                    <p>Type: <span x-text="opponent?.playerType || ''"></span></p>
                </div>
            </div>

            <!-- Game Board -->
            <div class="game-board" x-show="gameActive">
                <div class="coin-area">
                    <div class="coin" :class="{ 'flipping': isFlipping }">
                        <div class="coin-side heads">H</div>
                        <div class="coin-side tails">T</div>
                    </div>
                </div>
                
                <div class="guess-buttons" x-show="isMyTurn">
                    <button @click="makeGuess('heads')" class="btn btn-heads">Heads</button>
                    <button @click="makeGuess('tails')" class="btn btn-tails">Tails</button>
                </div>

                <div class="turn-indicator" x-show="!isMyTurn">
                    <p>Waiting for <span x-text="currentPlayer?.name"></span> to make a guess...</p>
                </div>
            </div>

            <!-- Game History -->
            <div class="game-history">
                <h3>Game History</h3>
                <div class="history-list">
                    <template x-for="(entry, index) in gameHistory" :key="index">
                        <div class="history-entry" :class="{ 'correct': entry.isCorrect, 'incorrect': !entry.isCorrect }">
                            <span x-text="`Round ${entry.round}: ${entry.playerName} guessed ${entry.guess}`"></span>
                            <span x-text="`(Coin: ${entry.coinResult})`"></span>
                            <span x-text="entry.isCorrect ? '✓' : '✗'"></span>
                        </div>
                    </template>
                </div>
            </div>

            <!-- Game Over Modal -->
            <div x-show="showGameOverModal" class="modal-overlay">
                <div class="modal">
                    <h2>Game Over!</h2>
                    <p x-show="winner">Winner: <span x-text="winner.name"></span></p>
                    <p x-show="!winner">It's a tie!</p>
                    <button @click="restartGame()" class="btn btn-primary">Play Again</button>
                </div>
            </div>
        </div>
    </div>

    <script src="app.js"></script>
</body>
</html>
```

### Step 4.2: Create the CSS File

Create `public/style.css`:

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}

.loading-screen {
    text-align: center;
    padding: 50px;
    color: white;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal {
    background: white;
    padding: 30px;
    border-radius: 10px;
    text-align: center;
    max-width: 400px;
    width: 90%;
}

.name-input {
    width: 100%;
    padding: 10px;
    margin: 20px 0;
    border: 2px solid #ddd;
    border-radius: 5px;
    font-size: 16px;
}

.game-interface {
    background: white;
    border-radius: 15px;
    padding: 30px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.game-header {
    text-align: center;
    margin-bottom: 30px;
}

.game-header h1 {
    color: #667eea;
    margin-bottom: 10px;
}

.game-info {
    display: flex;
    justify-content: space-around;
    margin-top: 15px;
}

.player-status {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-bottom: 30px;
}

.player {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    border: 2px solid transparent;
    transition: all 0.3s ease;
}

.player.current-turn {
    border-color: #667eea;
    background: #e3f2fd;
    transform: scale(1.05);
}

.player h3 {
    color: #667eea;
    margin-bottom: 10px;
}

.game-board {
    text-align: center;
    margin-bottom: 30px;
}

.coin-area {
    margin-bottom: 30px;
}

.coin {
    width: 120px;
    height: 120px;
    margin: 0 auto;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.6s ease;
}

.coin.flipping {
    animation: flip 1s ease-in-out;
}

.coin-side {
    position: absolute;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: bold;
    color: white;
    backface-visibility: hidden;
}

.coin-side.heads {
    background: linear-gradient(45deg, #ff6b6b, #ee5a24);
    transform: rotateY(0deg);
}

.coin-side.tails {
    background: linear-gradient(45deg, #4834d4, #686de0);
    transform: rotateY(180deg);
}

@keyframes flip {
    0% { transform: rotateY(0deg); }
    50% { transform: rotateY(180deg); }
    100% { transform: rotateY(360deg); }
}

.guess-buttons {
    display: flex;
    gap: 20px;
    justify-content: center;
    margin-bottom: 20px;
}

.btn {
    padding: 12px 24px;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
}

.btn-primary {
    background: #667eea;
    color: white;
}

.btn-primary:hover {
    background: #5a6fd8;
    transform: translateY(-2px);
}

.btn-heads {
    background: #ff6b6b;
    color: white;
}

.btn-heads:hover {
    background: #ee5a24;
    transform: translateY(-2px);
}

.btn-tails {
    background: #4834d4;
    color: white;
}

.btn-tails:hover {
    background: #686de0;
    transform: translateY(-2px);
}

.turn-indicator {
    background: #e3f2fd;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
}

.game-history {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 10px;
}

.game-history h3 {
    margin-bottom: 15px;
    color: #667eea;
}

.history-list {
    max-height: 200px;
    overflow-y: auto;
}

.history-entry {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    margin-bottom: 5px;
    background: white;
    border-radius: 5px;
    border-left: 4px solid #ddd;
}

.history-entry.correct {
    border-left-color: #4caf50;
    background: #e8f5e8;
}

.history-entry.incorrect {
    border-left-color: #f44336;
    background: #ffebee;
}

@media (max-width: 600px) {
    .container {
        padding: 10px;
    }
    
    .game-interface {
        padding: 20px;
    }
    
    .player-status {
        grid-template-columns: 1fr;
    }
    
    .guess-buttons {
        flex-direction: column;
        align-items: center;
    }
    
    .btn {
        width: 200px;
    }
}
```

### Step 4.3: Create the Alpine.js Application

Alpine.js uses a simple function that returns an object with reactive data and methods. This function is called when the component initializes and provides all the game logic for the frontend.

Create `public/app.js`:

```javascript
function headsOrTailsGame() {
    return {
        // Game state - Alpine.js will make these reactive
        gamePhase: 'loading', // 'loading', 'playing', 'error'
        showNameModal: true,
        showGameOverModal: false,
        playerName: '',
        sessionId: null,
        participantId: null,
        
        // Game data
        currentPlayer: null,
        opponent: null,
        isMyTurn: false,
        gameActive: false,
        currentRound: 1,
        maxRounds: 10,
        winner: null,
        gameHistory: [],
        isFlipping: false,
        
        // WebSocket connection
        ws: null,
        
        // Alpine.js lifecycle method - called when component initializes
        init() {
            this.initializeWebSocket();
            this.checkSession();
        },
        
        async checkSession() {
            try {
                const response = await fetch('/api/session/check');
                const data = await response.json();
                
                if (data.available) {
                    this.sessionId = data.sessionId;
                    this.gamePhase = 'playing';
                    this.showNameModal = true;
                } else {
                    // Create a new session
                    await this.createSession();
                }
            } catch (error) {
                console.error('Error checking session:', error);
                this.gamePhase = 'error';
            }
        },
        
        async createSession() {
            try {
                const response = await fetch('/api/session/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        gameVariantId: 'hot',
                        maxParticipants: 2
                    })
                });
                
                const data = await response.json();
                this.sessionId = data.sessionId;
                this.gamePhase = 'playing';
                this.showNameModal = true;
            } catch (error) {
                console.error('Error creating session:', error);
                this.gamePhase = 'error';
            }
        },
        
        async handleNameSubmit() {
            if (!this.playerName.trim()) {
                alert('Please enter your name');
                return;
            }
            
            try {
                const response = await fetch(`/api/session/join/${this.sessionId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: this.playerName
                    })
                });
                
                const data = await response.json();
                this.participantId = data.participantId;
                this.showNameModal = false;
                
                // Start the game if we're the second player
                if (data.participants.length === 2) {
                    await this.startGame();
                }
                
                this.fetchGameState();
            } catch (error) {
                console.error('Error joining session:', error);
                alert('Failed to join the game');
            }
        },
        
        async startGame() {
            try {
                const response = await fetch(`/api/game/start/${this.sessionId}`);
                const data = await response.json();
                
                if (data.game_started) {
                    this.gameActive = true;
                    this.fetchGameState();
                }
            } catch (error) {
                console.error('Error starting game:', error);
            }
        },
        
        async fetchGameState() {
            try {
                const response = await fetch(`/api/game/get-stats/${this.sessionId}`);
                const data = await response.json();
                
                if (data.success) {
                    this.updateGameState(data.data);
                }
            } catch (error) {
                console.error('Error fetching game state:', error);
            }
        },
        
        updateGameState(gameStats) {
            const players = gameStats.players || [];
            const currentPlayerId = gameStats.current_player_id;
            
            // Find current player and opponent
            this.currentPlayer = players.find(p => p.id === currentPlayerId);
            this.opponent = players.find(p => p.id !== currentPlayerId);
            
            // Check if it's our turn
            this.isMyTurn = this.currentPlayer && 
                           this.participantId && 
                           this.currentPlayer.id === this.participantId;
            
            this.currentRound = gameStats.currentRound || 1;
            this.maxRounds = gameStats.maxRounds || 10;
            this.gameActive = gameStats.isActive;
            this.winner = gameStats.winner;
            
            // Fetch game history
            this.fetchGameHistory();
        },
        
        async fetchGameHistory() {
            try {
                const response = await fetch(`/api/hot/history/${this.sessionId}`);
                const history = await response.json();
                this.gameHistory = history;
            } catch (error) {
                console.error('Error fetching game history:', error);
            }
        },
        
        async makeGuess(guess) {
            if (!this.isMyTurn || !this.gameActive) {
                return;
            }
            
            try {
                this.isFlipping = true;
                
                const response = await fetch(`/api/hot/play-turn/${this.sessionId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ guess })
                });
                
                const result = await response.json();
                
                // Wait for coin flip animation
                setTimeout(() => {
                    this.isFlipping = false;
                    
                    if (result.game_ended) {
                        this.showGameOverModal = true;
                        this.gameActive = false;
                    }
                    
                    this.fetchGameState();
                }, 1000);
                
            } catch (error) {
                console.error('Error making guess:', error);
                this.isFlipping = false;
            }
        },
        
        async restartGame() {
            try {
                const response = await fetch(`/api/game/restart/${this.sessionId}`);
                const data = await response.json();
                
                if (data.success) {
                    this.showGameOverModal = false;
                    this.gameActive = true;
                    this.winner = null;
                    this.gameHistory = [];
                    this.fetchGameState();
                }
            } catch (error) {
                console.error('Error restarting game:', error);
            }
        },
        
        initializeWebSocket() {
            // Determine WebSocket protocol based on current page protocol
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            // Create WebSocket connection for real-time updates
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                if (this.sessionId) {
                    this.ws.send(JSON.stringify({
                        type: 'join',
                        sessionId: this.sessionId,
                        participantId: this.participantId
                    }));
                }
            };
            
            this.ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'turnPlayed':
                        this.fetchGameState();
                        break;
                    case 'gameStarted':
                        this.gameActive = true;
                        this.fetchGameState();
                        break;
                    case 'playerJoined':
                        if (data.payload.participants.length === 2) {
                            this.startGame();
                        }
                        break;
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                // Attempt to reconnect after a delay
                setTimeout(() => {
                    this.initializeWebSocket();
                }, 3000);
            };
        }
    };
}
```

## Step 5: Environment Configuration

Create `.env`:

```env
PORT=3000
NODE_ENV=development
```

## Step 6: Update Package.json Scripts

Update your `package.json` to include the development script:

```json
{
  "scripts": {
    "start": "node game.js",
    "dev": "nodemon game.js"
  }
}
```

## Step 7: Running the Game

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. Enter your name to join the game

4. Wait for a second player to join, or open another browser tab to simulate a second player

5. Take turns guessing heads or tails!

## How the Game Works

1. **Game Setup**: Two players join the session
2. **Turn-based Play**: Players take turns guessing whether the coin will land on heads or tails
3. **Scoring**: Players earn points for correct guesses
4. **Game End**: After 10 rounds, the player with the most points wins
5. **Real-time Updates**: WebSocket connections provide real-time game state updates



## Key Features Implemented

- ✅ Turn-based gameplay using kubic-kode framework
- ✅ Real-time WebSocket communication
- ✅ Session management for multiplayer
- ✅ Game state persistence and history
- ✅ Responsive UI with Alpine.js
- ✅ Coin flip animation
- ✅ Score tracking
- ✅ Game restart functionality
- ✅ Game options system integration
- ✅ No-boilerplate design pattern

## Extending the Game

You can easily extend this game by:

1. **Adding more rounds**: Modify the `maxRounds` parameter via game options
2. **Custom coin designs**: Update the CSS for different coin appearances
3. **Sound effects**: Add audio for coin flips and wins
4. **Statistics**: Track win/loss ratios and streaks
5. **Tournament mode**: Create brackets for multiple players
6. **Custom game options**: Add new configurable settings like difficulty levels

## Best Practices

1. **Use Game Options**: Always use the game options system for configurable settings
2. **Access via getOptionValue()**: Use `this.getOptionValue('optionName')` to access current values
3. **No Instance Properties**: Don't store option values as instance properties
4. **Implement Required Methods**: Always implement the required contract methods
5. **Leverage Defaults**: Don't implement optional methods unless you need custom behavior
6. **Use Wrapper Methods**: Take advantage of the wrapper methods provided by KubicKodeGame

This tutorial demonstrates how to build a complete turn-based game using the kubic-kode framework, from backend game logic to frontend user interface. The modular architecture and no-boilerplate design make it easy to extend and modify the game as needed. 