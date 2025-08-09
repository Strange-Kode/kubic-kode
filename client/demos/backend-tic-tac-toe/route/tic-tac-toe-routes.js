import express from "express";
import { sessionManager } from "../../../../game-server/session-manager.js"; // Holds all active GameSession instances
import { gameRegistry } from "../../../../game-server/game-registry.js";

import { GameEventService } from "../../../../game-server/game-event-service.js";
import { checkPlayableAccess } from "../../../../game-utility/game-utility.js";

const ticTacToeRouter = express.Router();

// Create middleware instance with session manager
const checkPlayableAccessMiddleware = checkPlayableAccess(sessionManager);

// NOTE: The play-turn logic has been moved to the generic /game/play-turn/:sessionId endpoint
// in game-routes.js to make it reusable across all games. This file can be used for 
// tic-tac-toe specific routes in the future if needed.

export default ticTacToeRouter;
