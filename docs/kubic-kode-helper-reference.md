# KubicKode Helper - API Reference

Complete, flat reference of the client helper's public surface (`client/kubic-kode-helper/`). Written to be dropped into a coding agent's context; for a narrative introduction see the [helper guide](./kubic-kode-helper.md).

Conventions used below:

- `KubicKode` is the singleton (`import { KubicKode } from ".../kubic-kode-helper/index.js"`; also `window.KubicKode` in browsers). `KubicKodeHelper` (the class) and `KubicClientError` are exported alongside it.
- All async methods resolve to `{ success: boolean, data: object }` and throw `KubicClientError` on failure.
- "auth: participant" means the helper auto-injects `participantId` + `gameToken` into the request body; "auth: token" means only `gameToken`. Tokens are read from localStorage on every call.

## Configuration

`KubicKode.configure(options)` merges into `KubicKode.config`. Defaults:

| Key | Default | Meaning |
|-----|---------|---------|
| `apiPrefix` | `"/api"` | Base path for all HTTP calls (same origin) |
| `websocketPort` | `"3000"` | Port for the WebSocket connection |
| `websocketPath` | `"/"` | Socket path (for reverse proxies) |
| `frontendUrl` | `null` | Base URL for `getShareableSessionLink()` |
| `defaultGame` | `null` | Declared but currently unused (`initSession()` falls back to `currentGame`, not this) |
| `autoReconnect` | `true` | Reconnect the socket on unexpected close |
| `retryAttempts` | `3` | HTTP retry count |
| `retryDelay` | `1000` | ms between HTTP retries |
| `autoFetchOnEvents` | `true` | Refresh tilemap/current player on `kubic::turnPlayed` / `kubic::gameStarted` |

Instance fields a consumer may read: `KubicKode.sessionId`, `KubicKode.participantId`, `KubicKode.gameToken`, `KubicKode.currentGame`.

## High-level methods (on the singleton)

Session lifecycle:

| Method | Returns (`data`) | Throws (`code`) |
|--------|------------------|-----------------|
| `initSession(gameId?, { forceNew?, maxPlayers? })` | `{ session_id }`; sets `sessionId`, emits `sessionInitialized` | `GAME_TYPE_REQUIRED` if no gameId and no `currentGame` (set via `game.use()`) |
| `joinSession(name, type = "user")` | `{ participant_id, game_token, is_host? }`; stores token, sets `participantId` | route errors |
| `spectateSession(name)` | `{ participant_id, game_token }` | route errors |
| `joinAsSpectator(name)` | as `spectateSession` | `SPECTATOR_NAME_REQUIRED` |
| `leaveSession()` | `{ }`; clears token + resets `session`/`game` state | `NO_SESSION_TO_LEAVE` |
| `addAIParticipant(name = "AI Opponent")` | `{ participant_id, game_token }` (token stored; does not overwrite yours) | `NO_ACTIVE_SESSION` |
| `syncSessionState(sessionId, participantId)` | `{ sessionId, participantId }`; adopts an existing session (e.g. from a share link) | `SYNC_PARAMS_REQUIRED` |

Session discovery:

| Method | Returns (`data`) |
|--------|------------------|
| `listAllSessions()` | `{ sessions, total_sessions }` |
| `listJoinableSessions()` | `{ sessions, total_sessions, only_joinable: true }` |
| `listSessionsByGame(gameId, onlyJoinable = true)` | `{ sessions, total_sessions }` (throws `GAME_ID_REQUIRED`) |
| `autoJoinSession(gameId, name, type = "user", createIfNone = true)` | `{ session_id, participant_id, session_created, lobby_status, game_token }` (throws `AUTO_JOIN_PARAMS_REQUIRED`) |
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
| `submitRestartVote(voteYes)` | `{ }` | |
| `subscribeToEvents(eventTypes)` / `unsubscribeFromEvents(eventTypes)` | `{ subscribed / unsubscribed, current_subscriptions }` | non-empty string array required |
| `getSubscriptions()` | `{ subscriptions }` | |

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
| `"init"` | GET/POST `/session/init/:gameId` | POST body: `{ forceNew?, maxPlayers? }` |
| `"join"` | POST `/session/:sessionId/join` | `{ participantName, participantType? }`; stores token |
| `"spectate"` | POST `/session/:sessionId/spectate` | `{ participantName }`; stores token |
| `"leave"` | POST `/session/:sessionId/leave` | clears token |
| `"participants"` | GET `/session/:sessionId/participants/list` | |
| `"participant-stats"` | GET `/session/:sessionId/participants/stats` | |
| `"restart-vote"` | GET `/session/:sessionId/request-restart-vote` | |
| `"submit-vote"` | POST `/session/:sessionId/submit-restart-vote` | `{ voteYes }` (participantId auto) |
| `"history"` | POST `/session/:sessionId/history` | optional `{ type, startTime, endTime }` |
| `"list-all"` / `"list-joinable"` | GET `/sessions/list` | joinable adds `?onlyJoinable=true` |
| `"list-by-game"` | GET `/sessions/game/:gameId` | `?onlyJoinable=` |
| `"auto-join"` | POST `/sessions/auto-join/:gameId` | `{ participantName, participantType?, createIfNone? }` |
| `"lobby-status"` | GET `/session/lobby/:sessionId` | |
| `"set-config"` / `"get-config"` / `"delete-config"` | POST / GET / DELETE `/session/:sessionId/config[...]` | host only for mutations |
| `"subscribe"` / `"unsubscribe"` / `"subscriptions"` | POST/POST/GET `/session/:sessionId/subscribe...` | `{ eventTypes: string[] }` |
| `"kick"` | POST `/session/:sessionId/kick` | `{ participantIdToKick }` (hostId auto) |
| `"transfer-host"` | POST `/session/:sessionId/transfer-host` | `{ newHostId }` (currentHostId auto) |
| `"send-chat"` / `"get-chat"` | POST/GET `/session/:sessionId/chat` | `{ message }` / `?limit=N` |

