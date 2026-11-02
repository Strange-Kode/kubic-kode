# KubicKode Helper - API Reference

Complete, flat reference of the browser helper (`client/kubic-kode-helper/`), the frontend's only interface to a kubic-kode server. Written to be dropped into a coding agent's context. For a walkthrough see [Building a game](./building-a-game.md); for the model behind it, [concepts](./concepts.md).

Conventions used below:

- `KubicKode` is the singleton (`import { KubicKode } from ".../kubic-kode-helper/index.js"`; also `window.KubicKode` in browsers). `KubicKodeHelper` (the class) and `KubicClientError` are exported alongside it; `new KubicKodeHelper()` + `configure(...)` gives an independent second client (e.g. a bot or a second player in tests).
- Outside a browser (Node 22+ for bots/tests) the helper needs `window`, `location` and `localStorage` globals shimmed before import, and its WebSocket keeps the process alive until `disconnectWebSocket()`.
- All async methods resolve to `{ success: boolean, data: object }` and throw `KubicClientError` on failure.
- "auth: participant" means the helper auto-injects `participantId` + `gameToken` into the request body; "auth: token" means only `gameToken`. `route.game` re-reads the token from localStorage on every call; registered-game routes use the in-memory `KubicKode.gameToken`.

## Configuration

`KubicKode.configure(options)` merges into `KubicKode.config`. Defaults:

| Key | Default | Meaning |
|-----|---------|---------|
| `apiPrefix` | `"/api"` | Prefix for all HTTP calls. Relative = same origin; use an absolute URL (`"http://localhost:3000/api"`) when the API is on another origin |
| `websocketPort` | `"3000"` | WebSocket port, on the page's hostname; normally the server's `KUBIC_PORT`. `""` omits the port (same origin, e.g. behind a reverse proxy) |
| `websocketPath` | `"/"` | Socket path (for reverse proxies) |
| `frontendUrl` | `null` | Base URL for `getShareableSessionLink()` |
| `autoReconnect` | `true` | Reconnect the socket on unexpected close |
| `retryAttempts` | `3` | Total HTTP attempts, including the first |
| `retryDelay` | `1000` | ms between attempts |
| `autoFetchOnEvents` | `true` | Re-fetch tilemap + current player on `kubic::turnPlayed`, plus player mappings on `kubic::gameStarted`. (The re-sync on connect fetches regardless) |

Instance fields a consumer may read: `KubicKode.sessionId`, `KubicKode.participantId`, `KubicKode.gameToken`, `KubicKode.currentGame`.

## High-level methods (on the singleton)

Session lifecycle:

| Method | Returns (`data`) | Throws (`code`) |
|--------|------------------|-----------------|
| `initSession(gameId?, { forceNew?, maxPlayers? })` | `{ session_id, session_created }`; sets `sessionId` and `currentGame`, emits `sessionInitialized`. Pass `forceNew: true` to always create a new session (`maxPlayers` applies to new sessions) | `GAME_TYPE_REQUIRED` if no gameId and no `currentGame`; any failure is rewrapped as `SESSION_INIT_FAILED` |
| `joinSession(name, type = "user")` | `{ participant_id, game_token }`; stores token, sets `participantId`, opens the WebSocket | route errors |
| `spectateSession(name)` | `{ participant_id, game_token }`; opens the WebSocket | route errors |
| `joinAsSpectator(name)` | as `spectateSession` | `SPECTATOR_NAME_REQUIRED` |
| `leaveSession()` | `{ success }`; clears the token, `sessionId`, `participantId`, closes the socket, resets every state namespace | `NO_SESSION_TO_LEAVE` |
| `addAIParticipant(name = "AI Opponent")` | `{ participant_id, game_token }` (token stored; does not overwrite yours) | `NO_ACTIVE_SESSION` |
| `syncSessionState(sessionId, participantId)` | `{ sessionId, participantId }`; re-adopts a seat this browser already holds a token for (e.g. after reload) and opens the socket. Resolves `{ success: false, error }` if no token is stored for that seat | `SYNC_PARAMS_REQUIRED` |

Session discovery:

| Method | Returns (`data`) |
|--------|------------------|
| `listAllSessions()` | `{ sessions, total_sessions }` |
| `listJoinableSessions()` | `{ sessions, total_sessions, only_joinable: true }` |
| `listSessionsByGame(gameId, onlyJoinable = true)` | `{ sessions, total_sessions }` (throws `GAME_ID_REQUIRED`) |
| `autoJoinSession(gameId, name, type = "user", createIfNone = true)` | `{ session_id, participant_id, session_created, lobby_status, game_token }`; opens the WebSocket (throws `AUTO_JOIN_PARAMS_REQUIRED`) |
| `checkSessionAvailability(sessionId)` | `{ isAvailable, participantCount, spectatorCount, participants }` |
| `getSessionLobbyStatus(sessionId?)` | `{ lobby }` |
| `getShareableSessionLink({ baseUrl? })` | **synchronous**; `{ sessionId, link }` (throws `FRONTEND_URL_REQUIRED` without `config.frontendUrl`/`baseUrl`) |

