# kubic-kode-helper

The browser helper: your frontend's interface to a kubic-kode server. It manages sessions, game tokens, the WebSocket, events and reactive game state.

```javascript
import { KubicKode } from "./kubic-kode-helper/index.js";

await KubicKode.initSession("my-game", { forceNew: true });
await KubicKode.joinSession("Ann"); // stores the game token and opens the WebSocket
await KubicKode.route.game("play-turn", { /* your move */ });
```

- [Building a game](../docs/building-a-game.md) - a complete example, server and browser
- [Helper reference](../docs/helper-reference.md) - every method, event and option

`demos/backend-tic-tac-toe/` holds the server-side tic-tac-toe game used by `npm run start-server` and the test suite.
