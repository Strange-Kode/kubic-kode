# Building a Game

A complete small game: **Nim**. Seven stones in a row; players take turns removing 1-3; whoever takes the last stone wins. You write two server files and one page; kubic-kode handles sessions, turn order, tokens, the computer opponent, restarts and real-time updates.

Read [concepts](./concepts.md) first if you haven't. For a bigger example, see the tic-tac-toe demo in `client/demos/backend-tic-tac-toe/`.

## Setup

Vendor kubic-kode into a new project (see the [README](../README.md#using-kubic-kode-in-your-own-project)):

```text
nim/
├── kubic-kode/        git submodule, with its own `npm install`
├── public/index.html
├── nim.js
├── server.js
├── package.json       { "type": "module", "dependencies": { "kubic-kode": "file:./kubic-kode" } }
└── .env               KUBIC_GAME_TOKEN_SECRET_KEY=<32+ characters>
```

## 1. The game class (`nim.js`)

```javascript
import { gameEngine, gameEntity, playStatus } from "kubic-kode";

const { GameEngine } = gameEngine;
const { GameEntity } = gameEntity;
const { PlayStatus } = playStatus;

const STONES = 7;

class Player extends GameEntity {
  constructor(id, name, isComputer) {
    super(id, name, null);
    this.computer = isComputer;
  }
  getPlayerId() { return this.getEntityId(); }
  getPlayerName() { return this.getEntityName(); }
  getPlayerType() { return this.computer ? "computer" : "user"; }
  toJSON() { return { id: this.getPlayerId(), name: this.getPlayerName() }; }
}

export class NimGame {
  constructor() {
    // One row of tiles; a tile holding "stone" is a stone still on the table.
    this.engine = new GameEngine(STONES, 1, { playStyle: "single-set" });
    this.nextId = 1;
  }

  getGameEngine() { return this.engine; }
  requiredPlayers() { return 2; }

  addPlayer(name, isComputer = false) {
    // Called again for the same participants on every restart: keep ids stable.
    const existing = this.engine.getPlayerEntities().find((p) => p.getPlayerName() === name);
    if (existing) return existing;
    const player = new Player(this.nextId++, name, isComputer);
    this.engine.registerPlayerEntity(player);
    return player;
  }

  startGame() {
    // Runs on the first start and on every restart.
    const tiles = this.engine.getTileMap();
    for (let x = 0; x < STONES; x++) tiles.setTile(x, 0, "stone");
    this.engine.startGame();
  }

  resetForRestart() {}

  stonesLeft() {
    return this.engine.getTileMap().getOccupiedCount();
  }

  playTurn(playerId, { take }) {
    // No moves once the game is over.
    if (!this.engine.isGameStarted()) return PlayStatus.invalid(playerId, "Game is over");
    const left = this.stonesLeft();
    if (![1, 2, 3].includes(take) || take > left) {
      return PlayStatus.invalid(playerId, `Take 1-${Math.min(3, left)} stones`);
    }
    for (let i = 0; i < take; i++) this.engine.getTileMap().setTile(left - 1 - i, 0, null);

    if (this.stonesLeft() === 0) {
      this.engine.stopGame(); // the game stops its own engine when it ends
      return PlayStatus.win(playerId, { winCondition: "last-stone" });
    }
    return PlayStatus.success(playerId, { customData: { stonesLeft: this.stonesLeft() } });
  }

  calculateComputerMove() {
    // Must always return a move.
    return { take: this.stonesLeft() % 4 || 1 };
  }
}
```

What the framework does around this class:

- **Who may move.** `playTurn` is only called for the current player; turn order advances after it returns. Never call `engine.nextTurn()` yourself, and reject moves once the game is over (the `isGameStarted()` guard).
- **The move.** `{ take }` is the move the client sent to `play-turn`.
- **Results.** `PlayStatus.invalid` rejects the move without advancing the turn. `PlayStatus.win` ends the game and is broadcast as `kubic::playerWon`.
- **Computer seats.** When a computer participant is to move, the framework asks `calculateComputerMove` and plays the result.
- **Restarts** call `addPlayer` for every participant again, then `startGame`.

Every method and rule is listed in the [server reference](./server-reference.md#game-contract).

## 2. The server (`server.js`)

```javascript
import { gameRegistry, createGameServer, getKubicKodeModulesPath } from "kubic-kode";
import { NimGame } from "./nim.js";

gameRegistry.register("nim", () => new NimGame());

await createGameServer({
  modulesPath: getKubicKodeModulesPath(),
  corsOrigins: ["http://localhost:5173"], // where your page is served from
});
```

Run it with `node server.js`. It listens on port 3000 (`KUBIC_PORT`). Add `KUBIC_DEBUG_MODE=true` in front to see logs.

## 3. The page (`public/index.html`)

The browser only talks to the **helper**. Copy `kubic-kode/client/kubic-kode-helper/` into `public/` and serve `public/` from the origin you allowed in `corsOrigins` (e.g. `npx serve public -l 5173`).

```html
<p id="board"></p>
<p id="status"></p>
<button data-take="1">Take 1</button>
<button data-take="2">Take 2</button>
<button data-take="3">Take 3</button>
<button id="again">Play again</button>

<script type="module">
  import { KubicKode } from "./kubic-kode-helper/index.js";

  // The API is on another origin; the WebSocket uses the page's hostname and this port.
  KubicKode.configure({ apiPrefix: "http://localhost:3000/api", websocketPort: "3000" });

  const myPlayerId = () => KubicKode.game.playerMappings[KubicKode.participantId];

  function render() {
    const row = KubicKode.game.tilemap?.[0] ?? [];
    document.querySelector("#board").textContent = row.map((t) => (t ? "O" : "-")).join(" ");
    if (KubicKode.game.active) {
      const myTurn = KubicKode.game.currentPlayerId === myPlayerId();
      document.querySelector("#status").textContent = myTurn ? "Your turn" : "Opponent's turn";
    }
  }

  KubicKode.events.on("gameStateUpdated", render);
  KubicKode.events.on("tilemapUpdated", render);
  KubicKode.events.on("kubic::playerWon", ({ playerId }) => {
    document.querySelector("#status").textContent = playerId === myPlayerId() ? "You win!" : "You lose.";
  });
  KubicKode.events.on("restartVotingCompleted", ({ allAgreed }) => {
    if (allAgreed) KubicKode.startGame();
  });

  document.querySelectorAll("[data-take]").forEach((button) => {
    button.onclick = () =>
      KubicKode.route.game("play-turn", { take: Number(button.dataset.take) })
        .then(({ data }) => data.status === "invalid" && alert(data.message))
        .catch(() => alert("Not your turn")); // non-2xx responses throw
  });
  document.querySelector("#again").onclick = () => KubicKode.voting.initiate();

  await KubicKode.initSession("nim", { forceNew: true });
  await KubicKode.joinSession("Ann");      // stores the game token and opens the WebSocket
  await KubicKode.addAIParticipant("Bot");
  await KubicKode.startGame();
</script>
```

What the helper is doing:

- **Auth.** `joinSession` stores the game token; every `route.game(...)` call attaches `participantId` and `gameToken`. You only pass the move.
- **Starting.** The page starts the game once both seats are filled.
- **State.** After each `kubic::turnPlayed` and `kubic::gameStarted`, the helper re-fetches the board and current player into `KubicKode.game` and emits `tilemapUpdated` / `gameStateUpdated`.
- **Turns.** Compare `currentPlayerId` with *your player id* (`playerMappings[participantId]`), not with your participant id.
- **Restart.** `voting.initiate()` opens a vote and votes yes; the computer votes yes too. When `restartVotingCompleted` reports `allAgreed`, the client starts the next game.

**Two humans instead of a computer:** in both tabs, replace the last three lines with `await KubicKode.autoJoinSession("nim", name)` using a different `name` per tab (names must be unique in a session). The first tab creates the session, the second joins it. Then call `KubicKode.startGame()` from either tab once both have joined, e.g. on `kubic::sessionParticipantJoined`.

Everything else the helper can do (lobby, host controls, chat, spectators, reactive state, all events) is in the [helper reference](./helper-reference.md).
