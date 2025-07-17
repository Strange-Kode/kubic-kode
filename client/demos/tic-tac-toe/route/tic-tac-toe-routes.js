import express from "express";
import { sessionManager } from "../../../../game-server/session-manager.js"; // Holds all active GameSession instances
import { gameRegistry } from "../../../../game-server/game-registry.js";

import { GameEventService } from "../../../../game-server/game-event-service.js";

const ticTacToeRouter = express.Router();

// Plays turn and returns game state of the player round (e.g. did current player win?)
// round status also contains if move is invalid
ticTacToeRouter.post("/tic-tac-toe/play-turn/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { playerId, xPos, yPos } = req.body;

  // TODO: Add validation to playerId (is it playerIds turn to play?)

  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  // Human move.
  let roundStatus = gameInstance.playTurn(xPos, yPos);
  
  // Respond to human immediately before considering if next player(s) are computer(s)
  res.json(round_status);
  
  // Handle AI move (if needed), asynchronously
  // TODO: need to make a loop here in case there are multiple sequential computer players (#30)
  // When all sequential computer players have played: broadcast to session!
  if (gameInstance.getCurrentPlayer().getPlayerType() === 'computer') {
      setTimeout(() => {
          const computerMove = gameInstance.calculateComputerMove();
          let compRoundStatus = gameInstance.playTurn(computerMove.x, computerMove.y);

          GameEventService.broadcastToSession(gameSession, {
            type: "turnPlayed",
            payload: { compRoundStatus },
          });
      }, 1000);  // e.g. 1-second thinking delay
  }
  
  GameEventService.broadcastToSession(gameSession, {
    type: "turnPlayed",
    payload: { roundStatus },
  });
});

export default ticTacToeRouter;
