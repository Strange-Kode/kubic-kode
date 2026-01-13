import { PlayStatus } from "../../game-engine/play-status.js";
import { GameEventService } from "../../game-server/game-event-service.js";
import { kubicLog } from "../../kubic-log.js";
import { serializeRecursively } from "../../game-utility/game-utility.js";

export default {
  async init() {
    kubicLog.info('[turn] Module initialized');
  },

  /**
   * Validates that a participant is the current player
   * @param {Object} gameInstance - The game instance
   * @param {string} participantId - The participant ID
   * @returns {Object} Validation result with playerId or error
   */
  validatePlayerTurn(gameInstance, participantId) {
    const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
    const playerMappings = gameInstance.getPlayerMappings();
    const playerId = playerMappings[participantId];
    
    if (!playerId) {
      return {
        valid: false,
        error: "Participant is not a player in this game."
      };
    }
    
    const currentPlayerIds = Array.isArray(currentPlayers) 
      ? currentPlayers.map(p => p.getPlayerId()) 
      : [currentPlayers?.getPlayerId()];
    
    if (!currentPlayerIds.includes(playerId)) {
      return {
        valid: false,
        error: `It's not your turn (playerId: ${playerId}). Current player ids: ` + currentPlayerIds.join(", ")
      };
    }
    
    return {
      valid: true,
      playerId
    };
  },

  /**
   * Executes a turn for a player
   * @param {Object} gameInstance - The game instance
   * @param {string} playerId - The player ID
   * @param {Object} moveData - The move data
   * @returns {Object} Play status result
   */
  executeTurn(gameInstance, playerId, moveData) {
    try {
      kubicLog.debug(`[turn] Game instance type:`, gameInstance.constructor.name);
      kubicLog.debug(`[turn] Calling playTurn with playerId: ${playerId}, moveData:`, moveData);
      
      const playStatus = gameInstance.playTurn(playerId, moveData);
      
      kubicLog.debug(`[turn] playTurn returned:`, playStatus);
      kubicLog.debug(`[turn] playStatus.playerHasWon:`, playStatus.access("playerHasWon"));
      
      return {
        success: true,
        playStatus
      };
    } catch (error) {
      kubicLog.error(`[turn] Error in playTurn:`, error);
      return {
        success: false,
        error: "Invalid move.",
        details: error.message
      };
    }
  },

  /**
   * Handles win condition after a turn
   * @param {Object} gameSession - The game session
   * @param {Object} playStatus - The play status
   * @param {Object} moveData - The move data (for recording position)
   */
  handleWinCondition(gameSession, playStatus, moveData) {
    if (!playStatus.access("playerHasWon")) {
      return;
    }

    const gameInstance = gameSession.getGameInstance();
    kubicLog.debug(`[turn] Win condition detected! Player ${playStatus.access("playerId")} won`);
    
    // Record the win in game history
    try {
      const playerMappings = gameInstance.getPlayerMappings();
      let participantId = null;
      
      for (const [pid, playerId] of Object.entries(playerMappings)) {
        if (playerId === playStatus.access("playerId")) {
          participantId = pid;
          break;
        }
      }
      
      kubicLog.debug(`[turn] Recording win for player ${playStatus.access("playerId")} -> participant ${participantId}`);

      gameSession.getGameHistory().addPlayerWonEvent(
        playStatus.access("playerId"),
        participantId,
        {
          winCondition: playStatus.access("winCondition") || "unknown",
          finalPosition: { x: moveData.xPos, y: moveData.yPos },
          gameState: "completed",
        }
      );
      kubicLog.debug(`[turn] Successfully recorded win event in history`);
    } catch (error) {
      kubicLog.error(`[turn] Error recording win event:`, error);
    }
    
    gameSession.increaseWinCounter();
    const winCount = gameSession.getWinCounter();
    kubicLog.debug(`[turn] Win counter increased to: ${winCount}`);
    
    GameEventService.broadcastToSession(gameSession, {
      type: "kubic::winCount",
      payload: { winCount },
    });
  },

  /**
   * Handles tie condition after a turn
   * @param {Object} gameSession - The game session
   * @param {Object} playStatus - The play status
   */
  handleTieCondition(gameSession, playStatus) {
    if (!playStatus.access("gameIsTied")) {
      return;
    }

    const winCount = gameSession.getWinCounter();
    GameEventService.broadcastToSession(gameSession, {
      type: "kubic::winCount",
      payload: { winCount },
    });
  },

  /**
   * Broadcasts turn events to all clients
   * @param {Object} gameSession - The game session
   * @param {Object} playStatus - The play status
   * @param {Object} serializedTileMap - The serialized tilemap
   */
  broadcastTurnEvents(gameSession, playStatus, serializedTileMap) {
    try {
      const responseData = playStatus instanceof PlayStatus ? playStatus.toSnakeCase() : playStatus;
      
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::turnPlayed",
        payload: {
          roundStatus: responseData,
          updatedTileMap: serializedTileMap
        }
      });
      
      // If the player won, also broadcast a win event
      if (playStatus.access("playerHasWon")) {
        GameEventService.broadcastToSession(gameSession, {
          type: "kubic::playerWon",
          payload: { 
            playerId: playStatus.access("playerId"),
            winCondition: playStatus.access("winCondition") || "unknown"
          }
        });
      }
      
      // If the game is tied, broadcast a tie event
      if (playStatus.access("gameIsTied")) {
        GameEventService.broadcastToSession(gameSession, {
          type: "kubic::gameTied",
          payload: { 
            message: "Game ended in a tie"
          }
        });
      }
    } catch (broadcastError) {
      kubicLog.error("[turn] Broadcast error (non-blocking):", broadcastError);
    }
  },

  /**
   * Converts PlayStatus to snake_case for HTTP responses
   * @param {Object} playStatus - The play status
   * @returns {Object} Response data
   */
  toResponseData(playStatus) {
    return playStatus instanceof PlayStatus ? playStatus.toSnakeCase() : playStatus;
  }
};

