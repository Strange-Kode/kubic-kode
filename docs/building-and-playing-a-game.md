# Building and Playing a Game

There are two sides to a kubic-kode game, and the framework's generic game routes are the contract between them:

- **Building a game (server side)** - a game class that implements the `GameContract`. The framework wraps it and exposes a generic set of REST routes for the whole lifecycle (start, play a turn, read state, stop).
- **Playing a game (client side)** - a browser client that talks to those routes. You do this through the **KubicKode helper**, which manages tokens, the session, and WebSocket events for you.

This is the path the built-in demos and the test suite use. It differs from the [heads-or-tails tutorial](./heads-or-tails-tutorial.md), which builds its own custom `/hot/...` routes and a hand-rolled client for a small self-contained example. Both are valid; this document describes the generic-route path and its contract.

## Building a game (server side)

Implement the `GameContract` on your game class (see `client/demos/backend-tic-tac-toe/tic-tac-toe.js` for a complete example). The framework handles routing, authentication, participant-to-player mapping, turn-order enforcement, and broadcasting.

### playTurn must return a `PlayStatus`

The turn module calls `.access(...)` on whatever `playTurn` returns, so it **must** be a `PlayStatus` instance (a plain object throws). The route passes your game the engine **player id** and the move data (everything in the request body except `participantId` - so it also includes `gameToken`; read the move fields you care about):

```javascript
import { PlayStatus } from "../../../game-engine/play-status.js";

playTurn(playerId, turnData) {
  const { column } = turnData;
  // ... apply the move ...
  if (won)  return PlayStatus.win(playerId, { winCondition: "four-in-a-row", customData: { column, row } });
  if (full) return PlayStatus.invalid(playerId, "Column is full", { type: "column_full" });
  return PlayStatus.success(playerId, { customData: { column, row } });
}
```

Build the result with the static factories from `game-engine/play-status.js`:

| Factory | Use for | Sets |
|---------|---------|------|
| `PlayStatus.success(playerId, opts)` | a normal move | `playerHasWon: false`, `gameIsTied: false` |
| `PlayStatus.win(playerId, opts)` | a winning move | `playerHasWon: true`, `gameEnded: true` |
| `PlayStatus.tie(playerId, opts)` | a draw | `gameIsTied: true`, `gameEnded: true` |
| `PlayStatus.invalid(playerId, message, opts)` | a rejected move | `status: "invalid"` |
| `PlayStatus.nonCompetitive(playerId, opts)` / `movement(...)` | games with no win/tie concept | - |

- **`playerId` must be a positive integer.** The factories validate it and throw otherwise - so a player entity's id must be a positive int, not a UUID or string. (The demos assign fixed ids, e.g. `1` and `2`.)
- Anything in `opts` (`customData`, `winCondition`, `mark`, `timeLeft`, ...) is returned to the caller, snake-cased; null/undefined fields are omitted. So `PlayStatus.win(...)` above becomes `{ "status": "ok", "player_id": 1, "player_has_won": true, "win_condition": "four-in-a-row", "game_ended": true, "custom_data": { ... } }`.
- Do **not** call `engine.nextTurn()` - the framework advances the turn after `playTurn()` returns.

### Other contract notes

- **`addPlayer(name, isComputer)`** - the framework passes `true` for computer participants, so accept the second argument even in a human-only game.
- **`returnSinglePlayerId`** - by default player-id responses are arrays (`current_player_ids`), because a turn can belong to more than one player in simultaneous play styles. A single-set game can opt into scalar responses (`current_player_id`) by setting the system option in `initializeGameOptions()`:

  ```javascript
  this.getGameOptions().setSystemOption("returnSinglePlayerId", true);
  ```

  It requires the `single-set` play style and exactly one current player.
- **Engine coordinates** - `new GameEngine(width, height, { playStyle })`: the first argument is width (x / columns), the second is height (y / rows). Tiles are addressed `tiles[y][x]` and y increases downward (row 0 is the top). For a gravity game, "lowest empty cell in a column" is the largest available `y`.

