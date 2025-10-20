/**
 * Game State factory function
 * Manages game-level state including tilemap, current player, and game status
 *
 * @param {Object} helper - Reference to the main KubicKodeHelper instance
 * @returns {Object} Game state manager with state and methods
 */
export function createGameState(helper) {
  return {
    // Game state
    started: false,
    active: false,
    tilemap: [],
    currentPlayerId: null,
    playerMappings: {},
    isGameLoading: false,
    gameError: null,
    lastMoveResult: null,

    // Update game data from backend response
    updateGame(gameData) {
      this.started = gameData.started !== undefined ? gameData.started : this.started;
      this.active = gameData.active !== undefined ? gameData.active : this.active;
      this.tilemap = gameData.tilemap || this.tilemap;
      this.currentPlayerId = gameData.currentPlayerId !== undefined ? gameData.currentPlayerId : this.currentPlayerId;
      this.playerMappings = gameData.playerMappings || this.playerMappings;
      this.lastMoveResult = gameData.lastMoveResult || this.lastMoveResult;

      helper.events.emit("gameStateUpdated", this.getState());
    },

    // Set loading state
    setLoading(isLoading) {
      this.isGameLoading = isLoading;
      helper.events.emit("gameLoadingChanged", isLoading);
    },

    // Set error state
    setError(error) {
      this.gameError = error;
      helper.events.emit("gameErrorChanged", error);
    },

    // Update tilemap
    updateTilemap(tilemap) {
      this.tilemap = tilemap || [];
      helper.events.emit("tilemapUpdated", this.tilemap);
    },

    // Get tile at specific position
    getTile(x, y) {
      return this.tilemap[y]?.[x] || null;
    },

    // Get grid dimensions
    getGridDimensions() {
      return {
        rows: this.tilemap.length,
        cols: this.tilemap[0]?.length || 0,
      };
    },

    // Check if it's current user's turn
    isMyTurn() {
      return this.currentPlayerId === helper.participantId;
    },

    // Get current player info
    getCurrentPlayer() {
      return helper.session.getParticipant(this.currentPlayerId);
    },

    // Get current game state
    getState() {
      return {
        started: this.started,
        active: this.active,
        tilemap: this.tilemap ? [...this.tilemap] : [],
        currentPlayerId: this.currentPlayerId,
        playerMappings: { ...this.playerMappings },
        isGameLoading: this.isGameLoading,
        gameError: this.gameError,
        lastMoveResult: this.lastMoveResult,
        isMyTurn: this.isMyTurn(),
        currentPlayer: this.getCurrentPlayer(),
        gridDimensions: this.getGridDimensions(),
      };
    },

    // Reset game state
    reset() {
      this.started = false;
      this.active = false;
      this.tilemap = [];
      this.currentPlayerId = null;
      this.playerMappings = {};
      this.isGameLoading = false;
      this.gameError = null;
      this.lastMoveResult = null;
      helper.events.emit("gameReset");
    },
  };
}
