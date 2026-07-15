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

    // Check if it's the current user's turn.
    // Session participant ids and engine player ids are separate id spaces
    // that often coincide numerically (the first joiner tends to become
    // player 1); playerMappings is the only reliable bridge between them.
    isMyTurn() {
      const myPlayerId = this.playerMappings[helper.participantId];
      return myPlayerId !== undefined && myPlayerId === this.currentPlayerId;
    },

    // Get the session participant whose turn it is.
    getCurrentPlayer() {
      return this.getParticipantForPlayer(this.currentPlayerId);
    },

    // Resolve an engine player id to the session participant it belongs to.
    getParticipantForPlayer(playerId) {
      if (playerId === null || playerId === undefined) return null;
      for (const [participantId, mappedPlayerId] of Object.entries(this.playerMappings)) {
        if (mappedPlayerId === playerId) {
          // Object.entries() yields string keys while participant ids from
          // the server are numbers, so the numeric form is the live lookup;
          // the string form is kept for non-numeric id schemes.
          return (
            helper.session.getParticipant(Number(participantId)) ??
            helper.session.getParticipant(participantId) ??
            null
          );
        }
      }
      return null;
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
