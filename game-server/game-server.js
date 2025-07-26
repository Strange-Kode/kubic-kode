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
import { GameEngine } from "../game-engine/game-engine.js";

function TicTacToeClassicFactory(sessionId, options = {}) {
  return new TicTacToeGame();
}

// Create a configurable TicTacToe variant
class ConfigurableTicTacToeGame extends TicTacToeGame {
  constructor({ gridSize = 3, winCondition = 3 } = {}) {
    super();
    
    // Update the grid size and win condition
    this.gridSize = gridSize;
    this.winCondition = winCondition;
    
    // Recreate the engine with the new grid size
    const turnConfig = { playStyle: "single-set" };
    this.engine = new GameEngine(gridSize, gridSize, turnConfig);
  }

  // Override initializeGameOptions to allow configurable options
  initializeGameOptions() {
    // Grid size is configurable with validation
    this.getGameOptions().addConfigurable('gridSize', this.gridSize, (value) => {
      if (typeof value !== 'number' || value < 3 || value > 10) {
        return 'Grid size must be a number between 3 and 10';
      }
      return true;
    });
    
    // Win condition is configurable but must be <= grid size
    this.getGameOptions().addConfigurable('winCondition', this.winCondition, (value) => {
      if (typeof value !== 'number' || value < 3) {
        return 'Win condition must be at least 3';
      }
      if (value > this.gridSize) {
        return `Win condition cannot be greater than grid size (${this.gridSize})`;
      }
      return true;
    });
  }
}

function ConfigurableTicTacToeFactory(sessionId, options = {}) {
  return new ConfigurableTicTacToeGame({ sessionId, ...options });
}

const gameRouters = [{ path: "/api/tic-tac-toe", router: ticTacToeRouter }];

// List of known games
gameRegistry.register("tic-tac-toe-classic", TicTacToeClassicFactory);
gameRegistry.register("tic-tac-toe-configurable", ConfigurableTicTacToeFactory);

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
  console.log(`Kubic Kode Server running at http://localhost:${PORT}`);
});

GameEventService.initWebSocketServer(server);
