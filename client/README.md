# The kubic-kode-helper SDK

This is the frontend SDK for talking to a KubicKode game server. It gives your browser (or Node) client a single, friendly object that knows how to create game sessions, join them, play turns, manage a lobby, and listen for everything the server broadcasts in real time over a WebSocket. Instead of hand-rolling `fetch` calls and a WebSocket connection, you reach for one helper and let it wire the HTTP and socket layers together for you.

The rest of this document walks through it from the top: how to bring it into your project, how it is configured, a minimal working example that connects to a running backend, the complete list of convenience methods, how the event system works, what `getState()` gives you, and finally a short troubleshooting section grounded in the actual error codes the SDK throws.

## What it is and how to import it

The entry point is `client/kubic-kode-helper/index.js`. It is authored as an ES module - the file uses top-level `import`/`export` statements - so the supported, no-build-step way to load it is as an ES module:

```js
import { KubicKode, KubicKodeHelper, KubicClientError } from "./kubic-kode-helper/index.js";
```

It exports exactly three names: `KubicKode`, `KubicKodeHelper`, and `KubicClientError`. The important distinction is that `KubicKodeHelper` is the class, while `KubicKode` is a ready-made singleton instance of that class created for you at import time. For almost everything you will just use the `KubicKode` singleton. You only reach for the `KubicKodeHelper` class directly if you want to construct your own separate instance (for example, to drive two independent sessions in the same page). `KubicClientError` is the custom error type the SDK throws, so you import it when you want to catch and inspect errors by their `code`.

The file also wraps its exports in a UMD factory that nominally targets CommonJS (`require`), AMD (`define`), and a browser global (`window.KubicKode`). Be aware, though, that because the entry file itself uses ES-module syntax, those non-ESM targets only work when you run the SDK through a bundler or transpiler that resolves the ES imports first. A raw `require()` or a classic `<script src="...index.js">` tag pointed straight at the unbundled file will fail to parse. In short: import it as an ES module directly, or run it through your bundler for any other environment.

## Configuration

Every helper starts from a built-in `DEFAULT_CONFIG`, and the defaults are chosen so that a same-origin deployment needs almost no configuration at all.

The HTTP side is governed by `apiPrefix`, which defaults to `/api`. Every REST request the SDK makes is built as `apiPrefix + endpoint`, so with the default a call to initialize a session hits `/api/session/init/...` on whatever origin served your page. Because it is a relative path, the browser resolves it against the current origin automatically. If your API lives on a different origin, set `apiPrefix` to an absolute URL.

The WebSocket side is governed by two options. `websocketPort` defaults to `"3000"`, and `websocketPath` defaults to `"/"`. When the socket connects, the SDK takes the current page protocol (upgrading `https:` to `wss` and otherwise using `ws`), reuses the page hostname, then appends the configured port and path. So with the defaults, a page served from `http://localhost` connects its socket to `ws://localhost:3000/`. The connection query string carries the `sessionId` and, once you have one, the `participantId`.

The reason the default port is `3000` is that it must match the backend. In the backend `.env` the relevant variable is `KUBIC_PORT`, and `.env.example` ships it as `KUBIC_PORT=3000`. The WebSocket server listens on that port, so `websocketPort` on the client has to point at the same number. If you change `KUBIC_PORT` on the server, change `websocketPort` on the client to match, or the socket will try to connect to a port nothing is listening on. The `websocketPath` option exists mainly for reverse-proxy setups where the socket is exposed under a path other than `/`.

The remaining defaults round out behavior. `frontendUrl` is `null` and is only used to build shareable session links; you set it to your app's public URL when you want `getShareableSessionLink()` to work. `defaultGame` is `null`. `autoReconnect` is `true`, which means a dropped socket (any close code other than a clean `1000`) is retried after a short delay; a manual disconnect flips this off so it does not fight you. `retryAttempts` is `3` and `retryDelay` is `1000` milliseconds, which together govern the HTTP client's retry loop. Finally, `autoFetchOnEvents` is `true`; when you set it to `false`, the SDK's event handlers stop auto-fetching game state (tilemap, current player, and so on) while still running their non-fetch side effects - useful when your host app manages its own state sync.

You override any of these in one of two ways. You can pass an `apiPrefix` string straight to the constructor when building your own instance, or, more commonly, you call `configure()` on the singleton with an options object that is merged over the existing config. `configure()` returns the helper so you can chain it:

```js
KubicKode.configure({
  websocketPort: "8080",
  frontendUrl: "https://play.example.com",
});
```

