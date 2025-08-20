// Game Interface - defines the contract that KubicKodeGame must follow
export class GameInterface {
  // Core game lifecycle methods
  
  /**
   * Add a player to the game
   * @param {string} name - The player's name
   * @throws {Error} Must be implemented by game classes
   */
  addPlayer(name) {
    throw new Error("addPlayer must be implemented");
  }

  /**
   * Start the game
   * @throws {Error} Must be implemented by game classes
   */
  startGame() {
    throw new Error("startGame must be implemented");
  }

  /**
   * Handle a player's turn
   * @param {string} playerId - The ID of the player taking the turn
   * @param {Object} turnData - Data associated with the turn
   * @throws {Error} Must be implemented by game classes
   */
  playTurn(playerId, turnData) {
    throw new Error("playTurn must be implemented");
  }

  /**
   * Stop the game
   * @throws {Error} Must be implemented by game classes
   */
  stopGame() {
    throw new Error("stopGame must be implemented");
  }

  /**
   * Reset the game state for a restart
   * @throws {Error} Must be implemented by game classes
   */
  resetForRestart() {
    throw new Error("resetForRestart must be implemented");
  }

  /**
   * Handle player inactivity
   * @throws {Error} Must be implemented by game classes
   */
  handleInactivity() {
    throw new Error("handleInactivity must be implemented");
  }

  // Game state accessors
  
  /**
   * Get the game engine instance
   * @returns {GameEngine} The game engine
   * @throws {Error} Must be implemented by game classes
   */
  getGameEngine() {
    throw new Error("getGameEngine must be implemented");
  }

  /**
   * Get the tile map
   * @returns {TileMap} The tile map
   * @throws {Error} Must be implemented by game classes
   */
  getTileMap() {
    throw new Error("getTileMap must be implemented");
  }

  /**
   * Get the current turn players
   * @returns {Object|Array} Current turn player(s)
   * @throws {Error} Must be implemented by game classes
   */
  getCurrentTurnPlayers() {
    throw new Error("getCurrentTurnPlayers must be implemented");
  }

  /**
   * Get the winner of the game
   * @returns {Object|null} The winner or null if no winner
   * @throws {Error} Must be implemented by game classes
   */
  getWinner() {
    throw new Error("getWinner must be implemented");
  }

  /**
   * Get the inactivity timeout value
   * @returns {number|null} The inactivity timeout in milliseconds or null if not set
   * @throws {Error} Must be implemented by game classes
   */
  getInactivityTimeout() {
    throw new Error("getInactivityTimeout must be implemented");
  }

  // Game state queries
  
  /**
   * Check if the game is currently active
   * @returns {boolean} True if the game is active, false otherwise
   * @throws {Error} Must be implemented by game classes
   */
  isGameActive() {
    throw new Error("isGameActive must be implemented");
  }

  /**
   * Get game statistics
   * @returns {Object} Game statistics object
   * @throws {Error} Must be implemented by game classes
   */
  getGameStats() {
    throw new Error("getGameStats must be implemented");
  }

  // Game options methods
  
  /**
   * Get the game options instance
   * @returns {Object|null} The game options or null if not implemented
   */
  getGameOptions() {
    // Default implementation returns null - games should override this
    return null;
  }

  /**
   * Apply game options to the game
   * @param {Object} options - The options to apply
   * @returns {Object} Result object with validation and application status
   */
  applyGameOptions(options) {
    // Default implementation does nothing - games should override this
    return { valid: true, applied: {}, errors: [], ignored: [] };
  }

  /**
   * Reset game options to default values
   * @throws {Error} Must be implemented by game classes
   */
  resetGameOptions() {
    throw new Error("resetGameOptions must be implemented");
  }
}

// Game Interface Type - for documentation and type checking
export const GAME_INTERFACE_METHODS = [
  "addPlayer",
  "startGame", 
  "playTurn",
  "stopGame",
  "resetForRestart",
  "handleInactivity",
  "getGameEngine",
  "getTileMap",
  "getCurrentTurnPlayers",
  "getWinner",
  "getInactivityTimeout",
  "isGameActive",
  "getGameStats",
  "getGameOptions",
  "applyGameOptions",
  "resetGameOptions"
];
