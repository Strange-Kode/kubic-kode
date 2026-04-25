# Spectator Functionality

The kubic-kode game system now supports **spectators** - special session participants who can observe games but cannot interact with them.

## Overview

Spectators are session participants with type `"spectator"` who:
- ✅ Can join sessions and observe games
- ✅ Receive all game broadcasts and updates
- ✅ Can view game state, tile maps, and participant lists
- ❌ Cannot start or stop games
- ❌ Cannot make moves or perform game actions
- ❌ Cannot vote on restart requests

## Backend Implementation

### Participant Types

The system now supports three participant types:

- `"user"` - Regular human participant
- `"computer"` - AI participant
- `"spectator"` - Observer (new)

Each participant's playability is determined by the `isParticipantPlayable()` method:

- Returns `true` for "user" and "computer" types
- Returns `false` for "spectator" type

### Session Management

#### Adding Participants

```javascript
// Add a user to a session
const userId = gameSession.addParticipant("Alice", "user");

// Add a computer player to a session
const computerId = gameSession.addParticipant("AI Bot", "computer");

// Add a spectator to a session
const spectatorId = gameSession.addParticipant("Charlie", "spectator");
```

#### Game Start Requirements

Games now require at least 2 **non-spectator** participants to start:

```javascript
// Only counts human and computer participants
const playerParticipants = this.participants.filter(p => p.type !== "spectator");
if (playerParticipants.length < 2) {
  throw new Error("Cannot start game. Not enough players (need at least 2 non-spectator participants).");
}
```

#### Helper Methods

```javascript
// Get only playable participants (users and computers)
const playable = gameSession.getPlayableParticipants();

// Get only spectator participants
const spectators = gameSession.getSpectatorParticipants();

// Check if a participant can play
const participant = gameSession.getParticipantById(participantId);
if (gameSession.isParticipantPlayable(participant)) {
  // Participant can perform game actions
}

// Direct method call
const isPlayable = gameSession.isParticipantPlayable(participant);
```

### API Routes

#### New Spectator Routes

```javascript
// Join as spectator
POST /api/session/:sessionId/spectate
{
  "participantName": "Charlie"
}

// Get participant statistics
GET /api/session/:sessionId/participants/stats
// Returns: { total: 4, players: 2, spectators: 2, canStart: true }
```

#### Protected Routes

The following routes require a participant game token and block spectators:

- `POST /api/game/:sessionId/start` - Start game
- `POST /api/game/:sessionId/stop` - Stop game
- `POST /api/game/:sessionId/play-turn` - Make moves (generic endpoint for all games)

#### Middleware Protection

```javascript
// Reusable middleware checks if participant is playable
import { checkPlayableAccess } from "../../game-utility/game-utility.js";

const checkPlayableAccessMiddleware = checkPlayableAccess(sessionManager);

// Use in routes
gameRouter.post("/game/:sessionId/start", checkPlayableAccessMiddleware, (req, res) => {
  // Only playable participants can access this route
});
```

## Frontend Implementation

### KubicKode Helper

#### New Methods

```javascript
// Join as spectator
const result = await KubicKode.spectateSession("Charlie");

// Get participant statistics
const stats = await KubicKode.route.session("participant-stats");
```

#### Automatic Participant ID Tracking

The helper now automatically tracks `participantId` and includes it in protected requests:

```javascript
// Automatically includes participantId in game requests
await KubicKode.startGame(); // Includes participantId in request body
await KubicKode.playTurn(0, 0); // Includes participantId in request body
```

### Usage Examples

#### Basic Spectator Flow

```javascript
// 1. Initialize session
await KubicKode.initSession("tic-tac-toe-classic");

// 2. Join as spectator
const result = await KubicKode.spectateSession("Charlie");

// 3. Connect to WebSocket for real-time updates
KubicKode.connectWebSocket();

// 4. Listen for game events
KubicKode.events.on("turnPlayed", (data) => {
  console.log("A participant made a move:", data);
});

KubicKode.events.on("gameStarted", (data) => {
  console.log("Game started:", data);
});
```

#### Participant Management

```javascript
// Get all participants
const participants = await KubicKode.route.session("participants");
// Returns: [
//   { id: 1, name: "Alice", type: "user" },
//   { id: 2, name: "Bob", type: "user" },
//   { id: 3, name: "Charlie", type: "spectator" }
// ]

// Get participant statistics
const stats = await KubicKode.route.session("participant-stats");
// Returns: { total: 3, players: 2, spectators: 1, canStart: true }
```

#### Error Handling

```javascript
try {
  // This will fail for spectators
  await KubicKode.startGame();
} catch (error) {
  if (error.message.includes("Spectators cannot perform this action")) {
    console.log("Spectators cannot start games");
  }
}
```

## Benefits

1. **Enhanced Viewing Experience** - Multiple people can watch games
2. **Tournament Support** - Spectators can observe competitive matches
3. **Learning Tool** - New players can watch experienced players
4. **Scalable Architecture** - Spectators don't consume game resources