## A minimal working example

Here is the smallest realistic flow against a running backend, using the real registered game id `tic-tac-toe-classic`. The shape to keep in mind is: pick the game, initialize a session, join it, then play. The WebSocket does not open during init; it opens the moment you successfully join (or spectate, or auto-join), because that is the first point at which the SDK has both a `sessionId` and a `participantId` to identify the connection.

```js
import { KubicKode, KubicClientError } from "./kubic-kode-helper/index.js";

async function main() {
  try {
    // 1. Tell the SDK which game we are playing. register() wires up the
    //    game-specific routes (this is what playTurn needs), and use() marks
    //    it as the current game.
    KubicKode.game.register("tic-tac-toe-classic");
    KubicKode.game.use("tic-tac-toe-classic");

    // 2. Create (or reuse) a session for that game. No socket yet.
    await KubicKode.initSession("tic-tac-toe-classic");

    // 3. Join as a participant. THIS is where the WebSocket connects,
    //    because we now have both a sessionId and a participantId.
    await KubicKode.joinSession("Alice");

    // 4. Listen for the server broadcasting a played turn.
    KubicKode.events.on("kubic::turnPlayed", (payload) => {
      console.log("A turn was played:", payload);
    });

    // 5. Play a turn. The two numbers are handed straight through to the
    //    game; their meaning (here, a board cell) is defined by the game,
    //    not by the SDK.
    await KubicKode.playTurn(1, 1);
  } catch (error) {
    if (error instanceof KubicClientError) {
      // Every SDK-thrown error carries a stable code and a context object.
      console.error(`KubicKode error [${error.code}]:`, error.message, error.context);
    } else {
      console.error("Unexpected error:", error);
    }
  }
}

main();
```

A couple of things worth internalizing from this. You must both `register` and `use` the game: `use` sets `currentGame` so the SDK knows which game `playTurn` belongs to, and `register` creates the underlying per-game route (the SDK derives the route key by replacing hyphens with underscores, so `tic-tac-toe-classic` becomes the internal `tic_tac_toe_classic` route). Calling `playTurn` before both have happened throws a `KubicClientError`. And because `joinSession` is what opens the socket, any server event listeners you register will only start firing after a successful join.

## The complete convenience API

These are all 31 high-level methods attached directly to the `KubicKode` instance. They are derived from `convenience/high-level-api.js`, and the list below is exhaustive. Grouped by what they do:

Session lifecycle:

- `initSession(gameId, options)` - create or reuse a session for a game; pass `{ forceNew: true }` to force a brand-new one. Sets `sessionId`.
- `joinSession(participantName, participantType)` - join as a participant ("user" by default), set `participantId`, and open the WebSocket.
- `spectateSession(participantName)` - join as a spectator and open the WebSocket.
- `joinAsSpectator(spectatorName)` - validated alias that delegates to `spectateSession`.
- `leaveSession()` - leave the current session, clear all state, and disconnect the socket.
- `addAIParticipant(aiName)` - add a computer participant (participant type "computer") to the current session.
- `autoJoinSession(gameId, participantName, participantType, createIfNone)` - find and join the best available session for a game, optionally creating one if none exist; opens the socket on success.
- `syncSessionState(newSessionId, newParticipantId)` - adopt an existing session/participant pair (for reconnection), refresh stats, and connect the socket if needed.

Reading session and game info:

- `getSessionStats()` - session statistics such as max players.
- `getParticipants()` - the list of participants in the session.
- `getGameHistory(options)` - game history, optionally filtered by event `type`.
- `checkSessionAvailability(targetSessionId)` - whether a given session has room to join, with participant and spectator counts.
- `getSessionLobbyStatus(sessionId)` - detailed lobby status for a session (defaults to the current one).
- `listAllSessions()` - every session across all games.
- `listJoinableSessions()` - only sessions that can currently be joined.
- `listSessionsByGame(gameId, onlyJoinable)` - sessions filtered to a single game type.

Gameplay:

- `startGame(options)` - start the game in the current session.
- `playTurn(x, y, additionalData)` - play a move for the current game; `x` and `y` are passed straight through to the game, which defines what they mean.
- `requestRestartVote()` - open a restart vote for the session.
- `submitRestartVote(voteYes)` - cast your yes/no vote in an open restart vote.

Lobby configuration (host-oriented):

- `setGameConfig(config)` - apply a lobby config object (host only); caches the result locally.
- `getGameConfig()` - read the current lobby config; caches the result locally.
- `deleteGameConfigKey(configKey)` - remove a single config key (host only).

