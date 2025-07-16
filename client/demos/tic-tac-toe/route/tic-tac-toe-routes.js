import express from "express";
import { sessionManager } from "../../../../game-server/session-manager.js"; // Holds all active GameSession instances
import { gameRegistry } from "../../../../game-server/game-registry.js";

const ticTacToeRouter = express.Router();

// Plays turn and returns game state of the player round (e.g. did current player win?)
// round status also contains if move is invalid
ticTacToeRouter.post("/play-turn/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { playerId, xPos, yPos } = req.body;

  // TODO: playerId is never used, remove or validate?

  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  let round_status = gameInstance.playTurn(xPos, yPos);
  res.json(round_status);
});

export default ticTacToeRouter;