Lobby, host, config, chat:

| Method | Returns (`data`) | Notes |
|--------|------------------|-------|
| `getSessionStats()` | `{ maxPlayers, total, players, spectators, canStart, started }` | |
| `getParticipants()` | array of participants | |
| `kickParticipant(participantIdToKick)` | `{ kicked_participant, remaining_participants }` | host only |
| `transferHost(newHostId)` | `{ old_host, new_host }` | host only |
| `setGameConfig(config)` | `{ applied_config, changes, full_config }` | host only; broadcast as `kubic::lobbyConfigUpdated` |
| `getGameConfig()` | `{ config }` | |
| `deleteGameConfigKey(key)` | `{ deleted_key, old_value, remaining_config }` | host only |
| `sendChatMessage(message)` | `{ message }` | 1-500 chars; broadcast as `kubic::lobbyChatMessage` |
| `getChatHistory(limit = 50)` | `{ total_messages, messages }` | server caps at 100 |

Game and history:

| Method | Returns (`data`) | Notes |
|--------|------------------|-------|
| `startGame(options = {})` | `{ game_started, current_player_id(s), ... }` | = `route.game("start", options)` |
| `playTurn(x, y, additionalData = {})` | game-specific | requires `game.register(id)` + `game.use(id)`; posts to the game's **custom** `/{gameId}/play-turn/:sessionId` route. Throws `NO_GAME_SELECTED` / `GAME_NOT_REGISTERED`. For the generic route use `route.game("play-turn", ...)` |
| `getGameHistory({ type? })` | `{ totalEvents, history }` | |
| `requestRestartVote()` | `{ vote_inited }` | |
| `submitRestartVote(voteYes)` | `{ success }` | |
| `subscribeToEvents(eventTypes)` / `unsubscribeFromEvents(eventTypes)` | `{ subscribedEventTypes }` / `{ unsubscribedEventTypes }` | non-empty array of history event names **without** the `kubic::` prefix (e.g. `["playerAdded"]`); applies to the whole session |
| `getSubscriptions()` | `{ subscribedEventTypes, totalSubscriptions }` | |

## Route layer

### `KubicKode.route.game(action, data = {})`

Preconditions: `sessionId` set (`NO_ACTIVE_SESSION`) and a stored token (`NO_GAME_TOKEN`). Unknown action: `UNKNOWN_GAME_ACTION`.

| Action | POST endpoint | Auth | Returns |
|--------|---------------|------|---------|
| `"start"` | `/game/:sessionId/start` | participant | `{ game_started, current_player_id(s), first_player_id(s) }` |
| `"play-turn"` | `/game/:sessionId/play-turn` | participant | snake_cased PlayStatus (`{ status, player_id, player_has_won, ... }`) |
| `"stop"` | `/game/:sessionId/stop` | participant | `{ game_stopped }` |
| `"get-current-player"` | `/game/:sessionId/get-current-player` | token | `{ current_player_id }` or `{ current_player_ids }` |
| `"get-tilemap"` | `/game/:sessionId/get-tilemap` | token | `{ width, height, tiles }` (`tiles[y][x]`) |
| `"is-active"` | `/game/:sessionId/is-active` | token | `{ is_active }` |
| `"options"` | `/game/:sessionId/options` | token | `{ available, options, metadata, lifecycle, modifiable, game_state }` |
| `"get-player-mappings"` | `/game/:sessionId/get-player-mappings` | token | `{ player_mappings }` (participantId -> playerId) |

### `KubicKode.route.session(action, data = {})`

