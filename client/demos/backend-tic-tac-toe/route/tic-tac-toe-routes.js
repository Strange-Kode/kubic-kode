import express from "express";
import { sessionManager } from "../../../../game-server/session-manager.js"; // Holds all active GameSession instances
import { gameRegistry } from "../../../../game-server/game-registry.js";

import { GameEventService } from "../../../../game-server/game-event-service.js";
import { checkPlayableAccess } from "../../../../game-utility/game-utility.js";

const ticTacToeRouter = express.Router();

// Create middleware instance with session manager
const checkPlayableAccessMiddleware = checkPlayableAccess(sessionManager);

// Plays turn and returns game state of the player round (e.g. did current player win?)
// round status also contains if move is invalid
ticTacToeRouter.post("/tic-tac-toe/play-turn/:sessionId", checkPlayableAccessMiddleware, (req, res) => {
  const { sessionId } = req.params;
  const { participantId, xPos, yPos } = req.body;

  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();
  
  // Get the current player from the game engine
  const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();
  
  // Validate that the participant is the current player
  // We need to map participantId to playerId to check if it's their turn
  const participant = gameSession.getParticipantById(participantId);
  if (!participant) {
    return res.status(404).json({ error: "Participant not found." });
  }
  
  // Find the player that corresponds to this participant
  const playerMappings = gameInstance.getPlayerMappings();
  const playerId = playerMappings[participantId];
  
  if (!playerId) {
    return res.status(400).json({ error: "Participant is not a player in this game." });
  }
  
  // Validate that it's this player's turn
  if (playerId !== currentPlayer.getPlayerId()) {
    return res.status(400).json({ error: "It's not your turn." });
  }

  let roundStatus = gameInstance.playTurn(playerId, xPos, yPos);
  
  if (roundStatus.player_has_won) { // playerId has won
    gameSession.increaseWinCounter();
    let winCount = gameSession.getWinCounter();
    GameEventService.broadcastToSession(gameSession, {
      type: "winCount",
      payload: { winCount },
    });
  }
  
  if (roundStatus.game_is_tied) { // Game is tied
    let winCount = gameSession.getWinCounter();
    GameEventService.broadcastToSession(gameSession, {
      type: "winCount",
      payload: { winCount },
    });
  }
  
  res.json(roundStatus);
  
  
  // Handle AI move (if needed), asynchronously
  // TODO: need to make a loop here in case there are multiple (2+) sequential computer players.
  // When all sequential computer players have played and next player is human: broadcast turnPlayed to session!
  // Also consider that if one of the computer players has won (compRoundStatus.player_has_won) the next
  // possible computer player does not have to play, it should instead break.
  if (!roundStatus.player_has_won && !roundStatus.game_is_tied && gameInstance.getGameEngine().getCurrentPlayer().getPlayerType() === 'computer') {
    const delay = 1000 + Math.floor(Math.random() * 1001);  // 1000 to 2000 ms
    setTimeout(() => {
      const computerMove = gameInstance.calculateComputerMove();
      
      const computerPlayer = gameInstance.getGameEngine().getCurrentPlayer();
      let compRoundStatus = gameInstance.playTurn(computerPlayer.getPlayerId(), computerMove.x, computerMove.y);

      if (compRoundStatus.player_has_won) { // computer has won
        let winCount = gameSession.getWinCounter();
        GameEventService.broadcastToSession(gameSession, {
          type: "winCount",
          payload: { winCount },
        });
      }
      
      if (compRoundStatus.game_is_tied) { // computer move resulted in tie
        let winCount = gameSession.getWinCounter();
        GameEventService.broadcastToSession(gameSession, {
          type: "winCount",
          payload: { winCount },
        });
      }

      GameEventService.broadcastToSession(gameSession, {
        type: "turnPlayed",
        payload: { roundStatus: compRoundStatus },
      });
      
      // If the computer won, also broadcast a win event
      if (compRoundStatus.player_has_won) {
        GameEventService.broadcastToSession(gameSession, {
          type: "playerWon",
          payload: { 
            playerId: compRoundStatus.player_id,
            winCondition: compRoundStatus.winCondition || 'unknown'
          }
        });
      }
      
      // If the game is tied, broadcast a tie event
      if (compRoundStatus.game_is_tied) {
        GameEventService.broadcastToSession(gameSession, {
          type: "gameTied",
          payload: { 
            playerId: compRoundStatus.player_id
          }
        });
      }
    }, delay);
  }
  
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
    
    // If the game is tied, broadcast a tie event
    if (roundStatus.game_is_tied) {
      GameEventService.broadcastToSession(gameSession, {
        type: "gameTied",
        payload: { 
          playerId: roundStatus.player_id
        }
      });
    }
  } catch (broadcastError) {
    console.error('Broadcast error (non-blocking):', broadcastError);
    // Don't throw here - the turn was played successfully, just the broadcast failed
  }
});

export default ticTacToeRouter;
