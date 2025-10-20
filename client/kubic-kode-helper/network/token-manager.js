/**
 * Token Manager factory function
 * Manages game authentication tokens in localStorage
 *
 * @param {Object} helper - Reference to the main KubicKodeHelper instance
 * @returns {Object} Token manager with storage/retrieval methods
 */
export function createTokenManager(helper) {
  return {
    /**
     * Store game token in localStorage (per-participant)
     * @param {string} sessionId - The session ID
     * @param {string} participantId - The participant ID
     * @param {string} gameToken - The game token to store for game authentication
     */
    store(sessionId, participantId, gameToken) {
      try {
        const tokens = this.getAll();
        tokens[sessionId] = tokens[sessionId] || {};
        tokens[sessionId][participantId] = gameToken;
        localStorage.setItem("kubic_game_tokens", JSON.stringify(tokens));
      } catch (error) {
        console.error("Error storing game token:", error);
      }
    },

    /**
     * Get game token from localStorage for game authentication (per-participant)
     * @param {string} sessionId - The session ID
     * @param {string} participantId - The participant ID
     * @returns {string|null} The game token or null if not found
     */
    get(sessionId, participantId = null) {
      try {
        const tokens = this.getAll();

        if (participantId) {
          return tokens[sessionId]?.[participantId] || null;
        }

        // Fallback: if no participantId, try to find any token for the session
        if (tokens[sessionId] && typeof tokens[sessionId] === "object") {
          const participantTokens = Object.values(tokens[sessionId]);
          return participantTokens.length > 0 ? participantTokens[0] : null;
        }

        // Legacy format fallback
        return tokens[sessionId] || null;
      } catch (error) {
        console.error("Error getting game token:", error);
        return null;
      }
    },

    /**
     * Clear game token from localStorage (per-participant)
     * @param {string} sessionId - The session ID
     * @param {string} participantId - The participant ID
     */
    clear(sessionId, participantId) {
      try {
        const tokens = this.getAll();
        if (tokens[sessionId]) {
          delete tokens[sessionId][participantId];
          if (Object.keys(tokens[sessionId]).length === 0) {
            delete tokens[sessionId];
          }
          localStorage.setItem("kubic_game_tokens", JSON.stringify(tokens));
        }
      } catch (error) {
        console.error("Error clearing game token:", error);
      }
    },

    /**
     * Get all game tokens from localStorage
     * @returns {Object} Object mapping session IDs to game tokens
     */
    getAll() {
      try {
        const stored = localStorage.getItem("kubic_game_tokens");
        return stored ? JSON.parse(stored) : {};
      } catch (error) {
        console.error("Error getting all game tokens:", error);
        return {};
      }
    },

    /**
     * Clear all game tokens from localStorage
     */
    clearAll() {
      try {
        localStorage.removeItem("kubic_game_tokens");
      } catch (error) {
        console.error("Error clearing all game tokens:", error);
      }
    }
  };
}