### Client game registry

- `KubicKode.game.register(gameId)` - registers a game id and creates `KubicKode.route[gameId.replace(/-/g, "_")]` with `playTurn(x, y, options)` -> POST `/{gameId}/play-turn/:sessionId` (body `{ participantId, gameToken, xPos, yPos, ...options }`) and `restartGame(options)` -> POST `/{gameId}/restart-game/:sessionId`. These hit the game's **custom** server routes, not the generic `/game/...` ones.
- `KubicKode.game.use(gameId)` - selects the game the high-level `playTurn(x, y)` targets.

## Reactive state namespaces

Each namespace exposes plain properties, methods, a `getState()` snapshot, and `reset()`; changes are announced on `KubicKode.events`.

### `KubicKode.session`

Properties: `id`, `participantId`, `participants`, `maxPlayers`, `isHost`, `isSessionLoading`, `sessionError`.
Methods: `getParticipants()`, `getParticipant(id)`, `isCurrentUserHost()`, `getPlayableParticipants()` (type user|computer), `getSpectators()`, `canAutoStart()`, `isSessionFull()`, `updateSession(data)`, `updateParticipants(list)`, `getState()`, `reset()`.
Emits: `sessionStateUpdated`, `participantsUpdated`, `sessionLoadingChanged`, `sessionErrorChanged`, `sessionReset`.

### `KubicKode.game`

Properties: `started`, `active`, `tilemap` (`tilemap[y][x]`), `currentPlayerId` (engine player id), `playerMappings` (participantId -> playerId), `isGameLoading`, `gameError`, `lastMoveResult`.
Methods: `getTile(x, y)`, `getGridDimensions()` -> `{ rows, cols }`, `updateGame(data)`, `updateTilemap(t)`, `isMyTurn()`, `getCurrentPlayer()`, `getState()`, `reset()`; plus `register`/`use` (registry, above).
Emits: `gameStateUpdated`, `tilemapUpdated`, `gameLoadingChanged`, `gameErrorChanged`, `gameReset`.