Host moderation:

- `kickParticipant(participantIdToKick)` - remove a participant (host only).
- `transferHost(newHostId)` - hand host privileges to another playable participant (host only).

Lobby chat:

- `sendChatMessage(message)` - post a chat message (1-500 chars after trim) to the lobby; triggers a `kubic::lobbyChatMessage` broadcast.
- `getChatHistory(limit)` - fetch recent chat (client default 50; the server retains the last 100 in memory).

Event subscriptions (server-side broadcast filtering):

- `subscribeToEvents(eventTypes)` - restrict which game-history event types get broadcast to this client.
- `unsubscribeFromEvents(eventTypes)` - drop event types from the broadcast set.
- `getSubscriptions()` - read the server's current view of your subscriptions (not cached locally).

Sharing:

- `getShareableSessionLink(options)` - build a `?session=<id>` link from `options.baseUrl` or the configured `frontendUrl`.

Below these, the lower-level route helpers `KubicKode.route.session(action, data)` and `KubicKode.route.game(action, data)` are also available if you need to reach an endpoint the convenience methods do not wrap, and `KubicKode.game.register(gameId)` / `KubicKode.game.use(gameId)` manage game registration as shown in the example.

## The event system

The helper carries its own tiny event emitter, exposed as `KubicKode.events`, with three methods. `events.on(eventType, callback)` registers a listener for a named event. `events.off(eventType, callback)` removes a previously registered listener (it must be the same function reference you passed to `on`). And `events.emit(eventType, data)` fires an event to every listener registered for that name. All three return the helper, so they chain, and `emit` wraps each callback in a try/catch so a throwing listener cannot break the dispatch loop or starve the listeners after it.

What matters in practice is that there are two distinct categories of events flowing through this one emitter, and they are distinguished by their names.

The first category is the server broadcasts. These arrive over the WebSocket and are re-emitted under their full original name, including the `kubic::` prefix. So you listen with the prefix exactly as the server sends it. The real broadcast names the server emits are: `kubic::connectionConfirmed`, `kubic::gameEnded`, `kubic::gameInstanceReset`, `kubic::gameInstanceStarted`, `kubic::gameStarted`, `kubic::gameStopped`, `kubic::gameTied`, `kubic::heartbeat`, `kubic::heartbeatResponse`, `kubic::hostTransferred`, `kubic::invalidTurnAttempted`, `kubic::lobbyChatMessage`, `kubic::lobbyConfigDeleted`, `kubic::lobbyConfigUpdated`, `kubic::participantDisconnected`, `kubic::participantForceDisconnected`, `kubic::participantKicked`, `kubic::participantReadyChanged`, `kubic::participantReconnected`, `kubic::participantRemoved`, `kubic::playerAdded`, `kubic::playerInactive`, `kubic::playerWon`, `kubic::restartVoteCleared`, `kubic::restartVoteRegistered`, `kubic::restartVoteResult`, `kubic::restartVoteStarted`, `kubic::restartVoteUpdate`, `kubic::sessionEnded`, `kubic::sessionParticipantJoined`, `kubic::sessionParticipantLeft`, `kubic::sessionSpectatorJoined`, `kubic::syncPhaseStarted`, `kubic::timeLeft`, `kubic::turnPlayed`, and `kubic::winCount`. The heartbeat-related ones (`kubic::heartbeat` and `kubic::heartbeatResponse`) are handled internally by the socket client to keep the connection alive, and `kubic::sessionEnded` gets special handling that also stops the heartbeat, but the rest are simply forwarded to your listeners with their payload.

The second category is local SDK lifecycle events, which have no prefix. These are emitted by the SDK itself as its internal state changes, and they are how you observe the helper rather than the server. The socket lifecycle ones are the most commonly used: `websocketConnected` (its payload tells you whether this was a reconnect), `websocketDisconnected`, and `websocketError`. There is also `sessionInitialized`, which fires when a session id is established. Beyond those, the SDK emits a broad set of state-change notifications as its internal modules update, including (among others) `sessionStateUpdated`, `sessionReset`, `gameStateUpdated`, `gameReset`, `gameAutoStarted`, `tilemapUpdated`, `turnUpdated`, `winCountsUpdated`, `participantsUpdated`, `participantConnectionChanged`, `restartVotingStarted`, `restartVotingUpdated`, `restartVotingCompleted`, `lobbyConfigUpdated`, `lobbyConfigDeleted`, `lobbyChatMessage`, `inactivityTimerUpdated`, and `reconnectSynced`. The reliable rule of thumb is simple: a name with `kubic::` came from the server, and a name without it came from the SDK. One caveat: a handful of base names (`gameEnded`, `gameStopped`, `hostTransferred`, `lobbyChatMessage`, `lobbyConfigDeleted`, `lobbyConfigUpdated`, and `participantKicked`) are emitted in both forms, and the prefixed server event and the unprefixed local event can carry different payload shapes. When you specifically want the raw server payload, listen to the `kubic::`-prefixed name.

