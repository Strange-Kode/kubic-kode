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

  // Human move. After play is turned the engine updates to next player
  let roundStatus = gameInstance.playTurn(xPos, yPos);
  
  // Respond to human immediately before considering if next player(s) are computer(s)
  res.json(round_status);
  
  // Handle AI move (if needed), asynchronously
  // TODO: need to make a loop here in case there are multiple (2+) sequential computer players.
  // When all sequential computer players have played and next player is human: broadcast turnPlayed to session!
  // Also consider that if one of the computer players has won (compRoundStatus.player_has_won) the next
  // possible computer player does not have to play, it should instead break.
  if (gameInstance.getGameEngine().getCurrentPlayer().getPlayerType() === 'computer') {
    const delay = 1000 + Math.floor(Math.random() * 1001);  // 1000 to 2000 ms
    setTimeout(() => {
      const computerMove = gameInstance.calculateComputerMove();
      let compRoundStatus = gameInstance.playTurn(computerMove.x, computerMove.y);

      GameEventService.broadcastToSession(gameSession, {
        type: "turnPlayed",
        payload: { compRoundStatus },
      });
    }, delay);
  }
  
  GameEventService.broadcastToSession(gameSession, {
    type: "turnPlayed",
    payload: { roundStatus },
  });
});

export default ticTacToeRouter;
