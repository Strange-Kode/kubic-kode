# kubic-kode

A Node.js framework for turn-based, session-based multiplayer browser games.

You write the game rules as one class. kubic-kode gives you the rest:

- **Game engine** - turn order (sequential or simultaneous play styles), tile map, player entities, win/tie handling, computer players, turn timers.
- **Game server** - an importable Express + WebSocket server: sessions, lobby, host controls, chat, spectators, restart votes, game-token auth, real-time `kubic::` broadcasts.
- **Browser helper** (`client/kubic-kode-helper/`) - one object that wraps all of it for your frontend: sessions, tokens, the WebSocket, events, and reactive state.

## Quick start

Requires Node.js 20+.

```sh
git clone https://github.com/Strange-Kode/kubic-kode.git
cd kubic-kode
npm install
cp .env.example .env    # then set KUBIC_GAME_TOKEN_SECRET_KEY to 32+ characters
npm run dev-server      # API on http://localhost:3000
```

The server refuses to start without a `.env` file in the working directory and a `KUBIC_GAME_TOKEN_SECRET_KEY`.

The dev server registers the backend-only tic-tac-toe demo (`client/demos/backend-tic-tac-toe/`) as game ids `tic-tac-toe-classic` and `tic-tac-toe-configurable`. It has no frontend; it is the reference implementation of a game class and what the test suite plays against.

## Using kubic-kode in your own project

kubic-kode is not published to npm, by design. Two ways to build on it:

**Build inside a clone.** Add your game next to the demo and import framework files by relative path. Simplest way to start.

**Vendor it as a git submodule.** Keeps your game in its own repo, and `import ... from "kubic-kode"` works:

```sh
git submodule add https://github.com/Strange-Kode/kubic-kode.git kubic-kode
(cd kubic-kode && npm install)     # the submodule needs its own dependencies
```

```json
{ "dependencies": { "kubic-kode": "file:./kubic-kode" } }
```

Then `npm install`. To pull framework updates: `git submodule update --remote` and commit the new pointer.

Your frontend uses the browser helper in `kubic-kode/client/kubic-kode-helper/`. You can serve or copy that directory, or point a bundler alias at it (e.g. Vite `resolve.alias: { "kubic-kode-helper": "<path>/kubic-kode/client/kubic-kode-helper/index.js" }`).

The page and the API can run on different origins (allow the page's origin with `KUBIC_ALLOWED_ORIGINS`, see the [server reference](./docs/server-reference.md#environment-variables)) or share one behind a reverse proxy (see `apiPrefix` / `websocketPort` / `websocketPath` in the [helper reference](./docs/helper-reference.md#configuration)).

## Documentation

| Doc | For |
|-----|-----|
| [Building a game](./docs/building-a-game.md) | Start here: a game class on the server, the helper in the browser |
| [Concepts](./docs/concepts.md) | Sessions, participants, tokens, turn flow, connection handling, events |
| [Helper reference](./docs/helper-reference.md) | Every helper method, route action, event and state field |
| [Server reference](./docs/server-reference.md) | Game contract, engine, `PlayStatus`, options, `createGameServer`, env vars, errors, HTTP/WebSocket protocol |
| [Module system](./docs/module-system.md) | Optional: extending the server with your own modules |

Coding agents: [`llms.txt`](./llms.txt) indexes the docs; the two references are written to be loaded into context whole.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security issues: [SECURITY.md](./SECURITY.md). Licensed [MIT](./LICENSE).