## Playing a game (client side)

On the client, use the **KubicKode helper** (`client/kubic-kode-helper/`). It stores the game token, tracks the session, calls the routes, and relays the server's `kubic::` WebSocket events - so you never hand-assemble requests, manage tokens, or wire the socket yourself (the pitfalls a hand-rolled client runs into).

```javascript
import { KubicKode } from "./kubic-kode-helper/index.js"; // or window.KubicKode in a browser build

await KubicKode.initSession("connect-four", { forceNew: true });
await KubicKode.joinSession("Red", "user");   // stores this participant's game token
KubicKode.connectWebSocket();                  // receive real-time updates

KubicKode.events.on("kubic::turnPlayed", () => { /* re-read state and re-render */ });

await KubicKode.startGame();
await KubicKode.route.game("play-turn", { column: 3 }); // helper adds participantId + gameToken
```

- `KubicKode.route.game(action, data)` is the general call for any game route - `"start"`, `"play-turn"`, `"get-current-player"`, `"get-tilemap"`, `"is-active"`, `"options"`, `"stop"`, `"get-player-mappings"`. The helper injects `participantId` and `gameToken` from what it stored at join; you only pass your move/data fields.
- High-level verbs exist too (`initSession`, `joinSession`, `startGame`, ...). `KubicKode.playTurn(x, y)` is coordinate sugar for games registered with the client-side game registry; for anything else use `route.game("play-turn", ...)`.

The helper has much more (reactive state, the full event set, restart voting, chat, config, the client game registry). See the [helper guide](./kubic-kode-helper.md) and the complete [helper reference](./kubic-kode-helper-reference.md).

## The underlying HTTP routes

This is the contract the helper talks to. Use it directly only from a non-JS client, or to understand what the helper is doing. All routes are mounted under `/api` and are **POST only** - the game token travels in the body, so there is no GET form.

| Route | Body | Purpose |
|-------|------|---------|
| `POST /api/game/:sessionId/start` | `participantId`, `gameToken`, `...options` | Start / restart |
| `POST /api/game/:sessionId/play-turn` | `participantId`, `gameToken`, `...moveData` | Play a turn |
| `POST /api/game/:sessionId/stop` | `participantId`, `gameToken` | Stop |
| `POST /api/game/:sessionId/get-current-player` | `gameToken` | Whose turn |
| `POST /api/game/:sessionId/get-tilemap` | `gameToken` | Board (`{ width, height, tiles }`, `tiles[y][x]`) |
| `POST /api/game/:sessionId/get-player-mappings` | `gameToken` | participantId -> playerId map |
| `POST /api/game/:sessionId/is-active` | `gameToken` | `{ is_active }` |
| `POST /api/game/:sessionId/options` | `gameToken` | Current game options |

The `participantId` and `gameToken` come from the join response (`participant_id`, `game_token`); see [Game Token System](./game-token-system.md).

### participant id vs player id

These are different id spaces. The **participant id** identifies someone in the session (from join); the **player id** is the engine's positive integer (what `playTurn` receives and what `get-current-player` returns). The framework bridges them with `getPlayerMappings()` (participantId -> playerId). To decide "is it my turn" from a raw client, fetch `get-player-mappings`, look up your participant's player id, and compare it to `get-current-player` - do **not** compare your participant id to the current player id directly. (The helper handles this for you.)

There is no generic "full game state / stats" route. If a client needs aggregated state (scores, round, winner), expose it from a small custom route built on your game's own methods, or assemble it from the reads above.

## See also

- [Heads or Tails Tutorial](./heads-or-tails-tutorial.md) - an end-to-end build using custom routes
- [Game Token System](./game-token-system.md) - how game tokens are issued and validated
- [Module System](./module-system.md) - the `game`, `turn`, and `player` modules behind these routes
