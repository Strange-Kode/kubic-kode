/**
 * Game registration and dynamic route management factory
 * Allows registering game-specific routes and managing currentGame state
 */
export function createGameRegistry(helper) {
  return {
    /**
     * Register a game and create dynamic route methods
     * @param {string} gameId - The game identifier (e.g., "tic-tac-toe-classic")
     * @returns {KubicKodeHelper} The helper instance for chaining
     */
    register: (gameId) => {
      helper.registeredGames.set(gameId, {
        id: gameId,
        routes: new Map(),
      });

      // Create dynamic route methods for this game
      const gameRouteKey = gameId.replace(/-/g, "_");
      helper.route[gameRouteKey] = {
        /**
         * Play a turn for this specific game
         * @param {number} x - X coordinate
         * @param {number} y - Y coordinate
         * @param {Object} options - Additional move options
         * @returns {Promise<Object>} The API response
         */
        playTurn: (x, y, options = {}) => {
          return helper._makeRequest(
            "POST",
            `/${gameId}/play-turn/${helper.sessionId}`,
            {
              participantId: helper.participantId,
              gameToken: helper.gameToken,
              xPos: x,
              yPos: y,
              ...options,
            }
          );
        },

        /**
         * Restart this specific game
         * @param {Object} options - Restart options
         * @returns {Promise<Object>} The API response
         */
        restartGame: (options = {}) => {
          return helper._makeRequest(
            "POST",
            `/${gameId}/restart-game/${helper.sessionId}`,
            {
              participantId: helper.participantId,
              gameToken: helper.gameToken,
              ...options,
            }
          );
        },
        // Add more game-specific methods as needed
        // These will be available as: KubicKode.route.tic_tac_toe_classic.playTurn(x, y)
      };

      return helper;
    },

    /**
     * Set the current active game
     * @param {string} gameId - The game identifier to use
     * @returns {KubicKodeHelper} The helper instance for chaining
     */
    use: (gameId) => {
      helper.currentGame = gameId;
      return helper;
    },
  };
}
