import { kubicLog } from "../../kubic-log.js";

export default {
  async init() {
    kubicLog.info('[player] Module initialized');
  },

  /**
   * Format player IDs based on returnSinglePlayerId option
   * @param {Object} gameInstance - The game instance
   * @param {Array} currentPlayerIds - Array of current player IDs
   * @returns {Object} Formatted result with playerId or playerIds
   */
  formatPlayerIds(gameInstance, currentPlayerIds) {
    const returnSinglePlayerId = gameInstance.getGameOptions()?.getCurrentSystemValue("returnSinglePlayerId") || false;
    
    if (returnSinglePlayerId) {
      // Validate requirements for returnSinglePlayerId
      const playStyle = gameInstance.getGameEngine().getPlayStyle();
      if (playStyle !== "single-set") {
        return {
          error: true,
          message: "returnSinglePlayerId option requires single-set play style",
          details: `Current play style: ${playStyle}, required: single-set`
        };
      }
      
      if (currentPlayerIds.length !== 1) {
        return {
          error: true,
          message: "returnSinglePlayerId option requires exactly one current player",
          details: `Current players: ${currentPlayerIds.length}, required: 1`
        };
      }
      
      return {
        success: true,
        returnSinglePlayerId: true,
        playerId: currentPlayerIds[0]
      };
    }
    
    return {
      success: true,
      returnSinglePlayerId: false,
      playerIds: currentPlayerIds
    };
  },

  /**
   * Get current player IDs from game instance
   * @param {Object} gameInstance - The game instance
   * @returns {Array} Array of current player IDs
   */
  getCurrentPlayerIds(gameInstance) {
    const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
    const currentPlayerIds = Array.isArray(currentPlayers) 
      ? currentPlayers.map(p => p.getPlayerId()) 
      : [currentPlayers?.getPlayerId()].filter(Boolean);
    return currentPlayerIds;
  },

  /**
   * Get player ID from participant ID using player mappings
   * @param {Object} gameInstance - The game instance
   * @param {string} participantId - The participant ID
   * @returns {string|null} The player ID or null if not found
   */
  getPlayerIdFromParticipant(gameInstance, participantId) {
    const playerMappings = gameInstance.getPlayerMappings();
    return playerMappings[participantId] || null;
  },

  /**
   * Get participant ID from player ID using player mappings
   * @param {Object} gameInstance - The game instance
   * @param {string} playerId - The player ID
   * @returns {string|null} The participant ID or null if not found
   */
  getParticipantIdFromPlayer(gameInstance, playerId) {
    const playerMappings = gameInstance.getPlayerMappings();
    
    for (const [pid, mappedPlayerId] of Object.entries(playerMappings)) {
      if (mappedPlayerId === playerId) {
        return pid;
      }
    }
    
    return null;
  }
};

