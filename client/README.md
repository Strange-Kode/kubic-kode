# KubicKode Helper - Rock Paper Scissors Examples

This directory contains examples of how to use the `KubicKodeHelper` with Alpine.js to create a Rock-Paper-Scissors game.

## Files

- `kubic-kode-helper.js` - The main helper library
- `rps-example.html` - Complete working example with Alpine.js
- `rps-usage-example.js` - JavaScript usage examples and patterns
- `README.md` - This file

## Quick Start

### 1. Complete Working Example

`rps-example.html` demonstrates a fully functional Rock-Paper-Scissors game. It contains:

- Session management
- Real-time WebSocket communication
- Game state management
- Turn-based gameplay
- Score tracking
- Game history

### 2. Basic Usage Patterns

The `rps-usage-example.js` file contains modular examples showing different aspects of the KubicKodeHelper:

```javascript
import { KubicKode } from "./kubic-kode-helper.js";

// Basic setup
await basicSetup();

// Session management
await sessionManagement();

// Game flow
await gameFlow();

// Making moves
await makeGameMoves();
```

## Key Features Demonstrated

### 1. Configuration and Setup

```javascript
// Configure the helper
KubicKode.configure({
    apiPrefix: "http://localhost:3000/api",
    autoReconnect: true,
    retryAttempts: 3,
    retryDelay: 1000
});

// Register game type
KubicKode.game.register("rock-paper-scissors");

// Connect WebSocket
KubicKode.connectWebSocket();
```

### 2. Session Management

```javascript
// Initialize session
const initResponse = await KubicKode.initSession("rock-paper-scissors");

// Join session
const joinResponse = await KubicKode.joinSession("Alice", "human");

// Get participants
const participants = await KubicKode.route.session("participants");
```

### 3. Game Flow

```javascript
// Start game with options
const startResponse = await KubicKode.startGame({
    playStyle: "competitive",
    maxRounds: 5,
    timeLimit: 30
});

// Check game status
const isActive = await KubicKode.route.game("is-active");
const currentPlayer = await KubicKode.route.game("get-current-player");
```

### 4. Making Moves

```javascript
// Using dynamic game method
const moveResponse = await KubicKode.rock_paper_scissors.playTurn(0, 0, {
    choice: "rock",
    playerName: "Alice"
});

// Using generic method
const genericMove = await KubicKode.playTurn(0, 0, {
    choice: "paper",
    playerName: "Alice"
});
```

### 5. Event Handling

```javascript
// WebSocket events
KubicKode.events
    .on("websocketConnected", (data) => {
        console.log("Connected to server");
    })
    .on("websocketDisconnected", (data) => {
        console.log("Disconnected from server");
    });

// Game events
KubicKode.events
    .on("kubic::gameStarted", (data) => {
      console.log("Game started:", data);
    })
    .on("kubic::turnPlayed", (data) => {
      console.log("Turn played:", data);
    })
    .on("kubic::gameEnded", (data) => {
      console.log("Game ended:", data);
    });
```

## Alpine.js Integration

The `createAlpineComponent()` function provides a ready-to-use Alpine.js component:

```html
<div x-data="createAlpineComponent()" x-init="init()">
    <!-- Your game UI here -->
    <button @click="joinGame()">Join Game</button>
    <button @click="startGame()">Start Game</button>
    <button @click="makeChoice("rock")">Rock</button>
</div>
```

## API Reference

### Core Methods

- `KubicKode.configure(options)` - Configure the helper
- `KubicKode.game.register(gameId)` - Register a game type
- `KubicKode.connectWebSocket()` - Connect to WebSocket server
- `KubicKode.initSession(gameId)` - Initialize a new session
- `KubicKode.joinSession(name, type)` - Join a session
- `KubicKode.startGame(options)` - Start a game
- `KubicKode.playTurn(x, y, data)` - Make a move

### Route Methods

- `KubicKode.route.session(action, data)` - Session operations
- `KubicKode.route.game(action, data)` - Game operations

### Event System

- `KubicKode.events.on(event, callback)` - Listen for events
- `KubicKode.events.off(event, callback)` - Remove event listener
- `KubicKode.events.emit(event, data)` - Emit custom events

### State Management

- `KubicKode.getState()` - Get current state
- `KubicKode.game.use(gameId)` - Set current game context

## Error Handling

The helper includes built-in retry logic and error handling:

```javascript
try {
    const response = await KubicKode.initSession("rock-paper-scissors");
    console.log("Success:", response.data);
} catch (error) {
    console.error("Error:", error.message);
}
```

## WebSocket Events

The helper automatically handles WebSocket connections and provides these events:

- `kubic::websocketConnected` - Connection established
- `kubic::websocketDisconnected` - Connection lost
- `kubic::websocketError` - Connection error
- `kubic::sessionInitialized` - Session created
- `kubic::gameStarted` - Game started
- `kubic::turnPlayed` - Turn completed
- `kubic::gameEnded` - Game finished
- `kubic::playerJoined` - Player joined session
- `kubic::playerLeft` - Player left session

Built in broadcasts are prefixed with the kubic:: namespace.
kubic:: namespaces cannot be redefined. Custom broadcasts cannot belong to
the kubic:: namespace.
Instead, custom broadcasts can be defined/redefined in the game server
Broadcast names do not have to be prefixed with :: but it is recommended.

For example:

```javascript
// In your game server file
import { GameEventService } from "kubic-kode";

// Register your custom events at startup
GameEventService.registerBroadcast("myGame::cardDrawn");
GameEventService.registerBroadcast("myGame::specialPowerActivated");
GameEventService.registerBroadcast("myGame::playerLevelUp");

// Later in your game logic...
function drawCard(gameSession, playerId, card) {
  // Your game logic here...
  
  // Broadcast the custom event
  GameEventService.broadcastToSession(gameSession, {
    type: "myGame::cardDrawn",
    payload: {
      playerId: playerId,
      card: {
        id: card.id,
        name: card.name,
        type: card.type
      },
      remainingCards: deck.length
    }
  });
}
```

## Customization

You can easily customize the examples by:

- Changing the API endpoint in the configuration
- Modifying game options (play style, rounds, time limits)
- Adding custom event handlers
- Extending the UI with additional features
- Implementing different game logic

## Troubleshooting

- **Connection issues**: Check that the server is running and accessible
- **CORS errors**: Ensure the server allows requests from your domain
- **WebSocket errors**: Check that WebSocket is enabled on the server
- **Game not starting**: Verify that the game type is registered on the server

## Next Steps

- Explore the server-side implementation to understand the full system
- Add more game types by registering them with the helper
- Implement additional UI features like chat, spectator mode, etc.
- Add authentication and user management
- Create more complex game logic and scoring systems 