Caveat: `isMyTurn()` and `getCurrentPlayer()` compare/look up the engine `currentPlayerId` against **participant** ids, which is an id-namespace mismatch (issue #175). Reliable turn check: `game.currentPlayerId === game.playerMappings[KubicKode.participantId]`.

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
| `kubic::gameStarted` | `{ playerMappings?, updatedTileMap?, inactivityTimeout }` |
| `kubic::turnPlayed` | `{ roundStatus, updatedTileMap? }` |
| `kubic::playerWon` | `{ playerId, winCondition }` |
| `kubic::gameTied` | `{ message }` |
| `kubic::gameStopped` | `{ reason? }` |
| `kubic::winCount` | `{ winCount }` |
| `kubic::sessionParticipantJoined` / `kubic::sessionSpectatorJoined` / `kubic::sessionParticipantLeft` | participant lifecycle |
| `kubic::sessionEnded` | `{ reason?, details? }` |
| `kubic::participantDisconnected` / `kubic::participantReconnected` / `kubic::participantRemoved` | `{ participantId, participantName, ... }` |
| `kubic::connectionConfirmed` | sent to you on socket connect |
| `kubic::participantKicked` | `{ hostId, hostName, kickedParticipant }` |
| `kubic::hostTransferred` | `{ oldHost, newHost, reason }` |
| `kubic::timeLeft` | `{ secondsLeft }` |
| `kubic::playerInactive` | `{ inactivePlayers }` |
| `kubic::restartVoteStarted` / `kubic::restartVoteUpdate` / `kubic::restartVoteResult` | `{ initiatorId, participants }` / `{ participantId, vote }` / `{ allAgreed }` |
| `kubic::lobbyConfigUpdated` / `kubic::lobbyConfigDeleted` | `{ hostId, hostName, changes | deletedKey, fullConfig | remainingConfig }` |
| `kubic::lobbyChatMessage` | `{ message: { id, participantId, participantName, message, timestamp, type } }` |

### Helper-level events (derived locally)

| Event | Payload | Fired |
|-------|---------|-------|
| `websocketConnected` | `{ isReconnect }` | socket open (`isReconnect` is false for the first open after `disconnectWebSocket()`) |
| `websocketDisconnected` | CloseEvent | unexpected socket close only; not fired by `disconnectWebSocket()` or when `connectWebSocket()` replaces a live socket |
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
| `reconnectSynced` / `reconnectSyncFailed` | `{ sessionId, participantId, gameActive }` / `{ error }` | state re-sync after reconnect |
| `participantKicked` | server payload + `isSelf` | after `kubic::participantKicked` |
| `hostTransferred` | server payload + `isHostNow` | after `kubic::hostTransferred` |
| `restartVotingStarted` / `restartVotingUpdated` / `restartVotingCompleted` | `{ initiatorId, participants }` / `{ participantId, vote, allVotes }` / `{ allAgreed, initiatorId }` | voting flow |
| `lobbyConfigUpdated` / `lobbyConfigDeleted` / `lobbyChatMessage` | server payloads | lobby relays |
| state-change events | see each namespace above | `gameStateUpdated`, `sessionStateUpdated`, `winCountsUpdated`, `configUpdated`, ... |

## WebSocket lifecycle

- `KubicKode.connectWebSocket()` - connects to `ws(s)://{hostname}:{config.websocketPort}{config.websocketPath}?sessionId=...[&participantId=...]`. Requires `sessionId`; connect **after joining** so the socket is tied to your participant.
- Heartbeats start automatically when a `participantId` is present: `{ type: "heartbeat" }` every 25 s, answered by `kubic::heartbeatResponse`.
- On unexpected close (code != 1000) the helper reconnects automatically if `config.autoReconnect`, with exponential backoff from 1 s to 30 s plus jitter, reset on the next successful open. `disconnectWebSocket()` closes cleanly (code 1000), cancels a pending reconnect, and leaves `config.autoReconnect` untouched.
- Calling `connectWebSocket()` while a socket is live replaces it: the old socket is detached and closed with code 1000 and never triggers a reconnect or a `websocketDisconnected` event. At most one socket exists per helper.
- `KubicKode.websocket` is the live socket (connecting, open or closing) or `null`, including while a reconnect is pending; `KubicKode.ws.hasLiveSocket()` is the predicate to use.
- A REST fallback heartbeat exists: `KubicKode.sendRestHeartbeat()` -> POST `/session/:sessionId/heartbeat`.

## Tokens, HTTP, errors

- **Tokens** are stored in localStorage under the single key `kubic_game_tokens`, shaped `{ [sessionId]: { [participantId]: token } }`. Managed automatically by join/spectate/leave; `KubicKode.clearAllGameTokens()` wipes them.
- **HTTP**: `_makeRequest(method, endpoint, data?)` targets `{config.apiPrefix}{endpoint}`, JSON in/out, retried `retryAttempts` times, resolving `{ success: true, data }`. Non-2xx throws `KubicClientError` with `code: "HTTP_ERROR"` and `context: { status, statusText, url, method }`.
- **`KubicClientError`**: `new KubicClientError(message, code, context = {})`; fields `name` (`"KubicClientError"`), `message`, `code` (string, e.g. `NO_ACTIVE_SESSION`, `NO_GAME_TOKEN`, `NO_PARTICIPANT_ID`, `UNKNOWN_GAME_ACTION`, `UNKNOWN_SESSION_ACTION`, `GAME_NOT_REGISTERED`, `HTTP_ERROR`), `context`, `timestamp` (ISO string).

## Known caveats

- `game.isMyTurn()` / `game.getCurrentPlayer()` mix the participant and engine player id spaces (#175); use `playerMappings` as shown above.
- `getShareableSessionLink()` is synchronous, unlike every other high-level method.
- `events` has no `once()`; unsubscribe manually with `off()`.
- Ready-check / sync-phase session routes are not yet exposed by the helper (#92).
