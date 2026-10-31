# KubicKode Helper - Client Guide

The KubicKode helper (`client/kubic-kode-helper/`) is the browser-side companion to the kubic-kode server. It wraps the session and game REST routes, stores game tokens, manages the WebSocket connection (including heartbeats and reconnection), relays the server's `kubic::` events, and keeps reactive client-side state for the session, game, lobby config, voting, and win counts.

This guide is task-oriented. For the exhaustive API surface (every method, action, event, and option), see the [helper reference](./kubic-kode-helper-reference.md). For the server-side contract behind these calls, see [Building and Playing a Game](./building-and-playing-a-game.md).

## Getting started

The helper ships as a UMD module exposing a ready-to-use singleton:

```javascript
// ES module
import { KubicKode } from "./kubic-kode-helper/index.js";

// CommonJS
const { KubicKode } = require("./kubic-kode-helper/index.js");

// Browser global (no bundler)
// <script src="kubic-kode-helper/index.js"></script> -> window.KubicKode
```

`KubicKode` is a singleton instance of `KubicKodeHelper` (also exported, if you need your own instance). Configure it once before use:

```javascript
KubicKode.configure({
  websocketPort: "3000",   // the kubic-kode server's port
  frontendUrl: "https://mygame.example", // needed for getShareableSessionLink()
});
```

All HTTP calls go to `{apiPrefix}/...` (default `/api`) on the current origin, retried up to 3 times, and resolve to a `{ success, data }` envelope. Failures throw `KubicClientError` (with `code` and `context` fields).

## Quick start: from lobby to game

```javascript
import { KubicKode } from "./kubic-kode-helper/index.js";

// 1. Create or join a session
await KubicKode.initSession("tic-tac-toe-classic", { forceNew: true });
await KubicKode.joinSession("Alice", "user"); // stores this participant's game token

// 2. Connect the WebSocket (after joining, so the connection is tied to your participant)
KubicKode.connectWebSocket(); // heartbeats start automatically

// 3. React to real-time events
KubicKode.events.on("kubic::sessionParticipantJoined", () => renderLobby());
KubicKode.events.on("turnUpdated", () => renderBoard());
KubicKode.events.on("gameEnded", ({ winner, isTie }) => showResult(winner, isTie));

// 4. Start and play
await KubicKode.startGame();
await KubicKode.route.game("play-turn", { xPos: 0, yPos: 0 });
```

Two things the helper is doing for you here:

- **Tokens**: `joinSession` stores the participant's game token (localStorage key `kubic_game_tokens`); every `route.game(...)` call re-reads it and injects `participantId` + `gameToken` into the request body automatically.
- **WebSocket scoping**: `connectWebSocket()` builds the socket URL with `?sessionId=...&participantId=...&gameToken=...`, which is how the server ties the connection to your session; a seat whose token is missing or wrong is closed with 4401 and emits `websocketRefused`. It also sends heartbeats every 25 seconds and auto-reconnects on unexpected closes.

## Sessions and the lobby

Session lifecycle:

```javascript
await KubicKode.initSession(gameId, { forceNew, maxPlayers }); // create (or reuse) a session
await KubicKode.joinSession(name, "user");     // join as a player
await KubicKode.spectateSession(name);         // or join as a spectator
await KubicKode.addAIParticipant("AI Opponent"); // add a computer player
await KubicKode.leaveSession();                // leave and clear local state
```

Finding sessions instead of creating them:

```javascript
const { data } = await KubicKode.listSessionsByGame("tic-tac-toe-classic"); // joinable by default
await KubicKode.autoJoinSession("tic-tac-toe-classic", "Alice"); // find a seat or create a session
const { data } = KubicKode.getShareableSessionLink(); // { sessionId, link } - requires frontendUrl (synchronous)
```

Lobby state and host powers (the first joiner is host):

```javascript
const stats = await KubicKode.getSessionStats();  // players, spectators, canStart, started
await KubicKode.kickParticipant(participantId);   // host only
await KubicKode.transferHost(newHostId);          // host only

// Shared lobby configuration (arbitrary key-value, host-mutated, broadcast to everyone)
await KubicKode.setGameConfig({ difficulty: "hard" });
KubicKode.events.on("lobbyConfigUpdated", ({ changes }) => applySettings(changes));

// Lobby chat
await KubicKode.sendChatMessage("glhf");
KubicKode.events.on("lobbyChatMessage", ({ message }) => appendChat(message));
```

`KubicKode.session` holds the reactive session state (`participants`, `isHost`, `maxPlayers`, plus helpers like `getPlayableParticipants()` and `isSessionFull()`), and emits `sessionStateUpdated` / `participantsUpdated` when it changes.

## Playing a game

There are two ways to send moves:

**Generic route (works for every game).** `route.game(action, data)` covers the framework's whole game surface: `"start"`, `"play-turn"`, `"stop"`, `"get-current-player"`, `"get-tilemap"`, `"is-active"`, `"options"`, `"get-player-mappings"`. You pass only your move fields; the helper injects auth.

```javascript
await KubicKode.route.game("play-turn", { xPos: 1, yPos: 2 });
const { data } = await KubicKode.route.game("get-tilemap");
```

**Registered-game sugar.** If you register a game id on the client, the helper creates a named route and the high-level `playTurn(x, y)` works:

