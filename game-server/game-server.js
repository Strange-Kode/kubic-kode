import express from "express";
const app = express();
const PORT = 3000;

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.stack || err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason.stack || reason);
});

import sessionRouter from "./route/session-routes.js";
import gameRouter from "./route/game-routes.js";
import { gameRegistry } from "./game-registry.js";
import {
  TicTacToeGame,
  ticTacToeRouter,
} from "../client/demos/backend-tic-tac-toe/tic-tac-toe.js";
import { GameEventService } from "./game-event-service.js";

function TicTacToeClassicFactory(sessionId) {
  return new TicTacToeGame({ sessionId, gridSize: 3, winCondition: 3 });
}

function TicTacToe5x5Factory(sessionId) {
  return new TicTacToeGame({ sessionId, gridSize: 5, winCondition: 4 });
}

const gameRouters = [{ path: "/api/tic-tac-toe", router: ticTacToeRouter }];

// List of known games
gameRegistry.register("tic-tac-toe-classic", TicTacToeClassicFactory);
gameRegistry.register("tic-tac-toe-5x5", TicTacToe5x5Factory);

// Middleware to parse JSON bodies
app.use(express.json());

// Register the routers
app.use("/api", sessionRouter);
app.use("/api", gameRouter);

// Dynamically register game specific routers
gameRouters.forEach(({ path, router }) => {
  app.use(path, router);
});

app.get("/", (req, res) => {
  res.send("It works!");
});

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

GameEventService.initWebSocketServer(server);
