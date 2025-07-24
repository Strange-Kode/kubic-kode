import express from "express";
import { sessionManager } from "../../../../game-server/session-manager.js"; // Holds all active GameSession instances
import { gameRegistry } from "../../../../game-server/game-registry.js";

import { GameEventService } from "../../../../game-server/game-event-service.js";

const ticTacToeRouter = express.Router();

// Plays turn and returns game state of the player round (e.g. did current player win?)
// round status also contains if move is invalid
ticTacToeRouter.post("/tic-tac-toe/play-turn/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  // TODO: pass playerId to req.body
  const { xPos, yPos } = req.body;

  // TODO: validate that playerId is the current player

  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();
  
  // Get the current player from the game engine
  const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();

  let roundStatus = gameInstance.playTurn(currentPlayer.getPlayerId(), xPos, yPos);
  
  res.json(roundStatus);
  
  // Broadcast the turn event to all connected clients after sending the response
  try {
    GameEventService.broadcastToSession(gameSession, {
      type: "turnPlayed",
      payload: { roundStatus }
    });
    
    // If the player won, also broadcast a win event
    if (roundStatus.player_has_won) {
      GameEventService.broadcastToSession(gameSession, {
        type: "playerWon",
        payload: { 
          playerId: roundStatus.player_id,
          winCondition: roundStatus.winCondition || 'unknown'
        }
      });
    }
  } catch (broadcastError) {
    console.error('Broadcast error (non-blocking):', broadcastError);
    // Don't throw here - the turn was played successfully, just the broadcast failed
  }
});

export default ticTacToeRouter;