| Action | Method + endpoint | Notes |
|--------|-------------------|-------|
| `"init"` | GET `/session/init/:currentGame` | ignores `data`; use `initSession()` for `forceNew` / `maxPlayers` |
| `"join"` | POST `/session/:sessionId/join` | `{ participantName, participantType? }`; stores token |
| `"spectate"` | POST `/session/:sessionId/spectate` | `{ participantName }`; stores token |
| `"leave"` | POST `/session/:sessionId/leave` | clears token |
| `"participants"` | GET `/session/:sessionId/participants/list` | |
| `"participant-stats"` | GET `/session/:sessionId/participants/stats` | |
| `"restart-vote"` | GET `/session/:sessionId/request-restart-vote` | |
| `"submit-vote"` | POST `/session/:sessionId/submit-restart-vote` | `{ participantId, voteYes }` - not auto-injected; prefer `submitRestartVote()` |
| `"history"` | POST `/session/:sessionId/history` | optional `{ type, startTime, endTime }` |
| `"list-all"` / `"list-joinable"` | GET `/sessions/list` | joinable adds `?onlyJoinable=true` |
| `"list-by-game"` | GET `/sessions/game/:gameId` | `?onlyJoinable=` |
| `"auto-join"` | POST `/sessions/auto-join/:gameId` | `{ participantName, participantType?, createIfNone? }` |
| `"lobby-status"` | GET `/session/:sessionId/lobby` | |
| `"set-config"` / `"get-config"` / `"delete-config"` | POST / GET / DELETE `/session/:sessionId/config[...]` | host only for mutations |
| `"subscribe"` / `"unsubscribe"` / `"subscriptions"` | POST/POST/GET `/session/:sessionId/subscribe...` | `{ eventTypes: string[] }` |
| `"kick"` | POST `/session/:sessionId/kick` | `{ participantIdToKick }` (hostId auto) |
| `"transfer-host"` | POST `/session/:sessionId/transfer-host` | `{ newHostId }` (currentHostId auto) |
| `"send-chat"` / `"get-chat"` | POST/GET `/session/:sessionId/chat` | `{ message }` / `?limit=N` |

