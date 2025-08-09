import express from "express";
import { kubicLog } from "../kubic-log.js";

const app = express();
const PORT = 3000;

process.on('uncaughtException', (err) => {
    kubicLog.error('Uncaught Exception:', err.stack || err);
});
process.on('unhandledRejection', (reason, promise) => {
    kubicLog.error('Unhandled Rejection:', reason.stack || reason);
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
    
    // Don't store options as instance properties
    // this.gridSize = gridSize; // WRONG!
    // this.winCondition = winCondition; // WRONG!
    
    // Recreate the engine with the provided grid size
    const turnConfig = { playStyle: "single-set" };
    this._engine = new GameEngine(gridSize, gridSize, turnConfig);
  }

  // Override initializeGameOptions to define lifecycle-based options
  initializeGameOptions() {
    // Grid size is a pre-start option - can only be changed before game starts
    this.getGameOptions().addOption('gridSize', 3, 'pre-start', (value) => {
      if (typeof value !== 'number' || value < 3 || value > 10) {
        return 'Grid size must be a number between 3 and 10';
      }
      return true;
    });
    
    // Win condition is also pre-start - fundamental to game rules
    this.getGameOptions().addOption('winCondition', 3, 'pre-start', (value) => {
      if (typeof value !== 'number' || value < 3) {
        return 'Win condition must be at least 3';
      }
      const currentGridSize = this.getOptionValue('gridSize');
      if (value > currentGridSize) {
        return `Win condition cannot be greater than grid size (${currentGridSize})`;
      }
      return true;
    });

    // Example of a runtime option - could be changed during gameplay
    this.getGameOptions().addOption('showHints', false, 'runtime', (value) => {
      if (typeof value !== 'boolean') {
        return 'Show hints must be true or false';
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

// Serve static files (including KubicKode helper)
app.use("/static", express.static("../client"));

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
  console.log(`Debug mode: ${kubicLog.isEnabled() ? 'enabled' : 'disabled'}`);
  if (kubicLog.isEnabled()) {
    console.log(`Debug level: ${process.env.DEBUG_LEVEL || 'info'}`);
  }
});

GameEventService.initWebSocketServer(server);
