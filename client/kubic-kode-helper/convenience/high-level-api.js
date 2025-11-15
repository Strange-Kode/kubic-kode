/**
 * High-level convenience API factory
 * Provides user-friendly methods that combine multiple low-level operations
 *
 * These methods handle common workflows like:
 * - Session initialization and joining with automatic state updates
 * - AI participant management
 * - Session availability checking
 * - State synchronization for reconnection scenarios
 */
export function createHighLevelAPI(helper) {
  return {
    /**
     * Initialize a session for a specific game
     * @param {string} gameId - Game identifier (uses currentGame if not provided)
     * @param {Object} options - Session initialization options
     * @param {boolean} options.forceNew - Force creation of new session instead of reusing existing
     * @returns {Promise<Object>} The API response
     */
    async initSession(gameId = null, options = {}) {
      const gameToInit = gameId || helper.currentGame;

      if (!gameToInit) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "No game specified",
          "GAME_TYPE_REQUIRED",
          { suggestion: "Pass gameId or call game.use(gameId) first" }
        );
      }

      // Set as current game if provided
      if (gameId) {
        helper.game.use(gameId);
      }

      try {
        const endpoint = `/session/init/${gameToInit}`;
        const result = options.forceNew
          ? await helper._makeRequest("POST", endpoint, { forceNew: true })
          : await helper._makeRequest("GET", endpoint);

        if (result.success) {
          helper.sessionId = result.data.session_id;
          helper.events.emit("sessionInitialized", {
            sessionId: helper.sessionId,
          });
        }

        return result;
      } catch (error) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          `Failed to initialize session: ${error.message}`,
          "SESSION_INIT_FAILED",
          { gameId: gameToInit, forceNew: options.forceNew }
        );
      }
    },

    /**
     * Join a session as a participant
     * Automatically updates participantId, isHost, and connects WebSocket
     * @param {string} participantName - Participant name
     * @param {string} participantType - Type: "user" or "computer" (default: "user")
     * @returns {Promise<Object>} The API response
     */
    async joinSession(participantName, participantType = "user") {
      const result = await helper.route.session("join", {
        participantName,
        participantType,
      });
      if (result.success && result.data.participant_id) {
        helper.participantId = result.data.participant_id;

        // Set isHost if provided by backend
        if (result.data.is_host !== undefined) {
          helper.session.updateSession({ isHost: result.data.is_host });
        }

        // Connect WebSocket now that we have both sessionId and participantId
        helper.connectWebSocket();
      }
      return result;
    },

    /**
     * Join a session as a spectator
     * Automatically updates participantId and connects WebSocket
     * @param {string} participantName - Spectator name
     * @returns {Promise<Object>} The API response
     */
    async spectateSession(participantName) {
      const result = await helper.route.session("spectate", { participantName });
      if (result.success && result.data.participant_id) {
        helper.participantId = result.data.participant_id;
        // Connect WebSocket now that we have both sessionId and participantId
        helper.connectWebSocket();
      }
      return result;
    },

    /**
     * Leave the current session
     * Automatically clears all state and disconnects WebSocket
     * @returns {Promise<Object>} The API response
     */
    async leaveSession() {
      if (!helper.participantId || !helper.sessionId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "No active session or participant to leave",
          "NO_SESSION_TO_LEAVE",
          { participantId: helper.participantId, sessionId: helper.sessionId }
        );
      }

      const result = await helper.route.session("leave", {
        participantId: helper.participantId,
      });
      if (result.success) {
        // Clear session identifiers
        helper.participantId = null;
        helper.sessionId = null;
        helper.gameToken = null;

        // Disconnect WebSocket
        helper.disconnectWebSocket();

        // Reset all state to prevent stale data in new sessions
        helper.session.reset();
        helper.game.reset();
        helper.wins.reset();
        helper.voting.reset();
        helper.inactivity.clearTimer(); // inactivity uses clearTimer() not reset()
        helper.flow.reset();
      }
      return result;
    },

    /**
     * Add an AI participant to the current session
     * @param {string} aiName - Name for the AI participant (default: "AI Opponent")
     * @returns {Promise<Object>} The API response
     */
    async addAIParticipant(aiName = "AI Opponent") {
      if (!helper.sessionId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "No active session. Cannot add AI participant.",
          "NO_ACTIVE_SESSION",
          { suggestion: "Initialize a session first" }
        );
      }

      const result = await helper.route.session("join", {
        participantName: aiName,
        participantType: "computer",
      });

      // Store AI game token if provided
      if (result.success && result.data.game_token) {
        helper._storeGameToken(
          helper.sessionId,
          result.data.participant_id,
          result.data.game_token
        );
      }

      return result;
    },

    /**
     * Join session as a spectator (alias for spectateSession)
     * @param {string} spectatorName - Name for the spectator
     * @returns {Promise<Object>} The API response
     */
    async joinAsSpectator(spectatorName) {
      if (!spectatorName) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "Spectator name is required",
          "SPECTATOR_NAME_REQUIRED"
        );
      }

      // Delegate to spectateSession to ensure consistent behavior
      return await this.spectateSession(spectatorName);
    },

    /**
     * Get session statistics (max players, etc.)
     * @returns {Promise<Object>} The API response
     */
    async getSessionStats() {
      if (!helper.sessionId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "No active session. Cannot get session stats.",
          "NO_ACTIVE_SESSION"
        );
      }

      return await helper.route.session("participant-stats");
    },

    /**
     * Get list of session participants
     * @returns {Promise<Object>} The API response
     */
    async getParticipants() {
      if (!helper.sessionId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "No active session. Cannot get participants.",
          "NO_ACTIVE_SESSION"
        );
      }

      return await helper.route.session("participants");
    },

    /**
     * Get game history for the current session
     * @param {Object} options - History query options
     * @param {string} options.type - Event type to filter by (e.g., "playerWon")
     * @returns {Promise<Object>} The API response with history data
     */
    async getGameHistory(options = {}) {
      if (!helper.sessionId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "No active session. Cannot get game history.",
          "NO_ACTIVE_SESSION"
        );
      }

      return await helper.route.session("history", options);
    },

    /**
     * Check if a session is available for joining
     * @param {string} targetSessionId - Session ID to check
     * @returns {Promise<Object>} The API response with availability info
     */
    async checkSessionAvailability(targetSessionId) {
      if (!targetSessionId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "Session ID is required to check availability",
          "SESSION_ID_REQUIRED"
        );
      }

      try {
        const result = await helper._makeRequest(
          "GET",
          `/session/${targetSessionId}/participants/list`
        );

        if (result.success) {
          const participants = result.data || [];
          const playableParticipants = participants.filter(
            (p) => p.type === "user" || p.type === "computer"
          );

          return {
            success: true,
            data: {
              isAvailable: playableParticipants.length < 2,
              participantCount: playableParticipants.length,
              spectatorCount: participants.filter((p) => p.type === "spectator")
                .length,
              participants: participants,
            },
          };
        }

        return result;
      } catch (error) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          `Failed to check session availability: ${error.message}`,
          "SESSION_AVAILABILITY_CHECK_FAILED",
          { sessionId: targetSessionId }
        );
      }
    },

    /**
     * Sync session state (used for rejoining existing sessions)
     * @param {string} newSessionId - Session ID to sync to
     * @param {string} newParticipantId - Participant ID to sync to
     * @returns {Promise<Object>} The sync result
     */
    async syncSessionState(newSessionId, newParticipantId) {
      if (!newSessionId || !newParticipantId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "Both session ID and participant ID are required for sync",
          "SYNC_PARAMS_REQUIRED",
          { sessionId: newSessionId, participantId: newParticipantId }
        );
      }

      // Update internal state
      helper.sessionId = newSessionId;
      helper.participantId = newParticipantId;
      helper.gameToken = helper._getGameToken(newSessionId, newParticipantId);

      // Update session state object
      helper.session.updateSession({
        sessionId: newSessionId,
        participantId: newParticipantId,
      });

      // Fetch session stats to get maxPlayers and other session info
      // This ensures opponent flow is consistent with host flow
      const statsResult = await this.getSessionStats();
      if (statsResult.success) {
        helper.session.updateSession({
          maxPlayers: statsResult.data.maxPlayers,
        });
      }

      // Connect WebSocket if needed
      if (!helper.websocket) {
        helper.connectWebSocket();
      }

      return {
        success: true,
        data: {
          sessionId: helper.sessionId,
          participantId: helper.participantId,
        },
      };
    },

    /**
     * Start the game with optional configuration
     * @param {Object} options - Game start options
     * @returns {Promise<Object>} The API response
     */
    async startGame(options = {}) {
      return await helper.route.game("start", options);
    },

    /**
     * Play a turn in the current game
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} additionalData - Additional move data
     * @returns {Promise<Object>} The API response
     */
    async playTurn(x, y, additionalData = {}) {
      if (!helper.currentGame) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "No game selected. Call game.use() first.",
          "NO_GAME_SELECTED",
          { suggestion: "Call KubicKode.game.use(gameId) to select a game" }
        );
      }

      const gameRoute = helper.currentGame.replace(/-/g, "_");
      if (helper.route[gameRoute] && helper.route[gameRoute].playTurn) {
        return await helper.route[gameRoute].playTurn(x, y, additionalData);
      } else {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          `Game '${helper.currentGame}' not registered. Call game.register("${helper.currentGame}") first.`,
          "GAME_NOT_REGISTERED",
          {
            gameId: helper.currentGame,
            suggestion: `Call KubicKode.game.register("${helper.currentGame}") first`,
          }
        );
      }
    },

    /**
     * Request a restart vote for the current session
     * @returns {Promise<Object>} The API response
     */
    async requestRestartVote() {
      if (!helper.sessionId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "No active session. Cannot request restart vote.",
          "NO_ACTIVE_SESSION",
          { suggestion: "Initialize and join a session first" }
        );
      }

      return await helper.route.session("restart-vote");
    },

    /**
     * Submit a restart vote
     * @param {boolean} voteYes - Whether to vote yes for restart
     * @returns {Promise<Object>} The API response
     */
    async submitRestartVote(voteYes) {
      if (!helper.participantId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "No participant ID. Cannot submit restart vote.",
          "NO_PARTICIPANT_ID",
          { suggestion: "Join a session first" }
        );
      }

      return await helper.route.session("submit-vote", {
        participantId: helper.participantId,
        voteYes: voteYes,
      });
    },

    /**
     * List all available sessions across all games
     * @returns {Promise<Object>} The API response with sessions list
     */
    async listAllSessions() {
      return await helper.route.session("list-all");
    },

    /**
     * List only joinable sessions across all games
     * Filters out AI games, started games, and full games
     * @returns {Promise<Object>} The API response with joinable sessions list
     */
    async listJoinableSessions() {
      return await helper.route.session("list-joinable");
    },

    /**
     * List sessions for a specific game type
     * @param {string} gameId - Game identifier to filter by
     * @param {boolean} onlyJoinable - Only return joinable sessions (default: true)
     * @returns {Promise<Object>} The API response with filtered sessions
     */
    async listSessionsByGame(gameId, onlyJoinable = true) {
      if (!gameId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "Game ID is required to list sessions by game",
          "GAME_ID_REQUIRED"
        );
      }

      return await helper.route.session("list-by-game", {
        gameId,
        onlyJoinable,
      });
    },

    /**
     * Auto-join the best available session for a game type
     * Automatically finds and joins the most suitable session, or creates one if none exist
     * @param {string} gameId - Game identifier
     * @param {string} participantName - Participant name
     * @param {string} participantType - Type: "user" or "computer" (default: "user")
     * @param {boolean} createIfNone - Create new session if none available (default: true)
     * @returns {Promise<Object>} The API response with session info
     */
    async autoJoinSession(
      gameId,
      participantName,
      participantType = "user",
      createIfNone = true
    ) {
      if (!gameId || !participantName) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "Game ID and participant name are required for auto-join",
          "AUTO_JOIN_PARAMS_REQUIRED",
          { gameId, participantName }
        );
      }

      const result = await helper.route.session("auto-join", {
        gameId,
        participantName,
        participantType,
        createIfNone,
      });

      // Update helper state if successful
      if (result.success) {
        helper.sessionId = result.data.session_id;
        helper.participantId = result.data.participant_id;

        // Connect WebSocket now that we have both sessionId and participantId
        helper.connectWebSocket();
      }

      return result;
    },

    /**
     * Get detailed lobby status for a specific session
     * @param {string} sessionId - Session ID (uses current session if not provided)
     * @returns {Promise<Object>} The API response with lobby details
     */
    async getSessionLobbyStatus(sessionId = null) {
      const targetSessionId = sessionId || helper.sessionId;

      if (!targetSessionId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "Session ID is required to get lobby status",
          "SESSION_ID_REQUIRED",
          { suggestion: "Provide sessionId or initialize a session first" }
        );
      }

      return await helper.route.session("lobby-status", {
        sessionId: targetSessionId,
      });
    },

    /**
     * Set lobby configuration (host only)
     * @param {Object} config - Configuration object with keys like { gridSize: 3, difficulty: 'medium', etc }
     * @returns {Promise<Object>} The API response with applied config
     */
    async setGameConfig(config) {
      if (!config || typeof config !== "object") {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "Config object is required",
          "CONFIG_REQUIRED",
          { suggestion: "Provide a config object with settings to apply" }
        );
      }

      const result = await helper.route.session("set-config", { config });

      // Update local config state if successful
      if (result.success && result.data.full_config) {
        helper.sessionConfig.setConfig(result.data.full_config);
      }

      return result;
    },

    /**
     * Get current lobby configuration
     * @returns {Promise<Object>} The API response with current config
     */
    async getGameConfig() {
      const result = await helper.route.session("get-config");

      // Update local config state if successful
      if (result.success && result.data.config) {
        helper.sessionConfig.setConfig(result.data.config);
      }

      return result;
    },

    /**
     * Delete a specific config key (host only)
     * @param {string} configKey - The config key to delete
     * @returns {Promise<Object>} The API response
     */
    async deleteGameConfigKey(configKey) {
      if (!configKey) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "Config key is required",
          "CONFIG_KEY_REQUIRED",
          { suggestion: "Provide the config key to delete" }
        );
      }

      const result = await helper.route.session("delete-config", { configKey });

      // Update local config state if successful
      if (result.success && result.data.remaining_config) {
        helper.sessionConfig.setConfig(result.data.remaining_config);
      }

      return result;
    },

    /**
     * Get shareable session link data
     * Generates a shareable link that can be used to join the current session
     * @param {Object} options - Link generation options
     * @param {string} options.baseUrl - Base URL for the frontend (optional, uses configured frontendUrl if not provided)
     * @returns {Object} Object containing sessionId and shareable link
     */
    getShareableSessionLink(options = {}) {
      if (!helper.sessionId) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "No active session. Cannot generate shareable link.",
          "NO_ACTIVE_SESSION"
        );
      }

      // Determine base URL with priority: explicit option > configured frontendUrl
      const baseUrl = options.baseUrl || helper.config.frontendUrl;

      if (!baseUrl) {
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          "Frontend URL is required to generate shareable link.",
          "FRONTEND_URL_REQUIRED",
          {
            suggestion:
              "Provide baseUrl parameter or configure frontendUrl: KubicKode.configure({ frontendUrl: 'https://yourapp.com' })",
          }
        );
      }

      return {
        success: true,
        data: {
          sessionId: helper.sessionId,
          link: `${baseUrl}?session=${helper.sessionId}`,
        },
      };
    },
  };
}
