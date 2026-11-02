# Concepts

The runtime model behind every kubic-kode game. Read this once; the [guide](./building-a-game.md) and the references assume it.

## The three pieces

| Piece | Lives in | You |
|-------|----------|-----|
| Your game class | your server code | write it: rules, board, win/tie (the `GameContract`) |
| The framework | `game-server/`, `game-module/`, `game-engine/` | configure it: sessions, lobby, turn order, tokens, WebSocket broadcasts |
| The helper | `client/kubic-kode-helper/` | call it from the browser: `KubicKode.joinSession(...)`, `KubicKode.route.game("play-turn", ...)`, `KubicKode.events.on(...)` |

The browser never talks to your game class directly. The helper calls the framework's HTTP routes, the framework calls your game class, and results come back both as the HTTP response and as `kubic::` events over the WebSocket to everyone in the session.

## Sessions

A **session** is one table: a game instance plus the people at it. It is created for a **game variant id** - the id you registered your game under with `gameRegistry.register(id, factory)`. Session ids are UUIDs.

Each session has `maxPlayers` (set when the session is created, default 2; the host can change it before start via the lobby config key `playerCount`). Only playable participants count toward it.

## Participants

Everyone in a session is a **participant** with a numeric id (`1`, `2`, `3`, ... per session) and a type:

| Type | Playable | Notes |
|------|----------|-------|
| `user` | yes | a human |
| `computer` | yes | an AI seat; the framework plays its turns by calling your `calculateComputerMove()` |
| `spectator` | no | receives every broadcast and can read game state; cannot start, stop, move or vote |

The **host** is the first playable participant to join. The host can kick, transfer host, edit the shared lobby config and start the ready-check phase. If the host leaves, the next playable participant becomes host.

### Participant id vs player id

Two different id spaces:

- **participant id** - who you are in the session (from joining).
- **player id** - the engine's positive integer for a seat in the game (what your `playTurn(playerId, ...)` receives and what "current player" returns).

The framework maps between them when the game starts (`playerMappings`: participantId -> playerId). To answer "is it my turn?" on the client, compare `KubicKode.game.currentPlayerId` with `KubicKode.game.playerMappings[KubicKode.participantId]` - never your participant id directly.

## Game tokens

Joining (`join`, `spectate`, `auto-join`) returns a **game token**: an encrypted blob naming the session and participant, valid for 24 hours. The helper stores it in localStorage (`kubic_game_tokens`) and attaches it for you.

The token is required for every `/api/game/...` route and for a WebSocket that claims a seat. A token from one session or participant is rejected for another. Tokens are encrypted with `KUBIC_GAME_TOKEN_SECRET_KEY` (32+ characters, required).

## Game lifecycle

1. **Start.** A playable participant starts the game once enough playable participants are present (`requiredPlayers()`, minimum 2). The framework adds a player to your game per playable participant, maps participants to them, calls your `startGame()`, picks who goes first, and broadcasts `kubic::gameStarted`. Game options can be passed in the start request.
2. **Turns.** The framework checks that the caller holds a current player's seat, calls your `playTurn()`, advances the turn order, and broadcasts `kubic::turnPlayed`. Computer seats are played automatically whenever it is their turn.
3. **End.** When `playTurn()` reports a win or tie (and your game stops its engine), the framework broadcasts `kubic::playerWon` or `kubic::gameTied`, then `kubic::winCount` (incremented on wins only).
4. **Restart.** Any participant can open a restart vote; it passes when all vote yes (computer seats vote yes automatically) and the result is broadcast. Nothing restarts by itself: your client calls `KubicKode.startGame()` on `restartVotingCompleted`, which calls your game's `startGame()` again - that is where your game resets its state.

**Turn timers.** If your game implements `getInactivityTimeout()` and `handleInactivity()`, the framework broadcasts `kubic::timeLeft` every 5 seconds while a turn is pending and `kubic::playerInactive` when it expires.

## Connection and reconnection

The helper opens one WebSocket per tab after joining (`?sessionId=...&participantId=...&gameToken=...`) and sends a heartbeat every 25 seconds. A refused seat (bad token, removed participant) is closed with code `4401` and never retried; any other unexpected close is retried with backoff.

On the server, a closed socket starts a 60-second timer (`KUBIC_HEARTBEAT_TIMEOUT`). Reconnecting before it fires cancels it. If it fires, the participant is marked disconnected (`kubic::participantDisconnected`), and if that leaves fewer connected playable participants than the game requires, the session ends (`kubic::sessionEnded`) and is removed.

## Events

Everything the server broadcasts is named `kubic::<event>` and goes to every socket in the session. The helper relays these unchanged on `KubicKode.events`, and also emits its own unprefixed events derived from them (e.g. `gameEnded`, `turnUpdated`).

A second, opt-in stream of game-history events (`playerAdded`, `invalidTurnAttempted`, `gameInstanceReset`, ...) is delivered only after the session subscribes to them. Subscriptions are per session, not per client. See the [server reference](./server-reference.md#websocket) for the full list.

## Options and lobby config

Two separate key-value stores:

- **Game options** are declared by your game (`initializeGameOptions()`) with a lifecycle that controls when they may change: `frozen`, `pre-start`, `runtime`, `between-rounds`. Clients set them in the start request.
- **Lobby config** is free-form session data the host edits before the game (`KubicKode.setGameConfig(...)`), broadcast as `kubic::lobbyConfigUpdated`. Keys that match a declared game option are applied to it when the host sets them, and again on first start.