```js
// Server broadcast (note the kubic:: prefix):
KubicKode.events.on("kubic::playerWon", (payload) => updateScoreboard(payload));

// Local SDK lifecycle event (no prefix):
KubicKode.events.on("websocketConnected", ({ isReconnect }) => {
  console.log(isReconnect ? "Reconnected" : "Connected");
});
```

## Inspecting state with getState()

When you need a snapshot of everything the helper currently believes, call `KubicKode.getState()`. It returns a plain object rolling up the core identifiers and every state module at once. At the top level you get `sessionId`, `currentGame`, `registeredGames` (an array of the game ids you have registered), the full `config`, and a `hasGameToken` boolean indicating whether a game token is currently held. Nested under that are the individual module snapshots: `session`, `game`, `wins`, `voting`, `flow`, `inactivity`, and `sessionConfig`, each produced by that module's own `getState()`. The snapshot is assembled from live internal references rather than deep copies (notably `config` is the helper's actual config object), so treat it as read-only: mutating what you get back will mutate the helper's internal state. It is ideal for debugging or for hydrating a UI on load.

## Troubleshooting

Most problems map cleanly onto either a configuration mismatch or a method called out of order, and the SDK is fairly explicit about the latter through its error codes.

The classic configuration mismatch is the WebSocket never connecting because the port is wrong. The client defaults to `websocketPort: "3000"` precisely because the backend ships `KUBIC_PORT=3000`. If you changed `KUBIC_PORT` on the server but left the client default in place (or vice versa), the socket will try a port nothing is listening on and quietly fail or emit `websocketError`. The fix is to make `websocketPort` equal to the backend's `KUBIC_PORT`. In a reverse-proxy deployment where the socket is not at the root, set `websocketPath` to match the proxied path as well.

A subtler version of "the socket is not connecting" is that you simply have not joined yet. The socket only opens once both a `sessionId` and a `participantId` exist, which happens inside `joinSession`, `spectateSession`, and `autoJoinSession`. Calling `initSession` alone gives you a session but no participant, so no socket. If your `kubic::`-prefixed listeners never fire, check that a join has actually completed.

Playing a turn before the game is set up is the most common ordering mistake. If `currentGame` has not been set, `playTurn` throws a `KubicClientError` with code `NO_GAME_SELECTED` and the suggestion to call `KubicKode.game.use(gameId)` first. If you set the current game with `use` but never registered it, `playTurn` instead throws `GAME_NOT_REGISTERED`, telling you to call `game.register(...)`. The cure for both is the two-line setup from the example: register and use the game before you try to move. Likewise, `initSession` with no game argument and no current game throws `GAME_TYPE_REQUIRED`.

Several methods require an active session and will refuse to run without one, throwing `KubicClientError` with code `NO_ACTIVE_SESSION`; these include `addAIParticipant`, `getSessionStats`, `getParticipants`, `getGameHistory`, `requestRestartVote`, and `getShareableSessionLink`. The remedy is to initialize (and usually join) a session first. Closely related, `leaveSession` with nothing to leave throws `NO_SESSION_TO_LEAVE`, and `submitRestartVote` without a participant id throws `NO_PARTICIPANT_ID`.

Trying to build a shareable link without a destination throws `FRONTEND_URL_REQUIRED`. Pass an explicit `baseUrl` to `getShareableSessionLink({ baseUrl })`, or configure it once with `KubicKode.configure({ frontendUrl: "https://yourapp.com" })`.

Finally, HTTP failures surface through the retry loop in the HTTP client. A non-OK response is wrapped as a `KubicClientError` with code `HTTP_ERROR` and a context object carrying the `status`, `statusText`, `url`, and `method`, and the request is retried up to `retryAttempts` times spaced by `retryDelay` before the last error is thrown. When you catch one of these, inspect `error.code` and `error.context` to see exactly which request failed and why. A repeated `HTTP_ERROR` against a `/api/...` URL usually means the API is not reachable at that origin; confirm the backend is running and that `apiPrefix` resolves to where the API actually lives.
