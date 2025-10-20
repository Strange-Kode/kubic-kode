/**
 * KubicKode Helper - Client-side game development helper
 * Provides a clean API for interacting with KubicKode game server
 * Eliminates HTTP boilerplate and manages session state automatically
 *
 * Available as:
 * - ES6 module: import { KubicKode, KubicKodeHelper } from "./kubic-kode-helper.js"
 * - Browser global: window.KubicKode, window.KubicKodeHelper
 */

// Import error classes for client-side error handling
const KubicClientError = class extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = "KubicClientError";
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
};

(function (global, factory) {
  // UMD pattern to support multiple module systems
  if (typeof module === "object" && typeof module.exports === "object") {
    // CommonJS
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    // AMD
    define(factory);
  } else if (typeof exports !== "undefined") {
    // ES6 module environment
    const result = factory();
    exports.KubicKode = result.KubicKode;
    exports.KubicKodeHelper = result.KubicKodeHelper;
  } else {
    // Browser global
    const result = factory();
    global.KubicKode = result.KubicKode;
    global.KubicKodeHelper = result.KubicKodeHelper;
  }
})(typeof window !== "undefined" ? window : this, function () {
  class KubicKodeHelper {
    /**
     * Create a new KubicKodeHelper instance
     * @param {string} apiPrefix - The API base URL (default: "http://localhost:3000/api")
     */
    constructor(apiPrefix = "http://localhost:3000/api") {
      this.config = {
        apiPrefix: apiPrefix,
        defaultGame: null,
        autoReconnect: true,
        retryAttempts: 3,
        retryDelay: 1000,
      };

      this.sessionId = null;
      this.participantId = null;
      this.currentGame = null;
      this.registeredGames = new Map();
      this.eventListeners = new Map();
      this.websocket = null;
      this.heartbeatInterval = null;
      this.gameToken = null;

      // Add game registration methods to the existing game class field (DO NOT overwrite)
      this.game.register = (gameId) => {
        this.registeredGames.set(gameId, {
          id: gameId,
          routes: new Map(),
        });

        // Create dynamic route methods for this game
        const gameRouteKey = gameId.replace(/-/g, "_");
        this.route[gameRouteKey] = {
          playTurn: (x, y, options = {}) => {
            return this._makeRequest(
              "POST",
              `/${gameId}/play-turn/${this.sessionId}`,
              {
                participantId: this.participantId,
                gameToken: this.gameToken,
                xPos: x,
                yPos: y,
                ...options,
              }
            );
          },
          restartGame: (options = {}) => {
            return this._makeRequest(
              "POST",
              `/${gameId}/restart-game/${this.sessionId}`,
              {
                participantId: this.participantId,
                gameToken: this.gameToken,
                ...options,
              }
            );
          },
          // Add more game-specific methods as needed
          // These will be available as: KubicKode.route.rps.playTurn(x, y)
        };

        return this;
      };

      this.game.use = (gameId) => {
        this.currentGame = gameId;
        return this;
      };
    }

    /**
     * Configure the KubicKode helper
     * @param {Object} options - Configuration options to merge with existing config
     * @returns {KubicKodeHelper} This instance for chaining
     */
    configure(options = {}) {
      this.config = { ...this.config, ...options };
      return this;
    }

    /**
     * Game registration and management
     * (Defined in constructor with proper context binding)
     */

    /**
     * Route management for API calls
     */
    route = {
      /**
       * Session-related routes
       */
      session: async (action, data = {}) => {
        const helper = this;

        switch (action) {
          case "init":
            return await helper._makeRequest(
              "GET",
              `/session/init/${helper.currentGame}`
            );
          case "join":
            const joinResult = await helper._makeRequest(
              "POST",
              `/session/${helper.sessionId}/join`,
              data
            );
            // Store game token in localStorage when joining
            if (joinResult.success && joinResult.data.game_token) {
              helper.gameToken = joinResult.data.game_token;
              helper._storeGameToken(
                helper.sessionId,
                joinResult.data.participant_id,
                joinResult.data.game_token
              );
            }
            return joinResult;
          case "spectate":
            const spectateResult = await helper._makeRequest(
              "POST",
              `/session/${helper.sessionId}/spectate`,
              data
            );
            // Store game token in localStorage when spectating
            if (spectateResult.success && spectateResult.data.game_token) {
              helper.gameToken = spectateResult.data.game_token;
              helper._storeGameToken(
                helper.sessionId,
                spectateResult.data.participant_id,
                spectateResult.data.game_token
              );
            }
            return spectateResult;
          case "leave":
            const leaveResult = await helper._makeRequest(
              "POST",
              `/session/${helper.sessionId}/leave`,
              data
            );
            // Clear game token from localStorage when leaving
            if (leaveResult.success) {
              helper._clearGameToken(helper.sessionId, helper.participantId);
              helper.gameToken = null;
            }
            return leaveResult;
          case "participants":
            return await helper._makeRequest(
              "GET",
              `/session/${helper.sessionId}/participants/list`
            );
          case "participant-stats":
            return await helper._makeRequest(
              "GET",
              `/session/${helper.sessionId}/participants/stats`
            );
          case "restart-vote":
            return await helper._makeRequest(
              "GET",
              `/session/${helper.sessionId}/request-restart-vote`
            );
          case "submit-vote":
            return await helper._makeRequest(
              "POST",
              `/session/${helper.sessionId}/submit-restart-vote`,
              data
            );
          case "history":
            return await helper._makeRequest(
              "POST",
              `/session/${helper.sessionId}/history`,
              data
            );
          default:
            throw new KubicClientError(
              `Unknown session action: ${action}`,
              "UNKNOWN_SESSION_ACTION",
              {
                action,
                availableActions: [
                  "init",
                  "join",
                  "spectate",
                  "leave",
                  "participants",
                  "participant-stats",
                  "restart-vote",
                  "submit-vote",
                  "history",
                ],
              }
            );
        }
      },

      /**
       * Game-related routes - All now use POST with game tokens
       */
      game: async (action, data = {}) => {
        const helper = this;

        if (!helper.sessionId) {
          throw new KubicClientError(
            "No active session. Call session.init() first.",
            "NO_ACTIVE_SESSION",
            { suggestion: "Call KubicKode.session.init() to create a session" }
          );
        }

        // Always refresh game token from localStorage to ensure it's current
        helper.gameToken = helper._getGameToken(
          helper.sessionId,
          helper.participantId
        );
        if (!helper.gameToken) {
          throw new KubicClientError(
            "No game token available. Join or spectate session first.",
            "NO_GAME_TOKEN",
            {
              sessionId: helper.sessionId,
              participantId: helper.participantId,
              suggestion:
                "Call KubicKode.session.join() or KubicKode.session.spectate() first",
            }
          );
        }

        switch (action) {
          case "start":
            return await helper._makeRequest(
              "POST",
              `/game/${helper.sessionId}/start`,
              {
                ...data,
                participantId: helper.participantId,
                gameToken: helper.gameToken,
              }
            );
          case "stop":
            return await helper._makeRequest(
              "POST",
              `/game/${helper.sessionId}/stop`,
              {
                participantId: helper.participantId,
                gameToken: helper.gameToken,
              }
            );
          case "get-current-player":
            return await helper._makeRequest(
              "POST",
              `/game/${helper.sessionId}/get-current-player`,
              {
                gameToken: helper.gameToken,
              }
            );
          case "is-active":
            return await helper._makeRequest(
              "POST",
              `/game/${helper.sessionId}/is-active`,
              {
                gameToken: helper.gameToken,
              }
            );
          case "get-tilemap":
            return await helper._makeRequest(
              "POST",
              `/game/${helper.sessionId}/get-tilemap`,
              {
                gameToken: helper.gameToken,
              }
            );
          case "options":
            return await helper._makeRequest(
              "POST",
              `/game/${helper.sessionId}/options`,
              {
                gameToken: helper.gameToken,
              }
            );
          case "get-player-mappings":
            return await helper._makeRequest(
              "POST",
              `/game/${helper.sessionId}/get-player-mappings`,
              {
                gameToken: helper.gameToken,
              }
            );
          case "play-turn":
            return await helper._makeRequest(
              "POST",
              `/game/${helper.sessionId}/play-turn`,
              {
                participantId: helper.participantId,
                gameToken: helper.gameToken,
                ...data,
              }
            );
          default:
            throw new KubicClientError(
              `Unknown game action: ${action}`,
              "UNKNOWN_GAME_ACTION",
              {
                action,
                availableActions: [
                  "start",
                  "stop",
                  "get-current-player",
                  "is-active",
                  "get-tilemap",
                  "options",
                  "get-player-mappings",
                  "play-turn",
                ],
              }
            );
        }
      },
    };

    /**
     * Event management system
     */
    events = {
      /**
       * Register an event listener
       * @param {string} eventType - The type of event to listen for
       * @param {Function} callback - The callback function to execute
       * @returns {KubicKodeHelper} This instance for chaining
       */
      on: (eventType, callback) => {
        if (!this.eventListeners.has(eventType)) {
          this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType).push(callback);
        return this;
      },

      /**
       * Remove an event listener
       * @param {string} eventType - The type of event
       * @param {Function} callback - The callback function to remove
       * @returns {KubicKodeHelper} This instance for chaining
       */
      off: (eventType, callback) => {
        if (this.eventListeners.has(eventType)) {
          const listeners = this.eventListeners.get(eventType);
          const index = listeners.indexOf(callback);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
        return this;
      },

      /**
       * Emit an event to all registered listeners
       * @param {string} eventType - The type of event to emit
       * @param {any} data - The data to pass to event listeners
       * @returns {KubicKodeHelper} This instance for chaining
       */
      emit: (eventType, data) => {
        if (this.eventListeners.has(eventType)) {
          this.eventListeners.get(eventType).forEach((callback) => {
            try {
              callback(data);
            } catch (error) {
              console.error(`Error in event listener for ${eventType}:`, error);
            }
          });
        }
        return this;
      },
    };

    /**
     * Initialize WebSocket connection for real-time events
     * @returns {KubicKodeHelper} This instance for chaining
     */
    connectWebSocket() {
      if (!this.sessionId) {
        console.warn("🔌 Cannot connect WebSocket: No sessionId available");
        return this;
      }

      if (this.websocket) {
        this.websocket.close();
      }

      // Construct WebSocket URL with participant ID for connection tracking
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";

      const hostIP = window.location.hostname;
      const hostPort = "3000";

      let wsUrl = `${protocol}://${hostIP}:${hostPort}/?sessionId=${this.sessionId}`;
      if (this.participantId) {
        wsUrl += `&participantId=${this.participantId}`;
      }

      this.websocket = new WebSocket(wsUrl);

      // Send participant name when WebSocket opens
      this.websocket.onopen = () => {
        this.events.emit("websocketConnected");

        // Start heartbeat if we have participant ID
        if (this.participantId) {
          this.startHeartbeat();
        }
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Log restart vote related messages and game events
          if (data.type && (data.type.includes("restartVote") || data.type.includes("turnPlayed") || data.type.includes("gameStarted"))) {
            console.log("[WebSocket] Received:", data.type, data.payload);
          }

          // Handle heartbeat responses (support both old and new namespaces for backwards compatibility)
          if (data.type === "heartbeat" || data.type === "kubic::heartbeat") {
            this.handleHeartbeat(data);
          } else if (data.type === "heartbeatResponse" || data.type === "kubic::heartbeatResponse") {
            this.handleHeartbeatResponse(data);
          } else if (data.type === "kubic::sessionEnded") {
            // Special handling for session ended - stop heartbeat
            this.events.emit(data.type, data.payload);
            this.stopHeartbeat();
          } else {
            // Emit all other events with their full type name (preserves kubic:: prefix)
            this.events.emit(data.type, data.payload);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.websocket.onclose = (event) => {
        this.events.emit("websocketDisconnected", event);

        // Stop heartbeat on disconnect
        this.stopHeartbeat();

        // Only reconnect if autoReconnect is enabled and it's not a manual close
        if (this.config.autoReconnect && event.code !== 1000) {
          setTimeout(() => this.connectWebSocket(), 1000);
        }
      };

      this.websocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.events.emit("websocketError", error);
      };

      return this;
    }

    /**
     * Start heartbeat to keep connection alive
     */
    startHeartbeat() {
      if (this.heartbeatInterval) {
        this.stopHeartbeat();
      }

      this.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, 25000); // Send heartbeat every 25 seconds (server sends every 30)
    }

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = null;
      }
    }

    /**
     * Send heartbeat to server
     */
    sendHeartbeat() {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(
          JSON.stringify({
            type: "heartbeat",
            payload: { timestamp: Date.now() },
          })
        );
      }
    }

    /**
     * Handle incoming heartbeat from server
     * @param {Object} data - The heartbeat data
     */
    handleHeartbeat(data) {
      // Respond to server heartbeat
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(
          JSON.stringify({
            type: "heartbeat",
            payload: { timestamp: Date.now() },
          })
        );
      }
    }

    /**
     * Handle heartbeat response from server
     * @param {Object} data - The heartbeat response data
     */
    handleHeartbeatResponse(data) {
      // Server confirmed our heartbeat
    }

    /**
     * Send REST heartbeat to server
     */
    async sendRestHeartbeat() {
      if (!this.sessionId || !this.participantId) {
        return;
      }

      try {
        const response = await this._makeRequest(
          "POST",
          `/session/${this.sessionId}/heartbeat`,
          {
            participantId: this.participantId,
          }
        );
      } catch (error) {
        console.error("💓 REST heartbeat failed:", error);
      }
    }

    /**
     * Disconnect WebSocket connection
     * @returns {KubicKodeHelper} This instance for chaining
     */
    disconnectWebSocket() {
      if (this.websocket) {
        this.config.autoReconnect = false; // Prevent auto-reconnection
        this.websocket.close(1000, "Manual disconnect");
        this.websocket = null;
      }
      return this;
    }

    /**
     * Store game token in localStorage (per-participant)
     * @param {string} sessionId - The session ID
     * @param {string} participantId - The participant ID
     * @param {string} gameToken - The game token to store for game authentication
     * @private
     */
    _storeGameToken(sessionId, participantId, gameToken) {
      try {
        const tokens = this._getAllGameTokens();
        tokens[sessionId] = tokens[sessionId] || {};
        tokens[sessionId][participantId] = gameToken;
        localStorage.setItem("kubic_game_tokens", JSON.stringify(tokens));
      } catch (error) {
        console.error("Error storing game token:", error);
      }
    }

    /**
     * Get game token from localStorage for game authentication (per-participant)
     * @param {string} sessionId - The session ID
     * @param {string} participantId - The participant ID
     * @returns {string|null} The game token or null if not found
     * @private
     */
    _getGameToken(sessionId, participantId = null) {
      try {
        const tokens = this._getAllGameTokens();

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
    }

    /**
     * Clear game token from localStorage (per-participant)
     * @param {string} sessionId - The session ID
     * @param {string} participantId - The participant ID
     * @private
     */
    _clearGameToken(sessionId, participantId) {
      try {
        const tokens = this._getAllGameTokens();
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
    }

    /**
     * Get all game tokens from localStorage
     * @returns {Object} Object mapping session IDs to game tokens
     * @private
     */
    _getAllGameTokens() {
      try {
        const stored = localStorage.getItem("kubic_game_tokens");
        return stored ? JSON.parse(stored) : {};
      } catch (error) {
        console.error("Error getting all game tokens:", error);
        return {};
      }
    }

    /**
     * Clear all game tokens from localStorage
     */
    clearAllGameTokens() {
      try {
        localStorage.removeItem("kubic_game_tokens");
      } catch (error) {
        console.error("Error clearing all game tokens:", error);
      }
    }

    /**
     * Make HTTP request with retry logic
     * @param {string} method - The HTTP method (GET, POST, etc.)
     * @param {string} endpoint - The API endpoint
     * @param {Object} data - The request data (for non-GET requests)
     * @returns {Promise<Object>} The response object
     * @throws {Error} If all retry attempts fail
     * @private
     */
    async _makeRequest(method, endpoint, data = null) {
      const url = `${this.config.apiPrefix}${endpoint}`;
      const options = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (data && method !== "GET") {
        options.body = JSON.stringify(data);
      }

      let lastError;

      for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
        try {
          const response = await fetch(url, options);

          if (!response.ok) {
            throw new KubicClientError(
              `HTTP ${response.status}: ${response.statusText}`,
              "HTTP_ERROR",
              {
                status: response.status,
                statusText: response.statusText,
                url,
                method,
              }
            );
          }

          const result = await response.json();

          // Auto-set sessionId from init response
          if (endpoint.includes("/session/init/") && result.session_id) {
            this.sessionId = result.session_id;
            this.events.emit("sessionInitialized", {
              sessionId: this.sessionId,
            });
          }

          return {
            success: true,
            data: result,
          };
        } catch (error) {
          lastError = error;
          console.warn(`Request attempt ${attempt} failed:`, error.message);

          if (attempt < this.config.retryAttempts) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.config.retryDelay)
            );
          }
        }
      }

      throw lastError;
    }

    /**
     * Convenience methods for common operations
     */
    async initSession(gameId = null) {
      if (gameId) {
        this.game.use(gameId);
      }
      return await this.route.session("init");
    }

    async joinSession(participantName, participantType = "user") {
      const result = await this.route.session("join", {
        participantName,
        participantType,
      });
      if (result.success && result.data.participant_id) {
        this.participantId = result.data.participant_id;

        // Set isHost if provided by backend
        if (result.data.is_host !== undefined) {
          this.session.updateSession({ isHost: result.data.is_host });
        }

        // Connect WebSocket now that we have both sessionId and participantId
        this.connectWebSocket();
      }
      return result;
    }

    async spectateSession(participantName) {
      const result = await this.route.session("spectate", { participantName });
      if (result.success && result.data.participant_id) {
        this.participantId = result.data.participant_id;
        // Connect WebSocket now that we have both sessionId and participantId
        this.connectWebSocket();
      }
      return result;
    }

    async leaveSession() {
      if (!this.participantId || !this.sessionId) {
        throw new KubicClientError(
          "No active session or participant to leave",
          "NO_SESSION_TO_LEAVE",
          { participantId: this.participantId, sessionId: this.sessionId }
        );
      }

      const result = await this.route.session("leave", {
        participantId: this.participantId,
      });
      if (result.success) {
        // Clear session identifiers
        this.participantId = null;
        this.sessionId = null;
        this.gameToken = null;

        // Disconnect WebSocket
        this.disconnectWebSocket();

        // Reset all state to prevent stale data in new sessions
        this.session.reset();
        this.game.reset();
        this.wins.reset();
        this.voting.reset();
        this.inactivity.clearTimer(); // inactivity uses clearTimer() not reset()
        this.flow.reset();
      }
      return result;
    }

    /**
     * Initialize a new session for a specific game type
     * @param {string} gameType - The type of game (default: "tic-tac-toe-classic")
     * @param {boolean} forceNew - Force creation of new session
     * @returns {Promise<Object>} The API response
     */
    async initializeSession(
      gameType = "tic-tac-toe-classic",
      forceNew = false
    ) {
      try {
        const endpoint = `/session/init/${gameType}`;
        const result = forceNew
          ? await this._makeRequest("POST", endpoint, { forceNew: true })
          : await this._makeRequest("GET", endpoint);

        if (result.success) {
          this.sessionId = result.data.session_id;
          this.events.emit("sessionInitialized", {
            sessionId: this.sessionId,
          });
        }

        return result;
      } catch (error) {
        throw new KubicClientError(
          `Failed to initialize session: ${error.message}`,
          "SESSION_INIT_FAILED",
          { gameType, forceNew }
        );
      }
    }

    /**
     * Add an AI participant to the current session
     * @param {string} aiName - Name for the AI participant (default: "AI Opponent")
     * @returns {Promise<Object>} The API response
     */
    async addAIParticipant(aiName = "AI Opponent") {
      if (!this.sessionId) {
        throw new KubicClientError(
          "No active session. Cannot add AI participant.",
          "NO_ACTIVE_SESSION",
          { suggestion: "Initialize a session first" }
        );
      }

      const result = await this.route.session("join", {
        participantName: aiName,
        participantType: "computer",
      });

      // Store AI game token if provided
      if (result.success && result.data.game_token) {
        this._storeGameToken(
          this.sessionId,
          result.data.participant_id,
          result.data.game_token
        );
      }

      return result;
    }

    /**
     * Join session as a spectator
     * @param {string} spectatorName - Name for the spectator
     * @returns {Promise<Object>} The API response
     */
    async joinAsSpectator(spectatorName) {
      if (!spectatorName) {
        throw new KubicClientError(
          "Spectator name is required",
          "SPECTATOR_NAME_REQUIRED"
        );
      }

      const result = await this.route.session("spectate", {
        participantName: spectatorName,
      });

      if (result.success && result.data.participant_id) {
        this.participantId = result.data.participant_id;
      }

      return result;
    }

    /**
     * Get session statistics (max players, etc.)
     * @returns {Promise<Object>} The API response
     */
    async getSessionStats() {
      if (!this.sessionId) {
        throw new KubicClientError(
          "No active session. Cannot get session stats.",
          "NO_ACTIVE_SESSION"
        );
      }

      return await this.route.session("participant-stats");
    }

    /**
     * Get list of session participants
     * @returns {Promise<Object>} The API response
     */
    async getParticipants() {
      if (!this.sessionId) {
        throw new KubicClientError(
          "No active session. Cannot get participants.",
          "NO_ACTIVE_SESSION"
        );
      }

      return await this.route.session("participants");
    }

    /**
     * Get game history for the current session
     * @param {Object} options - History query options
     * @param {string} options.type - Event type to filter by (e.g., "playerWon")
     * @returns {Promise<Object>} The API response with history data
     */
    async getGameHistory(options = {}) {
      if (!this.sessionId) {
        throw new KubicClientError(
          "No active session. Cannot get game history.",
          "NO_ACTIVE_SESSION"
        );
      }

      return await this.route.session("history", options);
    }

    /**
     * Check if a session is available for joining
     * @param {string} targetSessionId - Session ID to check
     * @returns {Promise<Object>} The API response with availability info
     */
    async checkSessionAvailability(targetSessionId) {
      if (!targetSessionId) {
        throw new KubicClientError(
          "Session ID is required to check availability",
          "SESSION_ID_REQUIRED"
        );
      }

      try {
        const result = await this._makeRequest(
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
        throw new KubicClientError(
          `Failed to check session availability: ${error.message}`,
          "SESSION_AVAILABILITY_CHECK_FAILED",
          { sessionId: targetSessionId }
        );
      }
    }

    /**
     * Sync session state (used for rejoining existing sessions)
     * @param {string} newSessionId - Session ID to sync to
     * @param {string} newParticipantId - Participant ID to sync to
     * @returns {Promise<Object>} The sync result
     */
    async syncSessionState(newSessionId, newParticipantId) {
      if (!newSessionId || !newParticipantId) {
        throw new KubicClientError(
          "Both session ID and participant ID are required for sync",
          "SYNC_PARAMS_REQUIRED",
          { sessionId: newSessionId, participantId: newParticipantId }
        );
      }

      // Update internal state
      this.sessionId = newSessionId;
      this.participantId = newParticipantId;
      this.gameToken = this._getGameToken(newSessionId, newParticipantId);

      // Update session state object
      this.session.updateSession({
        sessionId: newSessionId,
        participantId: newParticipantId,
      });

      // Fetch session stats to get maxPlayers and other session info
      // This ensures opponent flow is consistent with host flow
      const statsResult = await this.getSessionStats();
      if (statsResult.success) {
        this.session.updateSession({
          maxPlayers: statsResult.data.maxPlayers,
        });
      }

      // Connect WebSocket if needed
      if (!this.websocket) {
        this.connectWebSocket();
      }

      return {
        success: true,
        data: {
          sessionId: this.sessionId,
          participantId: this.participantId,
        },
      };
    }

    async startGame(options = {}) {
      return await this.route.game("start", options);
    }

    async playTurn(x, y, additionalData = {}) {
      if (!this.currentGame) {
        throw new KubicClientError(
          "No game selected. Call game.use() first.",
          "NO_GAME_SELECTED",
          { suggestion: "Call KubicKode.game.use(gameId) to select a game" }
        );
      }

      const gameRoute = this.currentGame.replace(/-/g, "_");
      if (this.route[gameRoute] && this.route[gameRoute].playTurn) {
        return await this.route[gameRoute].playTurn(x, y, additionalData);
      } else {
        throw new KubicClientError(
          `Game '${this.currentGame}' not registered. Call game.register("${this.currentGame}") first.`,
          "GAME_NOT_REGISTERED",
          {
            gameId: this.currentGame,
            suggestion: `Call KubicKode.game.register("${this.currentGame}") first`,
          }
        );
      }
    }

    /**
     * Request a restart vote for the current session
     * @returns {Promise<Object>} The API response
     */
    async requestRestartVote() {
      if (!this.sessionId) {
        throw new KubicClientError(
          "No active session. Cannot request restart vote.",
          "NO_ACTIVE_SESSION",
          { suggestion: "Initialize and join a session first" }
        );
      }

      return await this.route.session("restart-vote");
    }

    /**
     * Submit a restart vote
     * @param {boolean} voteYes - Whether to vote yes for restart
     * @returns {Promise<Object>} The API response
     */
    async submitRestartVote(voteYes) {
      if (!this.participantId) {
        throw new KubicClientError(
          "No participant ID. Cannot submit restart vote.",
          "NO_PARTICIPANT_ID",
          { suggestion: "Join a session first" }
        );
      }

      return await this.route.session("submit-vote", {
        participantId: this.participantId,
        voteYes: voteYes,
      });
    }

    /**
     * Session state management
     */
    session = {
      // Session state
      id: null,
      participantId: null,
      participants: [],
      maxPlayers: null,
      isHost: false,
      isSessionLoading: false,
      sessionError: null,

      // Update session data from backend response
      updateSession: (sessionData) => {
        this.session.id = sessionData.sessionId || this.session.id;
        this.session.participantId =
          sessionData.participantId || this.session.participantId;
        this.session.participants =
          sessionData.participants || this.session.participants;

        if (sessionData.maxPlayers !== undefined) {
          this.session.maxPlayers = sessionData.maxPlayers;
        }

        this.session.isHost =
          sessionData.isHost !== undefined
            ? sessionData.isHost
            : this.session.isHost;

        // Sync with helper's main session tracking
        this.sessionId = this.session.id;
        this.participantId = this.session.participantId;

        this.events.emit("sessionStateUpdated", this.session.getState());
      },

      // Update participants list
      updateParticipants: (participants) => {
        this.session.participants = participants || [];
        this.events.emit("participantsUpdated", this.session.participants);
      },

      // Set loading state
      setLoading: (isLoading) => {
        this.session.isSessionLoading = isLoading;
        this.events.emit("sessionLoadingChanged", isLoading);
      },

      // Set error state
      setError: (error) => {
        this.session.sessionError = error;
        this.events.emit("sessionErrorChanged", error);
      },

      // Helper methods
      getParticipants: () => this.session.participants,
      getParticipant: (id) =>
        this.session.participants.find((p) => p.id === id),
      isCurrentUserHost: () => this.session.isHost,
      getPlayableParticipants: () =>
        this.session.participants.filter(
          (p) => p.type === "user" || p.type === "computer"
        ),
      getSpectators: () =>
        this.session.participants.filter((p) => p.type === "spectator"),

      // Game state checks
      canAutoStart: () => {
        const playableCount = this.session.getPlayableParticipants().length;
        return (
          this.session.maxPlayers && playableCount === this.session.maxPlayers
        );
      },

      isSessionFull: () => {
        const playableCount = this.session.getPlayableParticipants().length;
        return (
          this.session.maxPlayers && playableCount >= this.session.maxPlayers
        );
      },

      // Get current session state
      getState: () => ({
        id: this.session.id,
        participantId: this.session.participantId,
        participants: [...this.session.participants],
        maxPlayers: this.session.maxPlayers,
        isHost: this.session.isHost,
        isSessionLoading: this.session.isSessionLoading,
        sessionError: this.session.sessionError,
        playableCount: this.session.getPlayableParticipants().length,
        spectatorCount: this.session.getSpectators().length,
        canAutoStart: this.session.canAutoStart(),
        isSessionFull: this.session.isSessionFull(),
      }),

      // Reset session state
      reset: () => {
        this.session.id = null;
        this.session.participantId = null;
        this.session.participants = [];
        this.session.maxPlayers = null;
        this.session.isHost = false;
        this.session.isSessionLoading = false;
        this.session.sessionError = null;
        this.sessionId = null;
        this.participantId = null;
        this.events.emit("sessionReset");
      },
    };

    /**
     * Game state management
     */
    game = {
      // Game state
      started: false,
      active: false,
      tilemap: null,
      currentPlayerId: null,
      playerMappings: {},
      isGameLoading: false,
      gameError: null,
      lastMoveResult: null,

      // Update game data
      updateGame: (gameData) => {
        if (gameData.started !== undefined)
          this.game.started = gameData.started;
        if (gameData.active !== undefined) this.game.active = gameData.active;
        if (gameData.tilemap) this.game.tilemap = gameData.tilemap;
        if (gameData.currentPlayerId !== undefined)
          this.game.currentPlayerId = gameData.currentPlayerId;
        if (gameData.playerMappings)
          this.game.playerMappings = gameData.playerMappings;
        if (gameData.lastMoveResult)
          this.game.lastMoveResult = gameData.lastMoveResult;

        this.events.emit("gameStateUpdated", this.game.getState());
      },

      // Set loading state
      setLoading: (isLoading) => {
        this.game.isGameLoading = isLoading;
        this.events.emit("gameLoadingChanged", isLoading);
      },

      // Set error state
      setError: (error) => {
        this.game.gameError = error;
        this.events.emit("gameErrorChanged", error);
      },

      // Update tilemap from WebSocket
      updateTilemap: (newTilemap) => {
        this.game.tilemap = newTilemap;
        this.events.emit("tilemapUpdated", newTilemap);
      },

      // Game helper methods
      getTile: function (x, y) {
        if (!this.tilemap || !this.tilemap.tiles) {
          return null;
        }
        return this.tilemap.tiles[y]?.[x] || null;
      },

      getGridDimensions: function () {
        if (!this.tilemap) {
          return { width: 0, height: 0 };
        }
        return { width: this.tilemap.width, height: this.tilemap.height };
      },

      isMyTurn: () => {
        return this.game.currentPlayerId === this.participantId;
      },

      getCurrentPlayer: () => {
        return this.game.playerMappings[this.game.currentPlayerId] || null;
      },

      // Get current game state
      getState: function () {
        return {
          started: this.started,
          active: this.active,
          tilemap: this.tilemap,
          currentPlayerId: this.currentPlayerId,
          playerMappings: { ...this.playerMappings },
          isGameLoading: this.isGameLoading,
          gameError: this.gameError,
          lastMoveResult: this.lastMoveResult,
        };
      },

      // Reset game state
      reset: () => {
        this.game.started = false;
        this.game.active = false;
        this.game.tilemap = null;
        this.game.currentPlayerId = null;
        this.game.playerMappings = {};
        this.game.isGameLoading = false;
        this.game.gameError = null;
        this.game.lastMoveResult = null;
        this.events.emit("gameReset");
      },
    };

    /**
     * Win tracking and statistics
     */
    wins = {
      // Win state
      playerWinCounts: {},
      totalGames: 0,
      isLoading: false,
      error: null,

      // Update win counts from backend
      updateWinCounts: (winData) => {
        this.wins.playerWinCounts = winData.playerWinCounts || {};
        this.wins.totalGames = winData.totalGames || 0;
        this.events.emit("winCountsUpdated", this.wins.getState());
      },

      // Set loading state
      setLoading: (isLoading) => {
        this.wins.isLoading = isLoading;
        this.events.emit("winsLoadingChanged", isLoading);
      },

      // Set error state
      setError: (error) => {
        this.wins.error = error;
        this.events.emit("winsErrorChanged", error);
      },

      // Helper methods
      getWinCountForPlayer: (playerId) => {
        return this.wins.playerWinCounts[playerId] || 0;
      },

      getTotalGames: () => this.wins.totalGames,

      getWinPercentage: (playerId) => {
        if (this.wins.totalGames === 0) return 0;
        const wins = this.wins.getWinCountForPlayer(playerId);
        return Math.round((wins / this.wins.totalGames) * 100);
      },

      // Refresh win counts from backend
      refreshWinCounts: async () => {
        if (!this.sessionId) {
          console.warn("[KubicKode] Cannot refresh win counts: No session ID");
          return { success: false, error: "No session ID" };
        }

        this.wins.setLoading(true);
        this.wins.setError(null);

        try {
          const result = await this.getGameHistory({ type: "playerWon" });

          if (result.success && result.data.history) {
            const winCounts = {};
            let totalGames = 0;

            result.data.history.forEach((event) => {
              if (event.type === "playerWon" && event.playerId) {
                winCounts[event.playerId] =
                  (winCounts[event.playerId] || 0) + 1;
                totalGames++;
              }
            });

            this.wins.updateWinCounts({
              playerWinCounts: winCounts,
              totalGames: totalGames,
            });
          } else {
            this.wins.setError(result.error || "No history data");
          }

          return result;
        } catch (error) {
          this.wins.setError(error.message);
          return { success: false, error: error.message };
        } finally {
          this.wins.setLoading(false);
        }
      },

      // Get current win state
      getState: () => ({
        playerWinCounts: { ...this.wins.playerWinCounts },
        totalGames: this.wins.totalGames,
        isLoading: this.wins.isLoading,
        error: this.wins.error,
      }),

      // Reset win state
      reset: () => {
        this.wins.playerWinCounts = {};
        this.wins.totalGames = 0;
        this.wins.isLoading = false;
        this.wins.error = null;
        this.events.emit("winsReset");
      },
    };

    /**
     * High-level restart voting management
     */
    voting = {
      // Voting state
      isActive: false,
      initiatorId: null,
      votes: {},

      /**
       * Initialize restart voting with automatic initiator vote
       * @returns {Promise<Object>} The API response
       */
      initiate: async () => {
        try {
          // Request restart vote
          const result = await this.requestRestartVote();

          if (result.success) {
            // Update voting state
            this.voting.isActive = true;
            this.voting.initiatorId = this.participantId;
            this.voting.votes = {};

            // Auto-submit "Yes" vote for initiator
            await this.submitRestartVote(true);
            this.voting.votes[this.participantId] = true;

            // Emit event for UI updates
            this.events.emit("restartVoteInitiated", {
              initiatorId: this.participantId,
              votes: this.voting.votes,
            });
          }

          return result;
        } catch (error) {
          this.voting.isActive = false;
          this.voting.initiatorId = null;
          this.voting.votes = {};
          throw error;
        }
      },

      /**
       * Submit a vote and update local state
       * @param {boolean} voteYes - Whether to vote yes
       * @returns {Promise<Object>} The API response
       */
      vote: async (voteYes) => {
        const result = await this.submitRestartVote(voteYes);

        if (result.success) {
          this.voting.votes[this.participantId] = voteYes;

          // Emit event for UI updates
          this.events.emit("restartVoteSubmitted", {
            participantId: this.participantId,
            vote: voteYes,
            allVotes: this.voting.votes,
          });
        }

        return result;
      },

      /**
       * Reset voting state
       */
      reset: () => {
        this.voting.isActive = false;
        this.voting.initiatorId = null;
        this.voting.votes = {};
      },

      /**
       * Get current voting state
       * @returns {Object} Current voting state
       */
      getState: () => ({
        isActive: this.voting.isActive,
        initiatorId: this.voting.initiatorId,
        votes: { ...this.voting.votes },
        voteCount: Object.keys(this.voting.votes).length,
      }),
    };

    /**
     * Game flow orchestration system
     * Handles universal game lifecycle events and coordination between game, session, and UI
     */
    flow = {
      // Flow state
      phase: "initializing", // 'initializing', 'waiting-for-players', 'playing', 'ended', 'session-ended'
      winner: null,
      autoStartEnabled: true,
      autoStartMode: "on-full", // 'on-ai': auto-start when AI joins, 'on-full': auto-start when full, 'manual': never auto-start, 'immediate': start immediately

      /**
       * Get current game phase based on session and game state
       * @returns {string} Current phase
       */
      getCurrentPhase: () => {
        if (this.session.isSessionLoading || this.game.isGameLoading) {
          return "loading";
        }

        if (this.session.sessionError || this.game.gameError) {
          return "error";
        }

        if (!this.sessionId) {
          return "initializing";
        }

        if (!this.participantId) {
          return "name-selection";
        }

        const playableCount = this.session.getPlayableParticipants().length;

        if (playableCount < this.session.maxPlayers) {
          return "waiting-for-players";
        }

        if (!this.game.started) {
          return "starting-game";
        }

        if (this.game.active) {
          return "playing";
        }

        return "game-ended";
      },

      /**
       * Check if conditions are met for auto-starting the game
       * @returns {boolean} True if game should auto-start
       */
      shouldAutoStart: () => {
        if (!this.flow.autoStartEnabled) {
          return false;
        }
        if (this.game.started) {
          return false;
        }

        const playableParticipants = this.session.getPlayableParticipants();
        const playableCount = playableParticipants.length;

        // Check based on auto-start mode
        switch (this.flow.autoStartMode) {
          case "manual":
            // Never auto-start - requires manual intervention
            return false;

          case "immediate":
            // Start as soon as session has at least one participant
            const shouldStartImmediate = playableCount >= 1;
            return shouldStartImmediate;

          case "on-ai":
            // Auto-start only when an AI opponent joins
            const hasAI = playableParticipants.some(
              (p) => p.type === "computer"
            );
            const shouldStartAI =
              hasAI && playableCount === this.session.maxPlayers;
            return shouldStartAI;

          case "on-full":
          default:
            // Auto-start when max players reached (original behavior)
            const shouldStartFull = playableCount === this.session.maxPlayers;
            return shouldStartFull;
        }
      },

      /**
       * Check and auto-start game if conditions are met
       * Called automatically when participants change
       * @returns {Promise<void>}
       */
      checkAndAutoStart: async () => {
        if (!this.flow.shouldAutoStart()) {
          return;
        }

        // Check if current participant is playable
        const currentParticipant = this.session.getParticipant(
          this.participantId
        );
        if (
          !currentParticipant ||
          (currentParticipant.type !== "user" &&
            currentParticipant.type !== "computer")
        ) {
          return;
        }

        try {
          const result = await this.startGame();
          if (result.success) {
            this.events.emit("gameAutoStarted");
          } else {
            console.error("[KubicKode.flow] Auto-start failed:", result.error);
          }
        } catch (error) {
          console.error("[KubicKode.flow] Auto-start error:", error);
        }
      },

      /**
       * Configure flow settings
       * @param {Object} options - Configuration options
       * @param {boolean} options.autoStartEnabled - Enable/disable auto-start
       * @param {string} options.autoStartMode - Auto-start mode: "on-ai", "on-full", "manual", "immediate"
       */
      configure: (options = {}) => {
        if (options.autoStartEnabled !== undefined) {
          this.flow.autoStartEnabled = options.autoStartEnabled;
        }
        if (options.autoStartMode !== undefined) {
          const validModes = ["on-ai", "on-full", "manual", "immediate"];
          if (validModes.includes(options.autoStartMode)) {
            this.flow.autoStartMode = options.autoStartMode;
          } else {
            console.warn(
              `[KubicKode.flow] Invalid autoStartMode: ${
                options.autoStartMode
              }. Valid modes: ${validModes.join(", ")}`
            );
          }
        }
      },

      /**
       * Handle winCount WebSocket event
       * @param {Object} payload - Event payload with winCounts and totalGames
       */
      _handleWinCount: (payload) => {
        console.log("[KubicKode.flow] Received kubic::winCount:", payload);

        // Update win counts from WebSocket payload
        this.wins.updateWinCounts({
          playerWinCounts: payload.winCounts || {},
          totalGames: payload.totalGames || 0
        });
      },

      /**
       * Handle playerWon WebSocket event
       * @param {Object} payload - Event payload with playerId
       */
      _handlePlayerWon: (payload) => {
        // Find the winner participant
        const winnerParticipant = this.session.participants.find(
          (p) => p.id === payload.playerId
        );

        if (winnerParticipant) {
          this.flow.winner = winnerParticipant;
          this.flow.phase = "ended";
          this.game.updateGame({ active: false });

          // Refresh win counts from game history after someone wins
          setTimeout(() => {
            this.wins.refreshWinCounts();
          }, 100);

          // Emit high-level event for UI
          this.events.emit("gameEnded", {
            winner: winnerParticipant,
            isTie: false,
          });
        } else {
          console.warn(
            "[KubicKode.flow] Winner participant not found for playerId:",
            payload.playerId
          );
        }
      },

      /**
       * Handle gameTied WebSocket event
       * @param {Object} payload - Event payload
       */
      _handleGameTied: (payload) => {
        this.flow.winner = { id: null, name: "Tie", isTie: true };
        this.flow.phase = "ended";
        this.game.updateGame({ active: false });

        // Refresh win counts from game history after a tie
        setTimeout(() => {
          this.wins.refreshWinCounts();
        }, 100);

        // Emit high-level event for UI
        this.events.emit("gameEnded", {
          winner: this.flow.winner,
          isTie: true,
        });
      },

      /**
       * Handle turnPlayed WebSocket event
       * @param {Object} payload - Event payload with updatedTileMap
       */
      _handleTurnPlayed: (payload) => {
        console.log("[KubicKode.flow] Received kubic::turnPlayed:", payload);

        // Update tilemap if provided
        if (payload.updatedTileMap) {
          console.log("[KubicKode.flow] Updating tilemap from WebSocket");
          this.game.updateTilemap(payload.updatedTileMap);
        } else {
          console.warn("[KubicKode.flow] No updatedTileMap in payload!");
        }

        // Refresh current player
        this.route
          .game("get-current-player")
          .then((result) => {
            if (result.success) {
              const currentPlayerId =
                result.data.current_player_id ||
                (result.data.current_player_ids &&
                result.data.current_player_ids.length > 0
                  ? result.data.current_player_ids[0]
                  : null);
              this.game.updateGame({ currentPlayerId });
            }
          })
          .catch((error) => {
            console.error(
              "[KubicKode.flow] Error fetching current player:",
              error
            );
          });

        // Reset inactivity timer optimistically (use stored initial value)
        if (this.inactivity.initialTimer !== null) {
          this.inactivity.updateTimer(this.inactivity.initialTimer);
          this.events.emit("inactivityTimerUpdate", {
            secondsLeft: this.inactivity.initialTimer,
          });
        } else {
          console.warn(
            "[KubicKode.flow] Cannot reset timer - initialTimer is null"
          );
        }

        // Emit event for UI
        this.events.emit("turnUpdated", payload);
      },

      /**
       * Handle sessionEnded WebSocket event
       * @param {Object} payload - Event payload with reason
       */
      _handleSessionEnded: (payload) => {
        this.flow.phase = "session-ended";
        this.stopHeartbeat();

        // Clear inactivity timer since session has ended
        this.inactivity.clearTimer();

        // Emit high-level event for UI
        this.events.emit("sessionTerminated", {
          reason: payload.reason || "Unknown reason",
          details: payload.details || {},
        });
      },

      /**
       * Handle participantDisconnected WebSocket event
       * @param {Object} payload - Event payload
       */
      _handleParticipantDisconnected: (payload) => {
        // Don't show notification for own disconnection
        if (payload.participantId === this.participantId) {
          return;
        }

        // Emit UI notification event
        this.events.emit("participantConnectionChanged", {
          type: "disconnected",
          participantId: payload.participantId,
          participantName: payload.participantName || "Unknown participant",
          participantType: payload.participantType,
        });

        // Refresh participants list
        this.getParticipants().catch((err) => {
          console.error("[KubicKode.flow] Error refreshing participants:", err);
        });
      },

      /**
       * Handle participantRemoved WebSocket event
       * @param {Object} payload - Event payload
       */
      _handleParticipantRemoved: (payload) => {
        // Don't show notification for own removal
        if (payload.participantId === this.participantId) {
          return;
        }

        // Emit UI notification event
        this.events.emit("participantConnectionChanged", {
          type: "removed",
          participantId: payload.participantId,
          participantName: payload.participantName || "Unknown participant",
          reason: payload.reason || "timeout",
        });

        // Refresh participants list
        this.getParticipants().catch((err) => {
          console.error("[KubicKode.flow] Error refreshing participants:", err);
        });
      },

      /**
       * Handle participantReconnected WebSocket event
       * @param {Object} payload - Event payload
       */
      _handleParticipantReconnected: (payload) => {
        // Emit UI notification event
        this.events.emit("participantConnectionChanged", {
          type: "reconnected",
          participantId: payload.participantId,
          participantName: payload.participantName || "Unknown participant",
        });
      },

      /**
       * Handle timeLeft (inactivity timer) WebSocket event
       * @param {Object} payload - Event payload with secondsLeft
       */
      _handleTimeLeft: (payload) => {
        const secondsLeft = payload.secondsLeft;
        if (typeof secondsLeft === "number") {
          // Only update timer if there are enough players for the game to be playable
          const playableParticipants = this.session.getPlayableParticipants();

          // Only proceed if maxPlayers is set and we have enough players
          if (this.session.maxPlayers && playableParticipants.length >= this.session.maxPlayers) {
            this.inactivity.updateTimer(secondsLeft);

            // Emit event to trigger React re-render
            this.events.emit("inactivityTimerUpdate", { secondsLeft });
          }
        }
      },

      /**
       * Handle playerInactive WebSocket event
       * @param {Object} payload - Event payload with inactivePlayers
       */
      _handlePlayerInactive: (payload) => {
        // Clear inactivity timer
        this.inactivity.clearTimer();

        // Emit UI event to disable game
        this.events.emit("gameDisabledByInactivity");

        // Check if there's a winner from inactivity
        const inactivePlayers = payload.inactivePlayers;
        if (inactivePlayers && inactivePlayers.length > 0) {
          const firstInactiveResult = inactivePlayers[0];
          const inactivityStatus = firstInactiveResult.inactivityStatus;

          if (inactivityStatus?.winnerPlayerId) {
            const winnerParticipant = this.session.participants.find(
              (p) => p.id === inactivityStatus.winnerPlayerId
            );

            if (winnerParticipant) {
              this.flow.winner = winnerParticipant;
              this.flow.phase = "ended";
              this.game.updateGame({ active: false });

              // Emit high-level event for UI
              this.events.emit("gameEnded", {
                winner: winnerParticipant,
                isTie: false,
                reason: "inactivity",
              });
            }
          }
        }
      },

      /**
       * Handle sessionParticipantJoined WebSocket event
       * @param {Object} payload - Event payload
       */
      _handleSessionParticipantJoined: () => {
        // Refresh participants list
        this.getParticipants()
          .then((result) => {
            if (result.success) {
              // Update session participants from the API response
              const participants = Array.isArray(result.data)
                ? result.data
                : result.data.participants;
              this.session.updateParticipants(participants);

              // Update maxPlayers if provided
              if (result.data.maxPlayers) {
                this.session.updateSession({
                  maxPlayers: result.data.maxPlayers,
                });
              }
            }

            // Check if we should auto-start the game (now with updated participants)
            this.flow.checkAndAutoStart();
          })
          .catch((err) => {
            console.error(
              "[KubicKode.flow] Error refreshing participants:",
              err
            );
          });
      },

      /**
       * Handle sessionParticipantLeft WebSocket event
       * @param {Object} payload - Event payload
       */
      _handleSessionParticipantLeft: () => {
        // Refresh participants list and update session state
        this.getParticipants()
          .then((result) => {
            if (result.success) {
              // Update session participants from the API response
              const participants = Array.isArray(result.data)
                ? result.data
                : result.data.participants;
              this.session.updateParticipants(participants);

              // Update maxPlayers if provided
              if (result.data.maxPlayers) {
                this.session.updateSession({
                  maxPlayers: result.data.maxPlayers,
                });
              }

              // Check if there are enough playable participants for the game to continue
              const playableParticipants = participants.filter(
                (p) => p.type === "user" || p.type === "computer"
              );
              const maxPlayers = result.data.maxPlayers || this.session.maxPlayers;

              // If not enough players remain, clear the inactivity timer
              if (maxPlayers && playableParticipants.length < maxPlayers) {
                console.log("[KubicKode.flow] Not enough players to continue game, clearing timer");
                this.inactivity.clearTimer();
              }
            }
          })
          .catch((err) => {
            console.error("[KubicKode.flow] Error refreshing participants:", err);
          });
      },

      /**
       * Handle sessionSpectatorJoined WebSocket event
       * @param {Object} payload - Event payload
       */
      _handleSessionSpectatorJoined: () => {
        // Refresh participants list
        this.getParticipants()
          .then((result) => {
            if (result.success) {
              // Update session participants from the API response
              const participants = Array.isArray(result.data)
                ? result.data
                : result.data.participants;
              this.session.updateParticipants(participants);

              // Update maxPlayers if provided
              if (result.data.maxPlayers) {
                this.session.updateSession({
                  maxPlayers: result.data.maxPlayers,
                });
              }
            }
          })
          .catch((err) => {
            console.error(
              "[KubicKode.flow] Error refreshing participants:",
              err
            );
          });
      },

      /**
       * Handle gameStarted WebSocket event
       * @param {Object} payload - Event payload
       */
      _handleGameStarted: async (payload) => {
        // Update game state to reflect that game has started
        this.game.updateGame({
          started: true,
          active: true,
        });

        // Update player mappings if provided
        if (payload.playerMappings) {
          this.game.playerMappings = payload.playerMappings;
        }

        // Update tilemap if provided
        if (payload.updatedTileMap) {
          this.game.updateGame({ tilemap: payload.updatedTileMap });
        }

        // Fetch complete game state (tilemap, player mappings, current player)
        // This ensures all clients get the initial game state when the game starts
        try {
          const [tilemapResult, playerMappingsResult, currentPlayerResult] = await Promise.all([
            this.route.game("get-tilemap"),
            this.route.game("get-player-mappings"),
            this.route.game("get-current-player")
          ]);

          if (tilemapResult.success) {
            this.game.updateGame({ tilemap: tilemapResult.data });
          }

          if (playerMappingsResult.success) {
            this.game.updateGame({ playerMappings: playerMappingsResult.data.player_mappings });
          }

          if (currentPlayerResult.success) {
            const currentPlayerId = currentPlayerResult.data.current_player_id ||
              (currentPlayerResult.data.current_player_ids && currentPlayerResult.data.current_player_ids.length > 0
                ? currentPlayerResult.data.current_player_ids[0]
                : null);
            this.game.updateGame({ currentPlayerId });
          }
        } catch (error) {
          console.error("[KubicKode.flow] Error fetching game state after gameStarted:", error);
        }

        // Initialize inactivity timer from backend
        const initialTimer = payload.inactivityTimeout;
        this.inactivity.initialTimer = initialTimer; // Store for later resets
        this.inactivity.updateTimer(initialTimer);
        this.events.emit("inactivityTimerUpdate", {
          secondsLeft: initialTimer,
        });

        // Re-enable game UI if it was disabled by inactivity
        this.events.emit("gameReEnabled");
      },

      /**
       * Handle restartVoteStarted WebSocket event
       * @param {Object} payload - Event payload
       */
      _handleRestartVoteStarted: (payload) => {
        // Emit high-level event for UI
        this.events.emit("restartVotingStarted", {
          initiatorId: payload.initiatorId,
          participants: payload.participants,
        });
      },

      /**
       * Handle restartVoteUpdate WebSocket event
       * @param {Object} payload - Event payload with participantId and vote
       */
      _handleRestartVoteUpdate: (payload) => {
        console.log("[KubicKode.flow] Received kubic::restartVoteUpdate:", payload);
        // Update voting state in KubicKode.voting
        if (payload.participantId && payload.vote !== undefined) {
          this.voting.votes[payload.participantId] = payload.vote;
          console.log("[KubicKode.flow] Updated voting state:", this.voting.votes);
        }

        // Emit high-level event for UI
        console.log("[KubicKode.flow] Emitting restartVotingUpdated event");
        this.events.emit("restartVotingUpdated", {
          participantId: payload.participantId,
          vote: payload.vote,
          allVotes: { ...this.voting.votes },
        });
      },

      /**
       * Handle restartVoteResult WebSocket event
       * @param {Object} payload - Event payload with allAgreed boolean
       */
      _handleRestartVoteResult: (payload) => {
        const allAgreed = payload.allAgreed;

        // Emit high-level event for UI
        this.events.emit("restartVotingCompleted", {
          allAgreed,
          initiatorId: this.voting.initiatorId,
        });

        // Reset voting state after result
        setTimeout(() => {
          this.voting.reset();
        }, 100);
      },

      /**
       * Get current flow state
       * @returns {Object} Current flow state
       */
      getState: () => ({
        phase: this.flow.getCurrentPhase(),
        winner: this.flow.winner,
        autoStartEnabled: this.flow.autoStartEnabled,
        autoStartMode: this.flow.autoStartMode,
      }),

      /**
       * Reset flow state
       */
      reset: () => {
        this.flow.phase = "initializing";
        this.flow.winner = null;
        this.events.emit("flowReset");
      },

      /**
       * Setup all WebSocket event handlers for game flow
       * Call this once after connecting WebSocket to automatically handle all game events
       * @returns {KubicKodeHelper} This instance for chaining
       */
      setupEventHandlers: () => {
        // Game lifecycle events
        this.events.on("kubic::playerWon", this.flow._handlePlayerWon);
        this.events.on("kubic::gameTied", this.flow._handleGameTied);
        this.events.on("kubic::turnPlayed", this.flow._handleTurnPlayed);
        this.events.on("kubic::gameStarted", this.flow._handleGameStarted);
        this.events.on("kubic::winCount", this.flow._handleWinCount);

        // Session lifecycle events
        this.events.on("kubic::sessionEnded", this.flow._handleSessionEnded);
        this.events.on(
          "kubic::sessionParticipantJoined",
          this.flow._handleSessionParticipantJoined
        );
        this.events.on(
          "kubic::sessionSpectatorJoined",
          this.flow._handleSessionSpectatorJoined
        );
        this.events.on(
          "kubic::sessionParticipantLeft",
          this.flow._handleSessionParticipantLeft
        );

        // Connection lifecycle events
        this.events.on(
          "kubic::participantDisconnected",
          this.flow._handleParticipantDisconnected
        );
        this.events.on(
          "kubic::participantRemoved",
          this.flow._handleParticipantRemoved
        );
        this.events.on(
          "kubic::participantReconnected",
          this.flow._handleParticipantReconnected
        );

        // Inactivity events
        this.events.on("kubic::timeLeft", this.flow._handleTimeLeft);
        this.events.on("kubic::playerInactive", this.flow._handlePlayerInactive);

        // Restart voting events
        this.events.on(
          "kubic::restartVoteStarted",
          this.flow._handleRestartVoteStarted
        );
        this.events.on("kubic::restartVoteUpdate", this.flow._handleRestartVoteUpdate);
        this.events.on("kubic::restartVoteResult", this.flow._handleRestartVoteResult);

        return this;
      },

      /**
       * Remove all WebSocket event handlers
       * Call this when disconnecting to clean up
       * @returns {KubicKodeHelper} This instance for chaining
       */
      teardownEventHandlers: () => {
        // Game lifecycle events
        this.events.off("kubic::playerWon", this.flow._handlePlayerWon);
        this.events.off("kubic::gameTied", this.flow._handleGameTied);
        this.events.off("kubic::turnPlayed", this.flow._handleTurnPlayed);
        this.events.off("kubic::gameStarted", this.flow._handleGameStarted);
        this.events.off("kubic::winCount", this.flow._handleWinCount);

        // Session lifecycle events
        this.events.off("kubic::sessionEnded", this.flow._handleSessionEnded);
        this.events.off(
          "kubic::sessionParticipantJoined",
          this.flow._handleSessionParticipantJoined
        );
        this.events.off(
          "kubic::sessionSpectatorJoined",
          this.flow._handleSessionSpectatorJoined
        );
        this.events.off(
          "kubic::sessionParticipantLeft",
          this.flow._handleSessionParticipantLeft
        );

        // Connection lifecycle events
        this.events.off(
          "kubic::participantDisconnected",
          this.flow._handleParticipantDisconnected
        );
        this.events.off(
          "kubic::participantRemoved",
          this.flow._handleParticipantRemoved
        );
        this.events.off(
          "kubic::participantReconnected",
          this.flow._handleParticipantReconnected
        );

        // Inactivity events
        this.events.off("kubic::timeLeft", this.flow._handleTimeLeft);
        this.events.off("kubic::playerInactive", this.flow._handlePlayerInactive);

        // Restart voting events
        this.events.off(
          "kubic::restartVoteStarted",
          this.flow._handleRestartVoteStarted
        );
        this.events.off(
          "kubic::restartVoteUpdate",
          this.flow._handleRestartVoteUpdate
        );
        this.events.off(
          "kubic::restartVoteResult",
          this.flow._handleRestartVoteResult
        );

        return this;
      },
    };

    /**
     * Inactivity timer management
     * Tracks and interpolates inactivity timer from backend
     */
    inactivity = {
      // Inactivity state
      timerSeconds: null,
      lastUpdate: null,
      initialTimer: null, // Store the initial/max timer value for resets

      /**
       * Get live interpolated timer value
       * @returns {number|null} Seconds remaining, or null if no timer active
       */
      getLiveTimer: () => {
        if (
          this.inactivity.timerSeconds === null ||
          this.inactivity.lastUpdate === null
        ) {
          return null;
        }

        // Calculate elapsed time since last backend update
        const elapsedMs = Date.now() - this.inactivity.lastUpdate;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);

        // Start from backend's authoritative time and subtract local elapsed time
        const liveTimer = Math.max(
          0,
          this.inactivity.timerSeconds - elapsedSeconds
        );

        return liveTimer;
      },

      /**
       * Update timer from backend (authoritative source)
       * @param {number} seconds - Seconds left from backend
       */
      updateTimer: (seconds) => {
        this.inactivity.timerSeconds = seconds;
        this.inactivity.lastUpdate = Date.now();
        this.events.emit("inactivityTimerUpdated", {
          seconds,
          timestamp: this.inactivity.lastUpdate,
        });
      },

      /**
       * Clear inactivity timer
       */
      clearTimer: () => {
        this.inactivity.timerSeconds = null;
        this.inactivity.lastUpdate = null;
        this.events.emit("inactivityTimerCleared");
      },

      /**
       * Get current inactivity state
       * @returns {Object} Current inactivity state
       */
      getState: () => ({
        timerSeconds: this.inactivity.timerSeconds,
        lastUpdate: this.inactivity.lastUpdate,
        liveTimer: this.inactivity.getLiveTimer(),
      }),
    };

    /**
     * Get current state
     * @returns {Object} Object containing all current state information
     */
    getState() {
      return {
        sessionId: this.sessionId,
        currentGame: this.currentGame,
        registeredGames: Array.from(this.registeredGames.keys()),
        config: this.config,
        hasGameToken: !!this.gameToken,
        session: this.session.getState(),
        game: this.game.getState(),
        wins: this.wins.getState(),
        voting: this.voting.getState(),
        flow: this.flow.getState(),
        inactivity: this.inactivity.getState(),
      };
    }
  }

  // Create the singleton instance
  const KubicKode = new KubicKodeHelper();

  // Return exports for UMD pattern
  return {
    KubicKode: KubicKode,
    KubicKodeHelper: KubicKodeHelper,
  };
});
