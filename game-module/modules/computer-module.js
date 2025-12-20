import { PlayStatus } from "../../game-engine/play-status.js";
import { GameEventService } from "../../game-server/game-event-service.js";
import { kubicLog } from "../../kubic-log.js";

export default {
  async init() {
    kubicLog.info('[computer] Module initialized');
  },

  /**
   * Process sequential computer player turns
   * @param {Object} gameSession - The game session
   * @param {Object} initialPlayStatus - The initial play status (optional)
   * @param {Function} processTileMapCallback - Callback to process tilemap data
   * @returns {Object} Last play status
   */
  async processComputerTurns(gameSession, initialPlayStatus = null, processTileMapCallback) {
    const gameInstance = gameSession.getGameInstance();
    let lastPlayStatus = initialPlayStatus;
    
    // Keep processing computer turns while:
    // 1. No one has won yet and game hasn't tied (or no initial status provided)
    // 2. Current players include computers
    // 3. Game is still active
    while ((!lastPlayStatus || (!lastPlayStatus.access("playerHasWon") && !lastPlayStatus.access("gameIsTied"))) && 
           gameInstance.getGameEngine().isGameStarted()) {
      
      // Get current players for this iteration
      const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
      const playersArray = Array.isArray(currentPlayers) ? currentPlayers : [currentPlayers];
      
      // Extract computer players from current players
      const computerPlayers = playersArray.filter(player => {
        if (!player) return false;
        // Try getPlayerType() first if it exists
        if (typeof player.getPlayerType === "function") {
          return player.getPlayerType() === "computer";
        }
        // Fall back to isComputer() if it exists
        if (typeof player.isComputer === "function") {
          return player.isComputer() === true;
        }
        // If neither method exists, assume not a computer
        return false;
      });
      
      // If no computer players, break the loop
      if (computerPlayers.length === 0) {
        break;
      }
      
      kubicLog.debug(`[computer] Processing ${computerPlayers.length} computer player(s):`, 
        computerPlayers.map(p => {
          const playerType = typeof p.getPlayerType === "function" 
            ? p.getPlayerType() 
            : (typeof p.isComputer === "function" && p.isComputer() ? "computer" : "unknown");
          return `${p.getPlayerId()} (${playerType})`;
        }));
      
      // Process each computer player in the current turn
      for (const computerPlayer of computerPlayers) {
        try {
          // Random delay for computer moves (1-2 seconds)
          const delay = 1000 + Math.floor(Math.random() * 1001);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Calculate computer move
          const computerMove = gameInstance.calculateComputerMove(computerPlayer.getPlayerId(), computerPlayer);
          
          // Play computer turn
          let compPlayStatus = gameInstance.playTurn(computerPlayer.getPlayerId(), computerMove);

          // Handle computer win
          if (compPlayStatus.access("playerHasWon")) {
            this._handleComputerWin(gameSession, compPlayStatus, computerMove);
            
            // Broadcast computer turn and win event
            this._broadcastComputerTurn(gameSession, compPlayStatus, processTileMapCallback);
            
            // Stop processing if computer won
            return compPlayStatus;
          }
          
          // Handle computer tie
          if (compPlayStatus.access("gameIsTied")) {
            this._handleComputerTie(gameSession);
            
            // Broadcast computer turn and tie event
            this._broadcastComputerTurn(gameSession, compPlayStatus, processTileMapCallback);
            
            // Stop processing if game tied
            return compPlayStatus;
          }

          // Broadcast computer turn
          this._broadcastComputerTurn(gameSession, compPlayStatus, processTileMapCallback);
          
          // Update lastPlayStatus for next iteration
          lastPlayStatus = compPlayStatus;
          
        } catch (error) {
          kubicLog.error(`[computer] Error during computer turn for player ${computerPlayer.getPlayerId()}:`, error);
          // Continue with next computer player instead of breaking completely
          continue;
        }
      }
      
      // After processing all computer players in the current turn, check if the next turn also has computer players
      // The game engine should have advanced to the next turn after each playTurn call
      // If the next turn also has computer players, the while loop will continue
    }
    
    return lastPlayStatus;
  },

  /**
   * Check if current players include computers
   * @param {Object} gameInstance - The game instance
   * @returns {boolean} True if current players include computers
   */
  hasComputerPlayers(gameInstance) {
    const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
    const playersArray = Array.isArray(currentPlayers) ? currentPlayers : [currentPlayers];
    const computerPlayers = playersArray.filter(player => {
      if (!player) return false;
      // Try getPlayerType() first if it exists
      if (typeof player.getPlayerType === "function") {
        return player.getPlayerType() === "computer";
      }
      // Fall back to isComputer() if it exists
      if (typeof player.isComputer === "function") {
        return player.isComputer() === true;
      }
      // If neither method exists, assume not a computer
      return false;
    });
    return computerPlayers.length > 0;
  },

  /**
   * Handle computer win (private method)
   */
  _handleComputerWin(gameSession, compPlayStatus, computerMove) {
    const gameInstance = gameSession.getGameInstance();
    
    // Record the win in game history
    try {
      const playerMappings = gameInstance.getPlayerMappings();
      let participantId = null;
      
      for (const [pid, playerId] of Object.entries(playerMappings)) {
        if (playerId === compPlayStatus.access("playerId")) {
          participantId = pid;
          break;
        }
      }
      
      kubicLog.debug(`[computer] Recording computer win for player ${compPlayStatus.access("playerId")} -> participant ${participantId}`);
      
      gameSession.getGameHistory().addPlayerWonEvent(
        compPlayStatus.access("playerId"),
        participantId,
        {
          winCondition: compPlayStatus.access("winCondition") || "unknown",
          finalPosition: { x: computerMove.xPos, y: computerMove.yPos },
          gameState: "completed",
        }
      );
      kubicLog.debug(`[computer] Successfully recorded computer win event in history`);
    } catch (error) {
      kubicLog.error(`[computer] Error recording computer win event:`, error);
    }
    
    gameSession.increaseWinCounter();
    const winCount = gameSession.getWinCounter();
    GameEventService.broadcastToSession(gameSession, {
      type: "kubic::winCount",
      payload: { winCount },
    });
  },

  /**
   * Handle computer tie (private method)
   */
  _handleComputerTie(gameSession) {
    const winCount = gameSession.getWinCounter();
    GameEventService.broadcastToSession(gameSession, {
      type: "kubic::winCount",
      payload: { winCount },
    });
  },

  /**
   * Broadcast computer turn events (private method)
   */
  _broadcastComputerTurn(gameSession, compPlayStatus, processTileMapCallback) {
    const gameInstance = gameSession.getGameInstance();
    
    // Convert PlayStatus to snake_case for broadcast
    const compResponseData = compPlayStatus instanceof PlayStatus ? compPlayStatus.toSnakeCase() : compPlayStatus;

    // Get current tilemap for computer turn broadcast
    const compCurrentTileMap = gameInstance.getGameEngine().getTileMap();
    const compSerializedTileMap = processTileMapCallback ? processTileMapCallback(compCurrentTileMap) : null;
    
    // Broadcast computer turn
    GameEventService.broadcastToSession(gameSession, {
      type: "kubic::turnPlayed",
      payload: {
        roundStatus: compResponseData,
        updatedTileMap: compSerializedTileMap
      },
    });
    
    // If the computer won, also broadcast a win event
    if (compPlayStatus.access("playerHasWon")) {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::playerWon",
        payload: { 
          playerId: compPlayStatus.access("playerId"),
          winCondition: compPlayStatus.access("winCondition") || "unknown"
        }
      });
    }
    
    // If the game is tied, broadcast a tie event
    if (compPlayStatus.access("gameIsTied")) {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::gameTied",
        payload: { 
          message: "Game ended in a tie"
        }
      });
    }
  }
};

