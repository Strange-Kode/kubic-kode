# Module System

Optional. The server's own features (sessions, turns, lobby, voting, computer players, ...) are modules in `game-module/modules/`, loaded at startup and reachable as `modules.<name>`. You can add your own modules the same way, typically to share server-side services between your custom routes. Most games don't need this.

## A module

Any `.js` file whose default export is an object. `validate()`, `init()` and `teardown()` are optional lifecycle methods (sync or async); everything else is your API.

```javascript
// my-modules/leaderboard-module.js
const scores = new Map();

export default {
  async init() {},
  record(name, points) { scores.set(name, (scores.get(name) ?? 0) + points); },
  top(n = 10) { return [...scores].sort((a, b) => b[1] - a[1]).slice(0, n); },
};
```

**Naming:** the file name minus a `-module` suffix, kebab-case to camelCase. `leaderboard-module.js` -> `modules.leaderboard`, `tile-noise.js` -> `modules.tileNoise`. Only top-level `.js` files in a directory are loaded.

## Loading and using

```javascript
import path from "node:path";
import { createGameServer, getKubicKodeModulesPath, loadModulesFromDirectory, modules } from "kubic-kode";

await createGameServer({ modulesPath: getKubicKodeModulesPath() });         // built-ins first
await loadModulesFromDirectory(path.resolve("my-modules"), { watch: true }); // then yours

modules.leaderboard.record("Ann", 3);
```

- `createGameServer` loads the built-in modules from `modulesPath` (with hot reload). The server's routes depend on them, so always point it at `getKubicKodeModulesPath()` when kubic-kode is a dependency.
- `loadModulesFromDirectory(dir, { watch = false })` loads your directory. `dir` must be an absolute path. A missing directory is skipped. A module whose name already exists is skipped, so you cannot replace a built-in. A module that throws while loading is logged and marked as errored, not thrown.
- `modules.<name>` throws a descriptive error if the module is missing, still loading, or failed to load.

## API

| Export | |
|--------|-|
| `loadModulesFromDirectory(dir, { watch })` | load every `.js` in `dir` (absolute path) |
| `registerModule(name, instance, { skipValidation, skipInit })` | async; register an object directly; rejects if `name` exists |
| `unregisterModule(name)` | async; runs `teardown()`; resolves `true` if removed |
| `initModuleSystem(dir)` | what `createGameServer` calls; loads `dir` with hot reload always on |
| `getKubicKodeModulesPath()` | absolute path of the built-in modules |
| `modules` | proxy for accessing loaded modules |
| `hooks` | see below |

## Hooks

```javascript
import { hooks } from "kubic-kode";

hooks.register("session:ended", async (session, { reason }) => { /* persist results */ });
```

`hooks.register(name, fn)`, `hooks.unregister(name, fn)`, `hooks.run(name, ...args)` (runs handlers in order, awaiting each), `hooks.clear()`. Use any name for your own hooks. The framework fires:

| Hook | Arguments |
|------|-----------|
| `before:load` | file name without `.js` (e.g. `leaderboard-module`); fires even for modules that are then skipped |
| `after:load` | module name (e.g. `leaderboard`) |
| `before:reload`, `after:reload` | module name; only for the built-in modules loaded by `createGameServer`, not for `loadModulesFromDirectory` |
| `session:ended` | the session, then `{ reason }`, one of `SESSION_END_REASONS`: `"game_won"`, `"game_tied"`, `"game_stopped"`, `"orphaned"` (no sockets left), `"insufficient_players"` or `"hold_expired"` (fired when a session's game ends; not awaited) |
