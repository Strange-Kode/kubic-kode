# Server Reference

Everything you write or configure on the server: the game class, the engine, options, server setup, environment. Flat and complete; meant to be loaded into a coding agent's context. Concepts are explained in [concepts.md](./concepts.md); the browser side is in the [helper reference](./helper-reference.md).

## Imports

ES modules only (`"type": "module"`). The package root re-exports most modules as **namespaces**, so classes are one level down:

```javascript
import {
  gameRegistry, createGameServer, getKubicKodeModulesPath, // named
  gameEngine, gameEntity, playStatus, tileMap,              // namespaces
} from "kubic-kode";

const { GameEngine } = gameEngine;
const { GameEntity } = gameEntity;
const { PlayStatus } = playStatus;
```

Inside a clone, import the files directly instead (`game-engine/game-engine.js`, `game-engine/play-status.js`, ...).

| Export | Kind | Contains |
|--------|------|----------|
| `gameRegistry` | named | register game variants |
| `createGameServer` | named | build and start the Express + WebSocket server |
| `getKubicKodeModulesPath`, `loadModulesFromDirectory`, `initModuleSystem`, `registerModule`, `unregisterModule`, `hooks`, `modules`, `registry` | named | [module system](./module-system.md) |
| `sessionManager`, `sessionRoutes`, `gameRoutes` | named | internals, for custom wiring |
| `SESSION_END_REASONS` | named | the reasons `session:ended` hooks receive ([hooks](./module-system.md)) |
| `validateGameToken`, `validateGameTokenWithParticipant`, `validateGameTokenWithParticipantReadOnly`, `validateSession`, `validateParticipant`, `validatePlayableParticipant`, `checkPlayableAccess` | named | Express middleware for your own routes ([HTTP guards](#guards)) |
| `kubicLog`, `debugConfig` | named | [logging](#logging) |
| `gameEngine.GameEngine`, `tileMap.TileMap`, `gameEntity.GameEntity`, `gameEntityPlayer.GameEntityPlayer`, `playStatus.PlayStatus`, `gameOptions.GameOptions`, `kubicKodeGame.KubicKodeGame` | namespace | engine building blocks |

The error classes (`KubicKodeError` etc.) are not exported from the root.

## Server setup

```javascript
import { gameRegistry, createGameServer, getKubicKodeModulesPath } from "kubic-kode";
import { MyGame } from "./my-game.js";

gameRegistry.register("my-game", (sessionId, options) => new MyGame(options));

const { app, server } = await createGameServer({
  modulesPath: getKubicKodeModulesPath(), // required when kubic-kode is a dependency
  corsOrigins: ["http://localhost:5173"],
});
```

**`gameRegistry.register(variantId, factory)`** - `factory(sessionId, options)` returns a new, unwrapped game instance per session. `variantId` is what clients pass to `initSession(variantId)`; `options` is the init request body minus `forceNew` (e.g. `maxPlayers`). Registering the same id twice throws. Register several ids with different factories to offer variants.

**`createGameServer(options)`** returns `Promise<{ app, server }>`. It mounts the session and game routes under `/api` and attaches the WebSocket server to the same HTTP server.

| Option | Default | Notes |
|--------|---------|-------|
| `port` | `KUBIC_PORT` or `3000` | |
| `corsOrigins` | `KUBIC_ALLOWED_ORIGINS` split on `,`, else `[]` | `[]` denies every cross-origin browser request (logs a warning) |
| `modulesPath` | `"game-module/modules"` relative to `process.cwd()` | Only resolves inside a clone. As a dependency, pass `getKubicKodeModulesPath()` |
| `gameRouters` | `[]` | `[{ path, router }]` - your own Express routers |
| `staticPaths` | `"../client"` (cwd-relative) | string or array, served at `/static` (`/static/0`, `/static/1`, ... for several) |
| `rootHandler` | responds `"It works!"` | handler for `GET /` |
| `helmet` | `true` | `false` disables; an object is passed to `helmet()` |
| `startServer` | `true` | `false` skips `listen()` |
| `onReady(app, server)` | - | called before the promise resolves |

Startup requires a **`.env` file in the working directory** and `KUBIC_GAME_TOKEN_SECRET_KEY`. See [environment variables](#environment-variables).

## Game contract

Your game class implements these. The framework wraps each instance in a `KubicKodeGame` proxy and calls them; a missing required method fails when a session is created (`KubicContractError: <Class> is missing required methods: ...`).

### Required

| Method | Called | Must |
|--------|--------|------|
| `getGameEngine()` | constantly | return the instance's `GameEngine` |
| `requiredPlayers()` | before start | return the number of playable participants needed (the server enforces a minimum of 2 regardless) |
| `addPlayer(name, isComputer)` | on every start, once per playable participant | create a player entity, `engine.registerPlayerEntity(entity)`, return it. `isComputer` is `true` for computer participants. On restart the same participants are added again; entities with an already-registered player id are skipped |
| `startGame()` | on every start, **including restarts** | reset per-game state (board, scores) and call `this.getGameEngine().startGame()` |
| `playTurn(playerId, turnData)` | when the current player moves | apply the move and return a [`PlayStatus`](#playstatus). `turnData` holds the move fields the client sent |
| `resetForRestart()` | - | required by the contract; may be empty. Reset game state in `startGame()`, which runs on every (re)start |

Rules the framework relies on:

- **Stop the engine when the game ends.** On a win or tie, call `this.getGameEngine().stopGame()` before returning. If you don't, the engine stays started and the next start is answered with "Game already previously started".
- **Reject moves when the game isn't running:** `if (!this.getGameEngine().isGameStarted()) return PlayStatus.invalid(playerId, "Game is over")`.
- **Never call `engine.nextTurn()`.** The framework advances turns after `playTurn` returns (and throws if you try).
- **Player ids are positive integers** (`1`, `2`, ...). `PlayStatus` rejects anything else.
- **Throwing** from `playTurn` returns HTTP 400 `{ error: "Invalid move.", details: <message> }`. For expected rejections return `PlayStatus.invalid(...)` instead (HTTP 200 with `status: "invalid"`; the turn does not advance).

### Optional

| Method | Default | Notes |
|--------|---------|-------|
| `initializeGameOptions()` | - | declare [options](#game-options); called once when the instance is wrapped |
| `applyGameOptions(applied)` | - | called on every start (and when the host updates lobby config) with an object of the applied options, e.g. `{ gridSize: 5 }` (system options keyed `"system::<key>"`); `{}` if none |
| `establishFirstPlayers(sessionContext)` | random | return the player id that moves first. `sessionContext` is `{ restartCount, winCount }` |
| `calculateComputerMove(playerId, playerEntity)` | returns `null` | return the `turnData` object a computer player would send. Must always return a valid move |
| `getInactivityTimeout()` | `null` | turn timeout in ms. Only used if `handleInactivity` is also defined |
| `handleInactivity(playerId, playerEntity)` | - | called when a player's turn times out. Must return `{ inactivePlayerId, winnerPlayerId }` (either may be `null`); stop the engine yourself if the game ends |
| `removePlayer(playerId)` | - | clean up when a participant leaves mid-game. Don't deregister the entity; the framework does |

### Available on `this`

Inside your game, the wrapper injects `this.getGameOptions()` and `this.getOptionValue(key)`.

## PlayStatus

`playTurn` returns one of these. Build it with the static factories:

| Factory | Use for | Sets |
|---------|---------|------|
| `PlayStatus.success(playerId, opts)` | a normal move | `playerHasWon: false`, `gameIsTied: false` |
| `PlayStatus.win(playerId, opts)` | a winning move | `playerHasWon: true`, `gameEnded: true` |
| `PlayStatus.tie(playerId, opts)` | a draw | `gameIsTied: true`, `gameEnded: true` |
| `PlayStatus.invalid(playerId, message, opts)` | a rejected move | `status: "invalid"`, `message` |
| `PlayStatus.nonCompetitive(playerId, opts)` | games with no win/tie | won/tied left unset |
| `PlayStatus.movement(playerId, opts)` | movement-only turns | `message` defaults to `"Move successful"` |

Recognized `opts` keys (others are dropped): `message`, `type`, `mark`, `winCondition`, `gameEnded`, `customData`, and the factory's own fields (`status`, `playerHasWon`, `gameIsTied`), which `opts` overrides. The framework sets `timeLeft` itself.

The play-turn response and the `kubic::turnPlayed` broadcast (`roundStatus`) carry it snake_cased, with null fields omitted and `time_left` (seconds, `0` without a timer) always added:

```json
{ "status": "ok", "player_id": 2, "player_has_won": true, "game_is_tied": false,
  "win_condition": "three-in-a-row", "game_ended": true, "custom_data": { "row": 0 }, "time_left": 0 }
```

Set `customData.includeFullTilemap = false` to leave the tile map out of the `kubic::turnPlayed` broadcast.

## GameEngine

`new GameEngine(width, height, config = {})` - `width` is x (columns), `height` is y (rows).

| Config | Default | Values |
|--------|---------|--------|
| `playStyle` | `"single-set"` | see below |
| `turnOrder` | `[]` | for `multi-subset`: array of arrays of player ids. Other styles use registration order; who starts is decided by `establishFirstPlayers()` (random by default) |

| Play style | Whose turn | Turn advances |
|------------|-----------|---------------|
| `single-set` | one player at a time | after each move, to the next player in order |
| `multi-set` | all players simultaneously | when every player has moved |
| `multi-subset` | one group of players at a time | when every player in the group has moved |
| `non-blocking` | anyone, any time | after every move |

`getCurrentTurnPlayers()` returns a single entity for `single-set` and an array otherwise.

| Methods | |
|---------|-|
| Players | `registerPlayerEntity(entity)`, `deregisterPlayerEntity(id)`, `getPlayerEntities()`, `getPlayerById(id)` (undefined if missing), `getPlayerEntity(id)` (throws if missing), `clearPlayerEntities()` |
| Lifecycle | `startGame()` (throws if already started or no players), `stopGame()` (throws if already stopped), `isGameStarted()` |
| Turns | `getCurrentTurnPlayers()`, `getTurnNumber()` (starts at 1), `getTurnOrder()`, `setTurnOrder(order)`, `getCurrentTurnIndex()`, `canPlayerAct(id)`, `hasPlayerActed(id)`, `getPlayersWhoActed()`, `getPlayStyle()` |
| Tile map | `getTileMap()`, `resetTileMap()` (clears all tiles), `updateTileMapDimensions(w, h)` (recreates, tiles lost) |
| Components | `registerComponent(Component)` (needs a static `componentName`), `applyComponent(entity, Component, ...args)` |

### TileMap

`engine.getTileMap()` returns a `TileMap`. Tiles are stored `tiles[y][x]`, row 0 at the top; empty tiles are `null`. Clients receive `{ width, height, tiles }` (each tile value via its `toJSON()` if it has one).

`getWidth()`, `getHeight()`, `getTiles()`, `getTile(x, y)`, `setTile(x, y, value)`, `trySetTile(x, y, value)` -> `{ success, occupied, previousValue }`, `isTileOccupied(x, y)`, `inBounds(x, y)`, `getOccupiedTiles()` -> `[{ x, y, value }]`, `getEmptyTiles()` -> `[{ x, y }]`, `getOccupiedCount()`, `getTotalTiles()`, `getArea(x0, y0, x1, y1)` (end-exclusive), `resize(w, h)`, `toJSON()`.

### Player entities

A player entity is any object with these methods; extending `GameEntity(id, name, position)` gives you `getEntityId()` / `getEntityName()`:

| Method | Used for |
|--------|----------|
| `getPlayerId()` | **required** - the positive-integer player id |
| `getPlayerName()` | fallback for matching a player to its participant by name |
| `toJSON()` | turn history (`GameEntity.toJSON()` throws unless overridden) |
| `getPlayerType()` returning `"computer"`, or `isComputer()` | marks a computer seat |

```javascript
class Player extends GameEntity {
  constructor(id, name) { super(id, name, null); }
  getPlayerId() { return this.getEntityId(); }
  getPlayerName() { return this.getEntityName(); }
  toJSON() { return { id: this.getPlayerId(), name: this.getPlayerName() }; }
}
```

`GameEntity` properties (`id`, `name`, `position`) are getter-protected: reading `entity.id` throws; use the `get...()` methods.

## Game options

Declare options in `initializeGameOptions()`; clients set them in the start request (`KubicKode.startGame({ gridSize: 5 })`).

```javascript
initializeGameOptions() {
  const options = this.getGameOptions();
  options.addOption("gridSize", 3, "pre-start", (v) =>
    Number.isInteger(v) && v >= 3 && v <= 10 ? true : "gridSize must be 3-10");
  options.addOption("showHints", false, "runtime");
  options.setSystemOption("returnSinglePlayerId", true);
}
```

- `addOption(key, defaultValue, lifecycle = "pre-start", validator = null)` - a validator returns `true` or an error string.
- `getCurrentValue(key)` / `this.getOptionValue(key)` read a value; `addSystemOption(...)`, `setSystemOption(key, value)`, `getCurrentSystemValue(key)` work on the system namespace. Keys must be unique across both namespaces.
- A `gridSize` option, when applied, resizes the engine's tile map to `gridSize` x `gridSize` (clearing all tiles).

**Lifecycles:**

| Lifecycle | Changeable |
|-----------|-----------|
| `frozen`, `pre-start` | before the game starts |
| `runtime`, `between-rounds` | during the game |

**Start request mapping.** The start body minus `participantId` is validated against declared options. Lobby config keys are merged underneath on the first start. Unknown keys are ignored, not rejected. Request keys prefixed `system::` target system options. Invalid or locked options return HTTP 400:

```json
{ "error": true, "message": "Invalid game options",
  "details": ["Option \"gridSize\" is locked: ..."], "ignored": ["Unknown option \"foo\""],
  "locked": [{ "key": "gridSize", "lifecycle": "pre-start", "gameState": "started", "reason": "..." }],
  "game_state": "started" }
```

**Built-in system options:**

| Option | Default | Effect |
|--------|---------|--------|
| `returnSinglePlayerId` | `false` | Responses use `current_player_id` / `first_player_id` (scalars) instead of the `..._ids` arrays. Requires `single-set`. Set it in `initializeGameOptions()` |
| `participantPlaysFirst` | `null` | participant id (as a string) that moves first; overrides `establishFirstPlayers()` |
| `inactivityTimeout` | `null` | ms (>= 1000); overrides `getInactivityTimeout()`, only if the game defines `handleInactivity` |

## Computer players and turn timers

**Computer players.** A participant joined with type `computer` (`KubicKode.addAIParticipant()`) is added with `addPlayer(name, true)`. Whenever the current player is a computer (after start and after every human turn), the framework calls `calculateComputerMove(playerId, entity)`, passes the result to `playTurn`, and broadcasts the turn like any other. Computer participants vote yes in restart votes automatically. Delays: `KUBIC_AI_MOVE_DELAY`, `KUBIC_AI_AUTO_VOTE_DELAY`.

**Turn timers.** Implement both `getInactivityTimeout()` (ms) and `handleInactivity()`. The timer resets on every valid turn. While it runs the server broadcasts `kubic::timeLeft { secondsLeft }` every 5 s; on expiry it calls `handleInactivity` for each current player who hasn't moved and broadcasts `kubic::playerInactive`. A returned `winnerPlayerId` is recorded as a win with `winCondition: "inactivity"`. Ending the game (stopping the engine) is up to you.

## Environment variables

Read from `.env` unless marked **env**: those must be set in the process environment (e.g. `KUBIC_DEBUG_MODE=true npm run start-server`), not in `.env`.

| Variable | Default | Effect |
|----------|---------|--------|
| `KUBIC_GAME_TOKEN_SECRET_KEY` | - | **Required**, 32+ characters. Encrypts game tokens |
| `KUBIC_PORT` | `3000` | listen port |
| `KUBIC_ALLOWED_ORIGINS` | unset (deny all) | comma-separated CORS origins |
| `KUBIC_JSON_LIMIT` | `10mb` | request body size limit |
| `KUBIC_AI_MOVE_DELAY` | `0` | ms before a computer move; when > 0, plus 0-1000 ms random |
| `KUBIC_AI_AUTO_VOTE_DELAY` | `1500` | ms before computer participants vote yes on restart |
| `KUBIC_ALLOW_AI_HOST` | `false` | `true` lists sessions with only computer players as joinable |
| `KUBIC_SESSION_MONITOR` | `false` | `true` logs the open-session count periodically |
| `KUBIC_SESSION_MONITOR_INTERVAL` | `60000` | monitor period, ms |
| `KUBIC_GAME_TOKEN_ALGORITHM` | `aes-256-gcm` | changing it, or the two below, invalidates issued tokens |
| `KUBIC_GAME_TOKEN_IV_LENGTH` | `16` | |
| `KUBIC_GAME_TOKEN_SALT_LENGTH` | `64` | |
| `KUBIC_DEBUG_MODE` (or `DEBUG_MODE`) | off | **env.** `true`/`1` enables logging. When off, nothing is logged, errors included |
| `KUBIC_LOG_LEVEL` (or `KUBIC_DEBUG_LEVEL`, `DEBUG_LEVEL`) | `info` | **env.** `error`, `warn`, `info`, `debug`, `trace` |
| `KUBIC_HEARTBEAT_INTERVAL` | `30000` | **env.** ms between server heartbeats to started sessions |
| `KUBIC_HEARTBEAT_TIMEOUT` | `60000` | **env.** ms after a socket closes before the participant is marked disconnected |
| `KUBIC_RECONNECTION_WINDOW` | `120000` | **env.** ms after a socket closes before the participant is removed |
| `KUBIC_HOLD_SOLO_SESSIONS` | `false` | **env.** `true` holds a started session whose only human dropped while every other seat is a computer, instead of ending it (see [concepts](./concepts.md#connection-and-reconnection)) |
| `KUBIC_SOLO_RECONNECTION_WINDOW` | `600000` | **env.** how long a held session waits for its human, in ms |

The npm scripts `dev-server` and `start-server:debug` set the logging variables for you.

## Logging

`kubicLog` writes one JSON object per line (`{ timestamp, level, message, data? }`) when logging is enabled.

```javascript
import { kubicLog } from "kubic-kode";

kubicLog.info("Room created", { roomId });   // also: error, warn, debug, trace
kubicLog.setMode(true, "debug");             // enable at runtime
kubicLog.isEnabled();
```

## Errors over HTTP

Error bodies are not uniform. What a client can receive:

| Source | Status | Body |
|--------|--------|------|
| Game-token guard | 401 / 403 / 404 | `{ error: true, message, code? }`; codes `MISSING_GAME_TOKEN`, `INVALID_GAME_TOKEN`, `TOKEN_SESSION_MISMATCH`, `TOKEN_PARTICIPANT_MISMATCH` |
| Spectator on an action route | 403 | `{ error: true, message: "This participant cannot perform game actions" }` |
| play-turn: not a player / not your turn | 400 | `{ error: "<message>" }` |
| play-turn: `playTurn` threw | 400 | `{ error: "Invalid move.", details }` |
| start: bad options | 400 | see [game options](#game-options) |
| start: failed (e.g. too few players) | 500 | `{ error: "Failed to start game", message, details }` |
| Session routes | 400 / 403 / 404 | `{ error: "<message>" }`, `{ error: true, message, code }`, or (unknown session) `{ error: true, message, session_id }` |

The helper turns any non-2xx into a `KubicClientError` with `code: "HTTP_ERROR"` and `context.status`.

## HTTP routes

The helper calls these for you; you only need this table for a non-JS client or for debugging. All under `/api`. JSON bodies.

### Guards

| Guard | Requires |
|-------|----------|
| token | body `gameToken` for this session; if `participantId` is sent it must match the token |
| token + playable | token, and the participant is not a spectator |
| session | the session exists |
| participant | session, plus body `participantId` of an existing participant |
| playable | participant, and not a spectator |

### Game routes (all POST)

| Route | Guard | Body | Returns |
|-------|-------|------|---------|
| `/game/:sessionId/start` | token + playable | `participantId`, `gameToken`, options | `{ success, game_started, status, current_player_ids, first_player_ids, applied_game_options }` (singular `..._id` with `returnSinglePlayerId`); if already started, only `success`, `game_started`, `status` and the current player id(s) |
| `/game/:sessionId/play-turn` | token + playable, playable | `participantId`, `gameToken`, move fields | snake_cased `PlayStatus` |
| `/game/:sessionId/stop` | token + playable, playable | `participantId`, `gameToken` | `{ game_stopped }` |
| `/game/:sessionId/get-current-player` | token | `gameToken` | `{ current_player_ids }` (or `current_player_id`) |
| `/game/:sessionId/get-tilemap` | token | `gameToken` | `{ width, height, tiles }` |
| `/game/:sessionId/get-player-mappings` | token | `gameToken` | `{ player_mappings }` (participantId -> playerId) |
| `/game/:sessionId/is-active` | token | `gameToken` | `{ is_active }` |
| `/game/:sessionId/options` | token | `gameToken` | `{ available, options, lifecycle, modifiable, metadata, game_state, ... }` |

### Session routes

| Route | Guard | Body / query | Returns |
|-------|-------|--------------|---------|
| `GET\|POST /session/init/:variantId` | - | `forceNew`, `maxPlayers`, ... | `{ session_id, session_created }`. Without `forceNew`, reuses an existing session |
| `POST /session/:id/join` | session | `participantName`, `participantType` (`user`\|`computer`\|`spectator`) | `{ success, participant_id, game_token }` |
| `POST /session/:id/spectate` | session | `participantName` | as join |
| `POST /sessions/auto-join/:variantId` | - | `participantName`, `participantType`, `createIfNone` (default true) | `{ success, session_id, participant_id, game_token, session_created, lobby_status }` |
| `POST /session/:id/leave` | session | `participantId` | `{ success }` |
| `GET /session/:id/participants/list` | session | - | `[{ id, name, type, isPlayable }]` |
| `GET /session/:id/participants/stats` | session | - | `{ sessionId, maxPlayers, total, players, spectators, canStart, started }` |
| `GET /session/:id/lobby` | session | - | `{ success, lobby }` |
| `GET /sessions/list` | - | `?onlyJoinable=true` | `{ success, only_joinable, total_sessions, sessions }` |
| `GET /sessions/game/:variantId` | - | `?onlyJoinable=true` | as above, plus `game_variant_id` |
| `GET /session/:id/request-restart-vote` | session | - | `{ vote_inited }` |
| `POST /session/:id/submit-restart-vote` | playable | `participantId`, `voteYes` | `{ success }` |
| `POST /session/:id/config` | session (host) | `participantId`, `config` | `{ success, applied_config, changes, full_config, applied_to_game_options }` |
| `GET /session/:id/config` | session | - | `{ success, session_id, config, host }` |
| `DELETE /session/:id/config/:key` | session (host) | `participantId` | `{ success, deleted_key, old_value, remaining_config }` |
| `POST /session/:id/kick` | session (host) | `hostId`, `participantIdToKick` | `{ success, kicked_participant, remaining_participants }` |
| `POST /session/:id/transfer-host` | session (host) | `currentHostId`, `newHostId` | `{ success, old_host, new_host }` |
| `POST /session/:id/chat` | participant | `participantId`, `message` (1-500 chars) | `{ success, message }` |
| `GET /session/:id/chat` | session | `?limit=50` (server keeps 100) | `{ success, session_id, total_messages, messages }` |
| `POST /session/:id/sync/start` | session (host) | `participantId` | `{ success, sync_phase, ready_states, participants }` |
| `POST /session/:id/ready` | playable | `participantId`, `ready` | `{ success, participant_id, ready, all_ready, ready_states }` |
| `GET /session/:id/ready` | session | - | `{ success, session_id, in_sync_phase, all_ready, ready_states, playable_participants }` |
| `POST /session/:id/history` | session | optional `type`, `playerId`, `participantId`, `startTime`, `endTime` | `{ success, sessionId, totalEvents, history }` |
| `POST /session/:id/subscribe` | session | `eventTypes` (names without `kubic::`) | `{ success, sessionId, subscribedEventTypes, message }` |
| `POST /session/:id/unsubscribe` | session | `eventTypes` | `{ success, sessionId, unsubscribedEventTypes, message }` |
| `GET /session/:id/subscriptions` | session | - | `{ success, sessionId, subscribedEventTypes, totalSubscriptions }` |
| `POST /session/:id/heartbeat` | participant | `participantId` | `{ success, timestamp, participant_id }` |
| `GET /session/:id/status` | session | - | `{ success, session_id, status, participants }` |
| `GET /sessions/status` | - | - | `{ success, sessions, stats }` |

## WebSocket

Connect to the server's port (any path) with `?sessionId=<id>&participantId=<id>&gameToken=<token>`. The token must belong to that session and participant; otherwise the socket is closed with code `4401` and the reason. A session that ended as `orphaned`, `insufficient_players` or `hold_expired` is about to be removed and refuses new sockets the same way (`"Game session has ended"`).

**Client -> server:** `{ "type": "heartbeat" }` (or `"kubic::heartbeat"`; the helper sends one every 25 s). A seated socket is answered with `kubic::heartbeatResponse`. Nothing else is read.

**Server -> client:** broadcasts are `{ type, payload, sessionData: { sessionId, turnNumber } }`. Direct messages (`kubic::connectionConfirmed`, `kubic::heartbeat`, `kubic::heartbeatResponse`) have no `sessionData`.

**Closed sockets:** see [concepts](./concepts.md#connection-and-reconnection).

### Broadcasts (always sent)

| Event | Payload |
|-------|---------|
| `kubic::sessionParticipantJoined`, `kubic::sessionSpectatorJoined`, `kubic::sessionParticipantLeft` | `{ participant: { id, name, type, joinedAt, ... } }` |
| `kubic::hostTransferred` | `{ oldHost, newHost, reason }` (`"host-left"` or `"host-handoff"`) |
| `kubic::participantKicked` | `{ hostId, hostName, kickedParticipant: { id, name } }` |
| `kubic::participantDisconnected` | `{ participantId, participantName, disconnectedAt, reason? }` |
| `kubic::participantReconnected` | `{ participantId, participantName, reconnectedAt }` (a participant marked disconnected opened a socket again) |
| `kubic::participantRemoved` | `{ participantId, participantName, reason: "reconnection_timeout" }` |
| `kubic::sessionEnded` | `{ reason: "insufficient_players", message, connectedParticipants, requiredParticipants }`, or `{ reason: "hold_expired", message }` |
| `kubic::lobbyChatMessage` | `{ message: { id, participantId, participantName, message, timestamp, type } }` (`type`: `user`, `host`, `system`) |
| `kubic::lobbyConfigUpdated` | `{ hostId, hostName, changes, fullConfig }` |
| `kubic::lobbyConfigDeleted` | `{ hostId, hostName, deletedKey, oldValue, remainingConfig }` |
| `kubic::syncPhaseStarted` | `{ hostId, hostName, readyStates, participants }` |
| `kubic::participantReadyChanged` | `{ participantId, participantName, ready, allReady, readyStates }` |
| `kubic::gameStarted` | `{ playerMappings, inactivityTimeout }` (seconds; 0 if none) |
| `kubic::turnPlayed` | `{ roundStatus, updatedTileMap? }` |
| `kubic::playerWon` | `{ playerId, winCondition }` |
| `kubic::gameTied` | `{ message }` |
| `kubic::winCount` | `{ winCount }` |
| `kubic::gameStopped` | - |
| `kubic::gameEnded` | `{ participantCount, totalEvents, timestamp, sessionId }` |
| `kubic::timeLeft` | `{ secondsLeft }` |
| `kubic::playerInactive` | `{ sessionId, inactivePlayers: [{ playerId, inactivityStatus }] }` |
| `kubic::restartVoteStarted` | `{ participants }` |
| `kubic::restartVoteUpdate` | `{ participantId, vote }` |
| `kubic::restartVoteResult` | `{ allAgreed, votes }` |

### Subscription-only (game history)

Delivered only to sessions that subscribed (`POST /session/:id/subscribe`, or `KubicKode.subscribeToEvents([...])`), as `kubic::<name>` with payload `{ ...eventPayload, playerId, participantId, timestamp, sessionId }` and `turnNumber: 0`:

`playerAdded`, `gameInstanceStarted`, `gameInstanceReset`, `invalidTurnAttempted`, `participantJoined`, `participantLeft`, and history copies of `turnPlayed`, `playerWon`, `gameTied`, `gameStarted` (sent in addition to the always-sent versions above, with a different payload).
