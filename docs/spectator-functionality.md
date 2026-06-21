# Spectator Functionality

The kubic-kode game system supports **spectators** - special session participants who can observe games but cannot interact with them.

## Overview

Spectators are session participants with type `"spectator"`.

Can:
- Join sessions and observe games
- Receive all game broadcasts and updates
- View game state, tile maps, and participant lists

Cannot:
- Start or stop games
- Make moves or perform game actions
- Vote on restart requests

## Backend Implementation

### Participant Types

The system supports three participant types:

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

Games require at least 2 **playable** participants (users or computers) to start. The check lives in `GameSession.markStarted()`; spectators never count toward it. Simplified:

```javascript
// GameSession.markStarted() - only counts playable participants (users and computers)
const playable = this.getPlayableParticipants();
if (playable.length < 2) {
  throw ErrorFactory.validation(
    "Cannot start game. Not enough players (need at least 2 playable participants)"
    // (the real call also passes the offending field, value, and context)
  );
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
// Returns: { sessionId, maxPlayers: 2, total: 4, players: 2, spectators: 2, canStart: true, started: false }
```

`canStart` is `players >= maxPlayers` (here 2 >= 2). Note this is a separate condition from the start minimum in `markStarted()` (at least 2 playable); they coincide only when `maxPlayers` is 2.

#### Protected Routes

The following routes require a participant game token and block spectators:

- `POST /api/game/:sessionId/start` - Start game
- `POST /api/game/:sessionId/stop` - Stop game
- `POST /api/game/:sessionId/play-turn` - Make moves (generic endpoint for all games)

#### Middleware Protection

Spectators are blocked by the game-token middleware: `validateGameTokenWithParticipant`
rejects any participant whose token maps to a non-playable participant (HTTP 403).
The `stop` and `play-turn` routes additionally chain `validatePlayableParticipant`.

```javascript
import { validateGameTokenWithParticipant } from "../game-token-middleware.js";
import { validatePlayableParticipant } from "../../game-utility/game-utility.js";

// Both are middleware factories: call them with the session manager to get the middleware.

// start: token + participant validation (rejects spectators with 403)
gameRouter.post(
  "/game/:sessionId/start",
  validateGameTokenWithParticipant(sessionManager),
  (req, res) => {
    // Only playable participants reach this handler
  }
);

// stop / play-turn additionally require a playable participant
gameRouter.post(
  "/game/:sessionId/play-turn",
  validateGameTokenWithParticipant(sessionManager),
  validatePlayableParticipant(sessionManager),
  (req, res) => { /* ... */ }
);
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

// 2. Join as spectator (this also opens the WebSocket connection)
const result = await KubicKode.spectateSession("Charlie");

// 3. Listen for game events. The helper re-emits a played turn as
//    "turnUpdated"; raw server broadcasts are available under their
//    kubic:: names.
KubicKode.events.on("turnUpdated", (data) => {
  console.log("A participant made a move:", data);
});

KubicKode.events.on("kubic::gameStarted", (data) => {
  console.log("Game started:", data);
});
```

#### Participant Management

```javascript
// Get all participants
const participants = await KubicKode.route.session("participants");
// Returns: [
//   { id: 1, name: "Alice", type: "user", isPlayable: true },
//   { id: 2, name: "Bob", type: "user", isPlayable: true },
//   { id: 3, name: "Charlie", type: "spectator", isPlayable: false }
// ]

// Get participant statistics
const stats = await KubicKode.route.session("participant-stats");
// Returns: { sessionId, maxPlayers: 2, total: 3, players: 2, spectators: 1, canStart: true, started: false }
```

#### Error Handling

```javascript
try {
  // This will fail for spectators (and any non-playable participant)
  await KubicKode.startGame();
} catch (error) {
  // The client throws a KubicClientError. HTTP failures carry the status in
  // error.context; the server's JSON error body is not surfaced in the message.
  if (error.code === "HTTP_ERROR" && error.context.status === 403) {
    console.log("This participant cannot start games (forbidden)");
  }
}
```

## Benefits

1. **Enhanced Viewing Experience** - Multiple people can watch games
2. **Tournament Support** - Spectators can observe competitive matches
3. **Learning Tool** - New players can watch experienced players
4. **Scalable Architecture** - Spectators don't consume game resources