```javascript
KubicKode.game.register("tic-tac-toe-classic");
KubicKode.game.use("tic-tac-toe-classic");
await KubicKode.playTurn(1, 2); // -> POST /tic-tac-toe-classic/play-turn/:sessionId
```

Note that registered-game routes post to the game's own custom endpoints (`/{gameId}/play-turn/...`), not the generic `/game/...` routes - use them when your server ships matching custom routes; otherwise stick to `route.game("play-turn", ...)`.

`KubicKode.game` also holds reactive game state: `started`, `active`, `tilemap` (indexed `tilemap[y][x]`, or use `getTile(x, y)`), `currentPlayerId`, `playerMappings`, `lastMoveResult`, emitting `gameStateUpdated` and `tilemapUpdated`. With the default `autoFetchOnEvents: true`, the helper refreshes the tilemap and current player automatically whenever the server broadcasts `kubic::turnPlayed` or `kubic::gameStarted`.

### Whose turn is it?

Participants and players live in different id spaces: the **participant id** identifies you in the session, while the **player id** is the engine's positive integer that `get-current-player` returns. The bridge is `KubicKode.game.playerMappings` (participantId -> playerId), populated on game start. The reliable check is:

```javascript
const myPlayerId = KubicKode.game.playerMappings[KubicKode.participantId];
const isMyTurn = KubicKode.game.currentPlayerId === myPlayerId;
```

Avoid `KubicKode.game.isMyTurn()` for now: it compares the engine player id directly against your participant id, which only matches by coincidence (tracked in #175).

## Real-time events

`KubicKode.events` is a simple emitter: `on(event, cb)`, `off(event, cb)`, `emit(event, data)` (all chainable; there is no `once`). Two families of events flow through it:

**Server broadcasts** are relayed with their `kubic::` prefix intact: participant lifecycle (`kubic::sessionParticipantJoined`, `kubic::participantDisconnected`, `kubic::participantReconnected`, ...), game flow (`kubic::gameStarted`, `kubic::turnPlayed`, `kubic::playerWon`, `kubic::gameTied`, `kubic::gameStopped`), lobby (`kubic::lobbyConfigUpdated`, `kubic::lobbyChatMessage`), voting (`kubic::restartVoteStarted`, `kubic::restartVoteUpdate`, `kubic::restartVoteResult`), and inactivity (`kubic::timeLeft`, `kubic::playerInactive`).

**Helper-level events** are higher-level signals the helper derives for you, often easier to build UI on: `gameEnded` (`{ winner, isTie, reason }` - fired for wins, ties, and inactivity endings), `turnUpdated`, `participantConnectionChanged` (`{ type: "disconnected" | "removed" | "reconnected", ... }`), `participantKicked` (with an `isSelf` flag), `hostTransferred` (with `isHostNow`), `restartVotingStarted` / `restartVotingUpdated` / `restartVotingCompleted`, `inactivityTimerUpdate`, and `websocketConnected` / `websocketDisconnected` / `websocketError`.

The full catalog, with payload shapes, is in the [reference](./kubic-kode-helper-reference.md).

## Restart voting, win counts, and timers

```javascript
// Restart voting (any participant can initiate; all playable participants vote)
await KubicKode.voting.initiate();  // starts a vote and casts your "yes"
await KubicKode.voting.vote(true);  // cast/change a vote
KubicKode.events.on("restartVotingCompleted", ({ allAgreed }) => allAgreed && resetBoard());

// Win statistics across restarts
KubicKode.events.on("winCountsUpdated", () => scoreboard(KubicKode.wins.getState()));
KubicKode.wins.getWinCountForPlayer(playerId);
KubicKode.wins.getWinPercentage(playerId);

// Turn/inactivity countdown (server-authoritative, interpolated locally)
setInterval(() => showTimer(KubicKode.inactivity.getLiveTimer()), 250);
```

`KubicKode.flow` orchestrates game flow, including **auto-start**: with the default mode `"on-full"`, the helper starts the game automatically when the session fills up. Configure it with `KubicKode.flow.configure({ autoStartEnabled, autoStartMode })` where mode is `"on-full"`, `"on-ai"`, `"immediate"`, or `"manual"`.

## Error handling

Everything throws `KubicClientError` - `message`, `code` (e.g. `NO_ACTIVE_SESSION`, `NO_GAME_TOKEN`, `HTTP_ERROR`, `GAME_NOT_REGISTERED`), `context`, and `timestamp`:

```javascript
import { KubicClientError } from "./kubic-kode-helper/index.js";

try {
  await KubicKode.route.game("play-turn", { xPos: 9, yPos: 9 });
} catch (err) {
  if (err instanceof KubicClientError && err.code === "NO_GAME_TOKEN") {
    // joined yet?
  }
}
```

## See also

- [KubicKode Helper Reference](./kubic-kode-helper-reference.md) - the complete API surface (methods, route actions, events, config, state)
- [Building and Playing a Game](./building-and-playing-a-game.md) - the server-side game contract these calls drive
- [Game Token System](./game-token-system.md) - what the stored game tokens are and how the server validates them
- [Heartbeat System](./heartbeat-system.md) - the liveness protocol behind `connectWebSocket()`