The ready-check / sync-phase routes have no helper action; call them directly ([server reference](./server-reference.md#session-routes)).

### Client game registry

- `KubicKode.game.register(gameId)` - registers a game id and creates `KubicKode.route[gameId.replace(/-/g, "_")]` with `playTurn(x, y, options)` -> POST `/{gameId}/play-turn/:sessionId` (body `{ participantId, gameToken, xPos, yPos, ...options }`) and `restartGame(options)` -> POST `/{gameId}/restart-game/:sessionId`. These hit the game's **custom** server routes, not the generic `/game/...` ones.
- `KubicKode.game.use(gameId)` - selects the game the high-level `playTurn(x, y)` targets.

## Reactive state namespaces

Each namespace exposes plain properties, methods and a `getState()` snapshot (all but `inactivity` also have `reset()`); changes are announced on `KubicKode.events`.

How much state the helper keeps is up to the app:

- **Default:** built-in handlers keep the namespaces below up to date, re-fetch the board and current player on game events, and emit the derived helper-level events (`gameEnded`, `turnUpdated`, `restartVotingCompleted`, ...).
- **`configure({ autoFetchOnEvents: false })`:** the handlers still run, but don't re-fetch over HTTP. For apps that fetch game state themselves.
- **`KubicKode.flow.teardownEventHandlers()`:** removes the built-in handlers entirely. The namespaces and derived events stop updating; raw `kubic::` server events still arrive on `KubicKode.events`. For apps that manage all state themselves. `flow.setupEventHandlers()` re-attaches them.

### `KubicKode.session`

Properties: `id`, `participantId`, `participants`, `maxPlayers`, `isHost`, `isSessionLoading`, `sessionError`.
Methods: `getParticipants()`, `getParticipant(id)`, `isCurrentUserHost()`, `getPlayableParticipants()` (type user|computer), `getSpectators()`, `canAutoStart()`, `isSessionFull()`, `updateSession(data)`, `updateParticipants(list)`, `getState()`, `reset()`.
Emits: `sessionStateUpdated`, `participantsUpdated`, `sessionLoadingChanged`, `sessionErrorChanged`, `sessionReset`.

### `KubicKode.game`

Properties: `started`, `active`, `tilemap` (`tilemap[y][x]`), `currentPlayerId` (engine player id), `playerMappings` (participantId -> playerId), `isGameLoading`, `gameError`, `lastMoveResult`.
Methods: `getTile(x, y)`, `getGridDimensions()` -> `{ rows, cols }`, `updateGame(data)`, `updateTilemap(t)`, `isMyTurn()`, `getCurrentPlayer()`, `getState()`, `reset()`; plus `register`/`use` (registry, above).
Emits: `gameStateUpdated`, `tilemapUpdated`, `gameLoadingChanged`, `gameErrorChanged`, `gameReset`.

### `KubicKode.voting`

Properties: `isActive`, `initiatorId`, `votes` (participantId -> boolean), `voteCount`.
Methods: `initiate()` (starts a vote and auto-casts your yes), `vote(voteYes)`, `getState()`, `reset()`.
Emits: `restartVoteInitiated`, `restartVoteSubmitted`.

### `KubicKode.wins`

Properties: `playerWinCounts` (playerId -> count), `totalGames`, `isLoading`, `error`.
Methods: `getWinCountForPlayer(playerId)`, `getTotalGames()`, `getWinPercentage(playerId)`, `refreshWinCounts()`, `updateWinCounts(data)`, `getState()`, `reset()`.
Emits: `winCountsUpdated`, `winsLoadingChanged`, `winsErrorChanged`, `winsReset`.

### `KubicKode.sessionConfig`

Properties: `config` (arbitrary key-value), `isLoading`, `error`.
Methods: `getConfigValue(key)`, `updateConfig(partial)`, `setConfig(full)`, `deleteConfigKey(key)`, `getState()`, `reset()`.
Emits: `configUpdated`, `configKeyDeleted`, `configLoadingChanged`, `configErrorChanged`, `configReset`.

### `KubicKode.inactivity`

Properties: `timerSeconds` (last authoritative server value), `lastUpdate`.
Methods: `getLiveTimer()` (locally interpolated seconds remaining, `null` when inactive), `updateTimer(seconds)`, `clearTimer()`, `getState()`.
Emits: `inactivityTimerUpdated`, `inactivityTimerCleared`.

### `KubicKode.flow`

Properties: `gamePhase` (`null | "active" | "ended" | "session-ended"`), `winner`, `autoStartEnabled`, `autoStartMode`.
Methods: `getSessionPhase()` (`"loading" | "error" | "initializing" | "lobby" | "active"`), `getGamePhase()`, `configure({ autoStartEnabled?, autoStartMode? })`, `shouldAutoStart()`, `checkAndAutoStart()`, `getState()`, `reset()`, `setupEventHandlers()` / `teardownEventHandlers()` (wired automatically on construction).
Auto-start modes: `"on-full"` (default: start when playable count reaches `maxPlayers`), `"on-ai"` (when an AI joins and the session is full), `"immediate"` (>= 1 participant), `"manual"` (never).
Emits: `gameAutoStarted`, `flowReset`.

## Events

`KubicKode.events.on(name, cb)` / `.off(name, cb)` / `.emit(name, data)` - all return the helper for chaining. No `once()`. Callback errors are caught and logged, never thrown.

### Server broadcasts (relayed as-is, `kubic::` prefix)

| Event | Payload highlights |
|-------|--------------------|
| `kubic::gameStarted` | `{ playerMappings, inactivityTimeout }` |
| `kubic::turnPlayed` | `{ roundStatus, updatedTileMap? }` |
| `kubic::playerWon` | `{ playerId, winCondition }` |
| `kubic::gameTied` | `{ message }` |
| `kubic::gameStopped` | no payload |
| `kubic::winCount` | `{ winCount }` |
| `kubic::sessionParticipantJoined` / `kubic::sessionSpectatorJoined` / `kubic::sessionParticipantLeft` | participant lifecycle |
| `kubic::sessionEnded` | `{ reason, message, connectedParticipants, requiredParticipants }` |
| `kubic::participantDisconnected` / `kubic::participantReconnected` / `kubic::participantRemoved` | `{ participantId, participantName, ... }` |
| `kubic::connectionConfirmed` | sent to you on socket connect |
| `kubic::participantKicked` | `{ hostId, hostName, kickedParticipant }` |
| `kubic::hostTransferred` | `{ oldHost, newHost, reason }` |
| `kubic::timeLeft` | `{ secondsLeft }` |
| `kubic::playerInactive` | `{ inactivePlayers }` |
| `kubic::restartVoteStarted` / `kubic::restartVoteUpdate` / `kubic::restartVoteResult` | `{ participants }` / `{ participantId, vote }` / `{ allAgreed, votes }` |
| `kubic::lobbyConfigUpdated` / `kubic::lobbyConfigDeleted` | `{ hostId, hostName, changes | deletedKey, fullConfig | remainingConfig }` |
| `kubic::lobbyChatMessage` | `{ message: { id, participantId, participantName, message, timestamp, type } }` |

### Helper-level events (derived locally)

| Event | Payload | Fired |
|-------|---------|-------|
| `websocketConnected` | `{ isReconnect }` | socket open (`isReconnect` is false for the first open after `disconnectWebSocket()`) |
| `websocketDisconnected` | CloseEvent | unexpected socket close only; not fired by `disconnectWebSocket()` or when `connectWebSocket()` replaces a live socket |
| `websocketRefused` | `{ code, reason }` | server refused the seat (code 4401); replaces `websocketDisconnected`, never retried |
| `websocketError` | Error | socket error |
| `sessionInitialized` | `{ sessionId }` | after `/session/init/*` |
| `gameEnded` | `{ winner, isTie, reason? }` | win, tie, or inactivity ending |
| `gameStopped` | server payload | after `kubic::gameStopped` |
| `turnUpdated` | server payload | after `kubic::turnPlayed` |
| `gameAutoStarted` | - | flow auto-start succeeded |
| `gameReEnabled` | - | game re-armed after start |
| `gameDisabledByInactivity` | - | after `kubic::playerInactive` |
| `inactivityTimerUpdate` | `{ secondsLeft }` | timer ticks / resets |
| `sessionTerminated` | `{ reason, details }` | after `kubic::sessionEnded` |
| `participantConnectionChanged` | `{ type: "disconnected"\|"removed"\|"reconnected", participantId, ... }` | unified connection changes |
| `reconnectSynced` / `reconnectSyncFailed` | `{ sessionId, participantId, gameActive }` / `{ error }` | after every `kubic::connectionConfirmed`, once participants (and, mid-game, tilemap + current player) are re-fetched |
| `participantKicked` | server payload + `isSelf` | after `kubic::participantKicked` |
| `hostTransferred` | server payload + `isHostNow` | after `kubic::hostTransferred` |
| `restartVotingStarted` / `restartVotingUpdated` / `restartVotingCompleted` | `{ initiatorId, participants }` / `{ participantId, vote, allVotes }` / `{ allAgreed, initiatorId }` | voting flow |
| `lobbyConfigUpdated` / `lobbyConfigDeleted` / `lobbyChatMessage` | server payloads | lobby relays |
| state-change events | see each namespace above | `gameStateUpdated`, `sessionStateUpdated`, `winCountsUpdated`, `configUpdated`, ... |

## WebSocket lifecycle

- `joinSession`, `spectateSession`, `autoJoinSession` and `syncSessionState` open the socket for you. `KubicKode.connectWebSocket()` does it manually: `ws(s)://{page hostname}:{config.websocketPort}{config.websocketPath}?sessionId=...&participantId=...&gameToken=...`. A seat whose token is missing or wrong is closed with code 4401, emits `websocketRefused`, and is not retried.
- Heartbeats start automatically when a `participantId` is present: `{ type: "heartbeat" }` every 25 s, answered by `kubic::heartbeatResponse`.
- On unexpected close (code != 1000) the helper reconnects automatically if `config.autoReconnect`, with exponential backoff from 1 s to 30 s plus jitter, reset on the next successful open. `disconnectWebSocket()` closes cleanly (code 1000), cancels a pending reconnect, and leaves `config.autoReconnect` untouched.
- Calling `connectWebSocket()` while a socket is live replaces it: the old socket is detached and closed with code 1000 and never triggers a reconnect or a `websocketDisconnected` event. At most one socket exists per helper.
- `KubicKode.websocket` is the live socket (connecting, open or closing) or `null`, including while a reconnect is pending; `KubicKode.ws.hasLiveSocket()` is the predicate to use.
- A REST fallback heartbeat exists: `KubicKode.sendRestHeartbeat()` -> POST `/session/:sessionId/heartbeat`.

## Tokens, HTTP, errors

- **Tokens** are stored in localStorage under the single key `kubic_game_tokens`, shaped `{ [sessionId]: { [participantId]: token } }`. Managed automatically by join/spectate/leave; `KubicKode.clearAllGameTokens()` wipes them.
- **HTTP**: `_makeRequest(method, endpoint, data?)` targets `{config.apiPrefix}{endpoint}`, JSON in/out, retried `retryAttempts` times, resolving `{ success: true, data }`. Non-2xx throws `KubicClientError` with `code: "HTTP_ERROR"` and `context: { status, statusText, url, method }`.
- **`KubicClientError`**: `new KubicClientError(message, code, context = {})`; fields `name` (`"KubicClientError"`), `message`, `code` (string: `HTTP_ERROR` for non-2xx responses; client-side preconditions such as `NO_ACTIVE_SESSION`, `NO_GAME_TOKEN`, `NO_PARTICIPANT_ID`, `GAME_NOT_REGISTERED`, `UNKNOWN_GAME_ACTION`, `UNKNOWN_SESSION_ACTION`, `MESSAGE_TOO_LONG`, `EVENT_TYPES_INVALID`; and the rewraps `SESSION_INIT_FAILED`, `SESSION_AVAILABILITY_CHECK_FAILED`), `context`, `timestamp` (ISO string).
