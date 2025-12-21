# kubic-kode

**kubic-kode** is a modular 2D turn-based tilemap game engine, built for rapid development of grid-based games such as strategy, puzzle, and board games. It provides core abstractions for tilemaps, turn sequencing, and game state management.

The project features a Node.js/Express backend for multiplayer session handling and real-time communication via WebSockets, alongside a React-based frontend demo (e.g., tic-tac-toe) to illustrate integration and usage. kubic-kode is designed for extensibility, enabling developers to prototype and deploy custom turn-based games with minimal setup.

## Key Features

- **Modular Game Engine**: Core abstractions for tilemaps, turn sequencing, and game state management
- **Multiplayer Support**: Real-time communication via WebSockets with spectator functionality
- **Turn-Based Gameplay**: Flexible turn systems (single-set, multi-set, multi-subset)
- **Scrollable TileMap**: Support for large worlds with player-specific viewports and fog-of-war
- **Game Token Authentication**: Secure authentication system for all game operations
- **Extensible Architecture**: Component-based entity system for easy game customization

## Requirements

- [Node.js](https://nodejs.org/) (version 20.x or later recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- Git (for cloning the repository)

## Installation

1. Clone the repository:

   ```sh
   git clone https://github.com/Strange-Kode/kubic-kode.git
   cd kubic-kode
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Copy and configure the environment file for the React demo:

   ```sh
   cp client/demos/react-tic-tac-toe/.env.example client/demos/react-tic-tac-toe/.env
   # Edit client/demos/react-tic-tac-toe/.env as needed
   ```

## Usage

### Start the Backend

Run the backend server (default port: 3000):

```sh
npm run dev-server
```

### Start the Frontend Demo

In a separate terminal, start the React demo (default port: 3001):

```sh
npm run start-frontend
```

The frontend will be available at [http://localhost:3001](http://localhost:3001) and will communicate with the backend at [http://localhost:3000](http://localhost:3000).

## Architecture

### Core Components

- **Game Engine**: Manages turn sequencing, player entities, and tile maps
- **Game Contract**: Contract that all games must implement
- **Game Options**: Lifecycle-based system for managing when options can be modified
- **Session Management**: Handles multiplayer sessions and participant management
- **Game Token Service**: Manages authentication tokens for secure game operations
- **WebSocket Communication**: Real-time game state updates
- **Module System**: Dynamic, extensible module loading system with hot-reloading and lifecycle hooks ([Documentation](./docs/module-system.md))

## Game Development

### Quick Start: Game Script Generator

The fastest way to create a new game is using the built-in game script generator:

```sh
node game-script/setup-game.js
```

This interactive script will:

- Ask essential questions about your game (play style, grid size, multiplayer, etc.)
- Generate all necessary server-side files from templates
- Create the proper folder structure
- Handle conflict resolution for existing files

The generated files include:

- Main game logic file
- Player entity definitions
- API routes
- Environment configuration

### Manual Game Development

To create a new game manually:

1. Implement the required methods from the **Game Contract**
2. Optionally implement additional methods for custom behavior
3. Define game options using the `GameOptions` class
4. Register the game with the `GameRegistry`
5. Create game-specific routes if needed

### Game Contract

The **Game Contract** defines what methods your game implementation must provide:

#### Required Methods (MUST implement)

- `getGameEngine()` - Return the game engine instance
- `playTurn(playerId, x, y, metadata)` - Handle a player's turn
- `addPlayer(name, isComputer)` - Add a player to the game
- `startGame()` - Start the game
- `resetForRestart()` - Reset game state for restart

#### Optional Methods (CAN implement)

- `removePlayer(playerId)` - Remove a player from game
- `getTileMap()` - Return the tile map (default: engine's tile map)
- `getCurrentTurnPlayers()` - Return current turn players (default: engine's players)
- `getWinner()` - Return the winner (default: null)
- `getInactivityTimeout()` - Return inactivity timeout (default: null)
- `isGameActive()` - Check if game is active (default: engine's started state)
- `getGameStats()` - Return game statistics (default: basic stats)
- `stopGame()` - Stop the game (default: engine's stop)
- `handleInactivity()` - Handle player inactivity (default: null)
- `initializeGameOptions()` - Initialize game options
- `calculateComputerMove()` - Calculate AI player moves
- `establishFirstPlayers()` - Determine which player goes first (default: randomized based on play style)

#### Wrapper Methods (provided by KubicKodeGame)

- `getGameOptions()` - Get game options instance
- `getOptionValue(key)` - Get value of a game option
- `resetGameOptions()` - Reset game options
- `applyGameOptions(options)` - Apply game options to the game
- `recordCustomEvent(eventType, playerId, payload)` - Record custom game events
- `setPlayerMappings(mappings)` - Set participant ID to player ID mappings
- `getPlayerMappings()` - Get participant ID to player ID mappings

### Example Game Implementation

```javascript
import { GameEngine } from "kubic-kode";

class MyGame {
  constructor() {
    this.engine = new GameEngine(5, 5, { playStyle: "single-set" });
    this.winner = null;
  }

  // Required methods
  getGameEngine() {
    return this.engine;
  }

  addPlayer(name, isComputer = false) {
    const player = new PlayerEntity(name);
    this.engine.registerPlayerEntity(player);
    return player;
  }

  startGame() {
    this.engine.startGame();
  }

  resetForRestart() {
    this.winner = null;
    this.engine.resetTileMap();
  }

  playTurn(playerId, x, y, metadata = {}) {
    // Your game logic here
    return { status: "ok", player_has_won: false };
  }

  // Optional methods
  getWinner() {
    return this.winner;
  }

  initializeGameOptions() {
    // New lifecycle-based approach
    this.getGameOptions().addOption("gridSize", 5, "frozen");
  }

  establishFirstPlayers() {
    // Optional: Define game-specific first player logic
    // For example, in tic-tac-toe, X always goes first
    const players = this.engine.getPlayerEntities();
    const xPlayer = players.find(player => player.getMarkType() === "X");
    return xPlayer ? xPlayer.getPlayerId() : null;
  }
}
```

Example game options definition:

```javascript
// Lifecycle-based options (recommended)
this.getGameOptions().addOption("gridSize", 3, "frozen");                    // Never changeable
this.getGameOptions().addOption("difficulty", "medium", "pre-start");        // Options: very_easy, easy, medium, hard
this.getGameOptions().addOption("soundEnabled", true, "runtime");            // Changeable anytime
this.getGameOptions().addOption("timeLimit", 30, "between-rounds");          // Only between rounds

// With validation
this.getGameOptions().addOption("maxRounds", 10, "pre-start", (value) => {
  if (value < 1 || value > 100) return "Max rounds must be between 1 and 100";
  return true;
});
```

## Participant System

kubic-kode sessions supports **participants**, enabling multiple users to engage in a game session with distinct roles and capabilities.

### Participant Types

The system supports three participant types:

- **`user`** - Regular human participant (can perform all game actions)
- **`computer`** - AI participant (can perform all game actions)
- **`spectator`** - Observer (can only view games, cannot perform actions)

Each participant's playability is determined by the `isParticipantPlayable()` method:

- Returns `true` for "user" and "computer" types
- Returns `false` for "spectator" type

### Spectator Capabilities

✅ **Spectators can:**

- Join sessions and observe games
- Receive all game broadcasts and updates via WebSocket
- View game state, tile maps, and participant lists
- Access read-only game information

❌ **Spectators cannot:**

- Start or stop games
- Make moves or perform game actions
- Vote on restart requests
- Access protected game routes

### API Usage

#### Join as Spectator

```javascript
// Using KubicKode helper
const result = await KubicKode.spectateSession("Charlie");

// Direct API call
POST /api/session/:sessionId/spectate
{
  "participantName": "Charlie"
}
```

#### Get Participant Statistics

```javascript
// Using KubicKode helper
const stats = await KubicKode.route.session("participant-stats");

// Direct API call
GET /api/session/participants/stats/:sessionId
// Returns: { total: 4, players: 2, spectators: 2, canStart: true }
```

#### Participant Playability Check

```javascript
// Check if a participant can perform game actions
const participant = gameSession.getParticipantById(participantId);
if (gameSession.isParticipantPlayable(participant)) {
  // Participant can start games, make moves, etc.
}

// Direct method call
const isPlayable = gameSession.isParticipantPlayable(participant);
```

#### Participant - Error Handling

```javascript
try {
  // This will fail for spectators
  await KubicKode.startGame();
} catch (error) {
  if (error.message.includes("cannot perform game actions")) {
    console.log("Spectators cannot start games");
  }
}
```

### Documentation

📖 **[Complete Spectator Guide](docs/spectator-functionality.md)** - Detailed documentation with examples, API reference, and best practices

## Lobby System

kubic-kode includes a **Lobby System** that manages active game sessions, allowing participants to discover, join, and monitor available games. The lobby provides real-time updates on session status, participant counts, and game state.

### Key Features

- **Session Discovery**: Browse all active game sessions
- **Real-time Updates**: Live updates when sessions are created, modified, or ended
- **Participant Tracking**: Monitor how many players and spectators are in each session
- **Game State Monitoring**: See which sessions are waiting, active, or finished
- **Session Filtering**: Filter sessions by game type, status, or participant count

### API Endpoints

#### Get All Sessions

```bash
GET /api/lobby/sessions
```

Returns a list of all active sessions:

```json
{
  "sessions": [
    {
      "sessionId": "abc123",
      "gameType": "tic-tac-toe-classic",
      "status": "waiting",
      "participants": {
        "total": 2,
        "players": 1,
        "spectators": 1
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "lastActivity": "2024-01-15T10:35:00Z"
    }
  ]
}
```

#### Get Session Details

```bash
GET /api/lobby/session/:sessionId
```

Returns detailed information about a specific session:

```json
{
  "sessionId": "abc123",
  "gameType": "tic-tac-toe-classic",
  "status": "active",
  "participants": [
    {
      "id": "p1",
      "name": "Alice",
      "type": "user",
      "joinedAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "p2", 
      "name": "Bob",
      "type": "spectator",
      "joinedAt": "2024-01-15T10:32:00Z"
    }
  ],
  "gameState": {
    "started": true,
    "currentTurn": "p1",
    "winner": null
  }
}
```

### Client Integration

```javascript
// Get all sessions
const sessions = await KubicKode.route.lobby("sessions");

// Get specific session details
const sessionDetails = await KubicKode.route.lobby("session", "abc123");

// Join a session from lobby
await KubicKode.joinSession("Alice", "abc123");
```

## WebSocket Broadcasts

kubic-kode uses WebSocket broadcasts to provide real-time updates to connected clients. The system supports both **critical events** (always broadcasted) and **subscription-based events** (only broadcasted to subscribed sessions).

### Critical Events (Always Broadcasted)

These events are automatically broadcasted to all connected clients in a session, regardless of subscription status:

#### Game Events
- `kubic::gameStarted` - Game has started
- `kubic::gameStopped` - Game has stopped
- `kubic::playerWon` - A player has won the game
- `kubic::gameTied` - Game ended in a tie
- `kubic::winCount` - Win counter updated

#### Session Events
- `kubic::sessionParticipantJoined` - New participant joined
- `kubic::sessionSpectatorJoined` - New spectator joined
- `kubic::sessionParticipantLeft` - Participant left
- `kubic::sessionEnded` - Session ended
- `kubic::participantDisconnected` - Participant lost connection
- `kubic::participantReconnected` - Participant reconnected

#### Lobby Events
- `kubic::lobbyConfigUpdated` - Lobby settings changed
- `kubic::lobbyConfigDeleted` - Lobby setting removed
- `kubic::syncPhaseStarted` - Synchronization phase started
- `kubic::participantReadyChanged` - Ready state changed
- `kubic::participantKicked` - Participant was kicked
- `kubic::hostTransferred` - Host privileges transferred
- `kubic::lobbyChatMessage` - Chat message sent

#### Restart Events
- `kubic::restartVoteStarted` - Restart vote initiated
- `kubic::restartVoteUpdate` - Restart vote updated
- `kubic::restartVoteResult` - Restart vote completed

### Subscription-Based Events

These events are only broadcasted to sessions that have explicitly subscribed to them:

#### Game History Events
- `kubic::turnPlayed` - A turn was played
- `kubic::gameStarted` - Game started (also critical)
- `kubic::gameEnded` - Game ended
- `kubic::gameTied` - Game tied (also critical)
- `kubic::playerWon` - Player won (also critical)
- `kubic::participantJoined` - Participant joined
- `kubic::participantLeft` - Participant left
- `kubic::restartVoteStarted` - Restart vote started
- `kubic::restartVoteRegistered` - Restart vote registered
- `kubic::restartVoteCleared` - Restart vote cleared
- `kubic::playerAdded` - Player added to game
- `kubic::gameInstanceStarted` - Game instance started
- `kubic::gameInstanceReset` - Game instance reset
- `kubic::gameStopped` - Game stopped
- `kubic::invalidTurnAttempted` - Invalid turn attempted
- `kubic::playerInactive` - Player became inactive
- `kubic::timeLeft` - Inactivity timer countdown

### Enabling Subscriptions

To receive subscription-based events, sessions must explicitly subscribe to the desired event types:

#### API Subscription

```bash
POST /api/session/:sessionId/subscribe
Content-Type: application/json

{
  "eventTypes": ["kubic::turnPlayed", "kubic::participantJoined", "kubic::invalidTurnAttempted"]
}
```

#### Client Integration

```javascript
// Subscribe to specific event types
await KubicKode.route.session("subscribe", {
  eventTypes: ["kubic::turnPlayed", "kubic::participantJoined"]
});

// Unsubscribe from event types
await KubicKode.route.session("unsubscribe", {
  eventTypes: ["kubic::invalidTurnAttempted"]
});

// Get current subscriptions
const subscriptions = await KubicKode.route.session("subscriptions");
```

### WebSocket Message Format

All WebSocket messages follow this format:

```json
{
  "type": "eventType",
  "payload": {
    // Event-specific data
  },
  "sessionData": {
    "sessionId": "abc123",
    "turnNumber": 5
  }
}
```

### Connection Management

- **Heartbeat**: Clients must send `heartbeat` messages every 30 seconds
- **Reconnection**: Clients can reconnect within 2 minutes to maintain session state
- **Auto-cleanup**: Sessions are automatically cleaned up when no participants remain

## Game Options System

kubic-kode includes a lifecycle-based game options system that controls **when** options can be modified, ensuring game integrity while maintaining flexibility.

### Option Namespaces

The system supports two namespaces for organizing options:

1. **`userspace`** (default): Game-specific options that developers typically configure
   - Standard game settings like difficulty, grid size, win conditions
   - UI preferences like sound settings, visual themes
   - Custom game mechanics options

2. **`systemspace`**: System-level options that require global uniqueness
   - Internal engine settings
   - Advanced configuration that affects multiple systems
   - Options that should not conflict with user-defined options
   - System option names must be unique across ALL namespaces

### Option Lifecycles

1. **`frozen`**: Never changeable (core game rules like game type)
2. **`pre-start`**: Only changeable before game starts (difficulty, grid size, win condition)
3. **`runtime`**: Can be changed anytime during gameplay (sound settings, UI preferences)
4. **`between-rounds`**: Only changeable between rounds/games (time limits, scoring rules)

### Available Game Variants

- **tic-tac-toe-classic**: Standard 3x3 TicTacToe (gridSize and winCondition are frozen)
- **tic-tac-toe-configurable**: Configurable grid size (3-10) and win condition

### API Endpoints

#### Get Game Options

```bash
GET /api/game/options/:sessionId
```

Returns information about available game options:

```json
{
  "available": true,
  "options": {
    "gridSize": 3,
    "winCondition": 3,
    "showHints": false
  },
  "lifecycle": {
    "frozen": {},
    "pre-start": { "gridSize": 3, "winCondition": 3 },
    "runtime": { "showHints": false },
    "between-rounds": {}
  },
  "modifiable": { "gridSize": 3, "winCondition": 3, "showHints": false },
  "game_state": "pre-start",
  "metadata": {
    "gridSize": {
      "lifecycle": "pre-start",
      "defaultValue": 3,
      "locked": false,
      "canModify": true
    }
  }
}
```

#### Start Game with Options

```bash
POST /api/game/start/:sessionId
Content-Type: application/json

{
  "gridSize": 5,
  "winCondition": 4
}
```

### initializeGameOptions Example

Here's how to set up both userspace and systemspace options in your game:

```javascript
initializeGameOptions() {
  // Userspace options (default namespace) - game-specific settings
  this.getGameOptions().addOption("gridSize", 3, "pre-start");
  this.getGameOptions().addOption("difficulty", "medium", "pre-start");
  this.getGameOptions().addOption("soundEnabled", true, "runtime");
  this.getGameOptions().addOption("timeLimit", 30, "between-rounds");

  // Systemspace options - system-level settings with global uniqueness
  this.getGameOptions().addSystemOption("debugMode", false, "runtime", null, "Enable debug logging");
  this.getGameOptions().addSystemOption("maxConcurrentGames", 10, "frozen", null, "System limit for concurrent games");
  this.getGameOptions().addSystemOption("apiVersion", "2.1", "frozen", null, "API version for this game");

  // Access values
  const gridSize = this.getGameOptions().getCurrentValue("gridSize"); // userspace
  const debugMode = this.getGameOptions().getCurrentSystemValue("debugMode"); // systemspace
}
```

### API Usage Examples

1. **Create a session with configurable TicTacToe**:

```bash
POST /api/session/init/tic-tac-toe-configurable
```

2. **Check available options**:

```bash
GET /api/game/options/:sessionId
```

3. **Start game with custom options**:

```bash
POST /api/game/start/:sessionId
{
  "gridSize": 5,
  "winCondition": 4,
  "system::debugMode": true
}
```

4. **Access different namespaces in code**:

```javascript
  // Userspace (default)
  const gameSize = this.getGameOptions().getCurrentValue("gridSize");
   
  // Systemspace (explicit)
  const debugEnabled = this.getGameOptions().getCurrentSystemValue("debugMode");
   
  // Alternative systemspace access
  const debugEnabled2 = this.getGameOptions().getCurrentValue("debugMode", "systemspace");
```

### Game Options - Error Handling

If invalid options are provided, the API returns enhanced error information:

```json
{
  "error": true,
  "message": "Invalid game options",
  "details": [
    "Option 'difficulty' is locked: this option can only be changed before the game starts (current state: started)"
  ],
  "ignored": ["Unknown option 'unknownOption'"],
  "locked": [{
    "key": "difficulty",
    "lifecycle": "pre-start",
    "gameState": "started",
    "reason": "this option can only be changed before the game starts (current state: started)"
  }],
  "game_state": "started"
}
```

This prevents players from changing fundamental game settings (like difficulty) mid-game to gain unfair advantages.

## First Player Management

kubic-kode provides flexible **first player management** through the `establishFirstPlayers()` system, allowing games to control turn order initialization.

### How It Works

The system supports multiple approaches for determining who goes first:

1. **Participant-Specific**: A specific participant can be designated to go first
2. **Game-Specific Logic**: Games can implement custom first player rules (e.g., X always first in tic-tac-toe)
3. **Randomized by Play Style**: Automatic randomization based on the game's play style

### Implementation

Games can implement `establishFirstPlayers()` to define custom first player logic:

```javascript
establishFirstPlayers() {
  // Example: In tic-tac-toe, X always goes first
  const players = this.engine.getPlayerEntities();
  const xPlayer = players.find(player => player.getMarkType() === "X");
  return xPlayer ? xPlayer.getPlayerId() : null;
}
```

### Play Style Randomization

When no specific first player is determined, the system automatically randomizes based on play style:

- **`single-set`**: Randomizes all player order, first player gets the first turn
- **`multi-set`**: All players act simultaneously, randomizes for consistency
- **`multi-subset`**: Randomizes the order of player subsets
- **`non-blocking`**: Returns random player without changing turn order

### API Integration

The `establishFirstPlayers` method is automatically called during game start and returns both the current player and the designated first player:

```json
{
  "current_player_ids": [1],
  "first_player_ids": [1],
  "game_started": true,
  "status": "New game created"
}
```

## Scrollable TileMap

kubic-kode supports **scrollable TileMaps** - a powerful feature that enables large-scale worlds with player-specific viewports. This allows each player to view only a subset of the entire game world, enabling more immersive and performance-friendly large-scale games.

### Key Benefits

- **Large Worlds**: Support for massive tile maps
- **Player Viewports**: Each player has their own view of the world
- **Fog of War**: Players only see tiles within their viewport
- **Auto-Follow**: Viewports can automatically follow player movement
- **Manual Scrolling**: Players can manually scroll their viewport
- **Performance**: Only visible tiles are processed and sent to clients

### Kubic Kode - Quick Start

```javascript
// Create a game engine with scrollable tile map
const gameEngine = new GameEngine(100, 100, {
  useScrollableTileMap: true,
  playStyle: "multi-set"
});

// Create a player with viewport configuration
const player = new ViewportPlayer("player1", "Alice", { x: 10, y: 10 }, {
  width: 15,        // Viewport width in tiles
  height: 10,       // Viewport height in tiles
  autoFollow: true  // Auto-follow player movement
});

// Get only visible tiles for this player
const scrollable = gameEngine.getScrollable();
const visibleTiles = scrollable.getVisibleTilesForPlayer("player1");
```

For detailed documentation, see [docs/scrollable-tilemap.md](docs/scrollable-tilemap.md).

## Game Token Authentication

kubic-kode uses a secure game token authentication system for all game operations. Game tokens are automatically generated when participants join sessions and are required for all game-related API calls.

### How It Works

1. **Token Generation**: Tokens are created when participants join sessions
2. **Token Storage**: Tokens are stored in localStorage mapped to session and participant IDs
3. **Token Validation**: All game operations require valid tokens
4. **Token Cleanup**: Tokens are automatically cleared when participants leave sessions

### API Changes

All game routes use POST requests with game tokens:

```javascript
POST /api/game/get-tilemap/{sessionId}
{
  "gameToken": "participant_game_token"
}
```

### Client Integration

The KubicKode helper automatically manages tokens:

```javascript
// Join session (token automatically stored)
await KubicKode.joinSession("Alice");

// Game operations (token automatically included)
await KubicKode.getTileMap();
await KubicKode.playTurn(0, 0);
```

For native fetch implementations, tokens are stored in localStorage under `kubic_game_tokens`.

## Game State Machine (GSM)

kubic-kode includes an optional **Game State Machine (GSM)** for complex games requiring structured state management. The GSM provides organized state transitions, pause/resume functionality, and event handling for sophisticated game architectures.

### GSM - Quick Start

```javascript
// Simple game (procedural)
const engine = new GameEngine(3, 3);

// Complex game (with GSM)  
const engine = new GameEngine(50, 50, { useStateMachine: true });
```

The setup script (`node game-script/setup-game.js`) will automatically recommend GSM based on your game's complexity.

### When to Use

- **GSM**: Multiple screens/phases, complex transitions, inventory systems, pause/resume
- **Procedural**: Single screen, simple game flow, minimal state management

### Documentation

📖 **[Complete GSM Guide](docs/game-state-machine.md)** - Detailed documentation with examples, API reference, and best practices

## Troubleshooting

### WebSocket Connection Issues

If you're experiencing WebSocket connection problems with the tic-tac-toe demo:

1. **Check Environment Variables**: Ensure `VITE_HOST_IP` and `VITE_HOST_PORT` are correctly set in `client/demos/react-tic-tac-toe/.env`:

```sh
VITE_HOST_IP=localhost
VITE_HOST_PORT=3000
```

2. **Verify Backend is Running**: Make sure the backend server is started with `npm run dev-server` and listening on the correct port.

3. **Check Browser Console**: Look for WebSocket connection errors in the browser's developer console.

4. **Network Configuration**: If running on a different machine or in a container, update `VITE_HOST_IP` to the actual IP address of your backend server.

### Port Conflicts

If you encounter port conflicts:

1. **Backend Port**: Change the backend port by setting the `PORT` environment variable:
```sh
PORT=3001 npm run dev-server
```

2. **Frontend Port**: Change the frontend port by modifying the start script in `package.json` or using Vite's port option.

### Game Session Issues

1. **Session Not Found**: Clear browser localStorage and refresh the page to reset session state.

2. **Participants Not Joining**: Check that the session ID is correct and the session hasn't expired (sessions auto-cleanup after 2 minutes of inactivity).

### Development Environment

1. **Node.js Version**: Ensure you're using Node.js 20.x or later. Check with `node --version`.

2. **Dependencies**: If you encounter module errors, try reinstalling dependencies:
```sh
rm -rf node_modules package-lock.json
npm install
```
