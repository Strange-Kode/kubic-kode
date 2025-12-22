import express from "express";
import { sessionManager } from "../../../../game-server/session-manager.js";
import { gameRegistry } from "../../../../game-server/game-registry.js";

import { GameEventService } from "../../../../game-server/game-event-service.js";
import { checkPlayableAccess } from "../../../../game-utility/game-utility.js";
import { validateGameTokenWithParticipant, validateGameTokenWithParticipantReadOnly } from "../../../../game-server/game-token-middleware.js";

const ticTacToeRouter = express.Router();

// Create middleware instances with session manager
const checkPlayableAccessMiddleware = checkPlayableAccess(sessionManager);
const validateGameTokenMiddleware = validateGameTokenWithParticipant(sessionManager);
const validateGameTokenReadOnlyMiddleware = validateGameTokenWithParticipantReadOnly(sessionManager);

// NOTE: The play-turn logic has been moved to the generic /game/play-turn/:sessionId endpoint
// in game-routes.js to make it reusable across all games. This file can be used for 
// tic-tac-toe specific routes in the future if needed.
//
// IMPORTANT: All routes that interact with game sessions MUST use the validation middleware
// to ensure game tokens are valid and participants are authorized. This protects against
// unauthorized access and ensures proper session management.
//
// Usage examples:
// - For routes that modify game state: use validateGameTokenWithParticipant(sessionManager)
// - For read-only routes (allows spectators): use validateGameTokenWithParticipantReadOnly(sessionManager)
//
// Example protected route:
// ticTacToeRouter.post('/:sessionId/custom-action', validateGameTokenMiddleware, (req, res) => {
//   const { participantId } = req.body;
//   const gameSession = req.gameSession; // Available after middleware validation
//   // Your tic-tac-toe specific logic here
//   res.json({ success: true });
// });

export default ticTacToeRouter;
