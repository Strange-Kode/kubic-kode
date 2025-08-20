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
    console.log("🔧 Setting up KubicKode for browser global usage");
    const result = factory();
    global.KubicKode = result.KubicKode;
    global.KubicKodeHelper = result.KubicKodeHelper;
    console.log("✅ KubicKode available as window.KubicKode:", global.KubicKode);
  }
})(typeof window !== "undefined" ? window : this, function () {

class KubicKodeHelper {
  /**
   * Create a new KubicKodeHelper instance
   * @param {string} apiPrefix - The API base URL (default: "http://localhost:4000/api")
   */
  constructor(apiPrefix = "http://localhost:4000/api") {
    this.config = {
      apiPrefix: apiPrefix,
      defaultGame: null,
      autoReconnect: true,
      retryAttempts: 3,
      retryDelay: 1000
    };

    this.sessionId = null;
    this.participantId = null;
    this.currentGame = null;
    this.registeredGames = new Map();
    this.eventListeners = new Map();
    this.websocket = null;
    this.heartbeatInterval = null;
    this.gameToken = null; // Store the current game token

    // Create game object with proper context binding
    this.game = {
      register: (gameId) => {
        this.registeredGames.set(gameId, {
          id: gameId,
          routes: new Map()
        });

        // Create dynamic route methods for this game
        const gameRouteKey = gameId.replace(/-/g, "_");
        this.route[gameRouteKey] = {
          playTurn: (x, y, options = {}) => {
            return this._makeRequest("POST", `/${gameId}/play-turn/${this.sessionId}`, { 
              participantId: this.participantId,
              gameToken: this.gameToken,
              xPos: x, 
              yPos: y, 
              ...options 
            });
          },
          restartGame: (options = {}) => {
            return this._makeRequest("POST", `/${gameId}/restart-game/${this.sessionId}`, { 
              participantId: this.participantId,
              gameToken: this.gameToken,
              ...options 
            });
          }
          // Add more game-specific methods as needed
          // These will be available as: KubicKode.route.rps.playTurn(x, y)
        };

        return this;
      },

      use: (gameId) => {
        this.currentGame = gameId;
        return this;
      }
    };

    // Auto-connect WebSocket when session is initialized
    this.events.on("sessionInitialized", (data) => {
      console.log("🔌 Auto-connecting WebSocket after session initialization");
      this.connectWebSocket();
    });
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
          return await helper._makeRequest("GET", `/session/init/${helper.currentGame}`);
        case "join":
          const joinResult = await helper._makeRequest("POST", `/session/${helper.sessionId}/join`, data);
          // Store game token in localStorage when joining
          if (joinResult.success && joinResult.data.game_token) {
            helper.gameToken = joinResult.data.game_token;
            helper._storeGameToken(helper.sessionId, joinResult.data.game_token);
          }
          return joinResult;
        case "spectate":
          const spectateResult = await helper._makeRequest("POST", `/session/${helper.sessionId}/spectate`, data);
          // Store game token in localStorage when spectating
          if (spectateResult.success && spectateResult.data.game_token) {
            helper.gameToken = spectateResult.data.game_token;
            helper._storeGameToken(helper.sessionId, spectateResult.data.game_token);
          }
          return spectateResult;
        case "leave":
          const leaveResult = await helper._makeRequest("POST", `/session/${helper.sessionId}/leave`, data);
          // Clear game token from localStorage when leaving
          if (leaveResult.success) {
            helper._clearGameToken(helper.sessionId);
            helper.gameToken = null;
          }
          return leaveResult;
        case "participants":
          return await helper._makeRequest("GET", `/session/${helper.sessionId}/participants/list`);
        case "participant-stats":
          return await helper._makeRequest("GET", `/session/${helper.sessionId}/participants/stats`);
        case "restart-vote":
          return await helper._makeRequest("GET", `/session/${helper.sessionId}/request-restart-vote`);
        case "submit-vote":
          return await helper._makeRequest("POST", `/session/${helper.sessionId}/submit-restart-vote`, data);
        case "history":
          return await helper._makeRequest("POST", `/session/${helper.sessionId}/history`, data);
        default:
          throw new KubicClientError(`Unknown session action: ${action}`, "UNKNOWN_SESSION_ACTION", { action, availableActions: ["init", "join", "spectate", "leave", "participants", "participant-stats", "restart-vote", "submit-vote", "history"] });
      }
    },

    /**
     * Game-related routes - All now use POST with game tokens
     */
    game: async (action, data = {}) => {
      const helper = this;

      if (!helper.sessionId) {
        throw new KubicClientError("No active session. Call session.init() first.", "NO_ACTIVE_SESSION", { suggestion: "Call KubicKode.session.init() to create a session" });
      }

      // Ensure we have a game token
      if (!helper.gameToken) {
        helper.gameToken = helper._getGameToken(helper.sessionId);
        if (!helper.gameToken) {
          throw new KubicClientError("No game token available. Join or spectate session first.", "NO_GAME_TOKEN", { sessionId: helper.sessionId, suggestion: "Call KubicKode.session.join() or KubicKode.session.spectate() first" });
        }
      }

      switch (action) {
        case "start":
          return await helper._makeRequest("POST", `/game/${helper.sessionId}/start`, { 
            ...data, 
            participantId: helper.participantId,
            gameToken: helper.gameToken 
          });
        case "stop":
          return await helper._makeRequest("POST", `/game/${helper.sessionId}/stop`, { 
            participantId: helper.participantId,
            gameToken: helper.gameToken 
          });
        case "get-current-player":
          return await helper._makeRequest("POST", `/game/${helper.sessionId}/get-current-player`, {
            gameToken: helper.gameToken
          });
        case "is-active":
          return await helper._makeRequest("POST", `/game/${helper.sessionId}/is-active`, {
            gameToken: helper.gameToken
          });
        case "get-tilemap":
          return await helper._makeRequest("POST", `/game/${helper.sessionId}/get-tilemap`, {
            gameToken: helper.gameToken
          });
        case "options":
          return await helper._makeRequest("POST", `/game/${helper.sessionId}/options`, {
            gameToken: helper.gameToken
          });
        default:
          throw new KubicClientError(`Unknown game action: ${action}`, "UNKNOWN_GAME_ACTION", { action, availableActions: ["start", "stop", "get-current-player", "is-active", "get-tilemap", "options"] });
      }
    }
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
        this.eventListeners.get(eventType).forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in event listener for ${eventType}:`, error);
          }
        });
      }
      return this;
    }
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
    const hostPort = window.location.port || "3000";
    
    let wsUrl = `${protocol}://${hostIP}:${hostPort}/?sessionId=${this.sessionId}`;
    if (this.participantId) {
      wsUrl += `&participantId=${this.participantId}`;
    }
    
    console.log("🔌 Attempting WebSocket connection to:", wsUrl);
    this.websocket = new WebSocket(wsUrl);

    // Send participant name when WebSocket opens
    this.websocket.onopen = () => {
      console.log("🔌 WebSocket connected successfully");
      this.events.emit("websocketConnected");
      
      // Start heartbeat if we have participant ID
      if (this.participantId) {
        this.startHeartbeat();
      }
    };

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle heartbeat responses
        if (data.type === "heartbeat") {
          this.handleHeartbeat(data);
        } else if (data.type === "heartbeatResponse") {
          this.handleHeartbeatResponse(data);
        } else if (data.type === "connectionConfirmed") {
          console.log("🔌 Connection confirmed by server");
          this.events.emit("connectionConfirmed", data.payload);
        } else if (data.type === "participantDisconnected") {
          console.log("⚠️ Participant disconnected:", data.payload);
          this.events.emit("participantDisconnected", data.payload);
        } else if (data.type === "participantReconnected") {
          console.log("✅ Participant reconnected:", data.payload);
          this.events.emit("participantReconnected", data.payload);
        } else if (data.type === "sessionEnded") {
          console.log("🔚 Session ended:", data.payload);
          this.events.emit("sessionEnded", data.payload);
          this.stopHeartbeat();
        } else {
          this.events.emit(data.type, data.payload);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    this.websocket.onclose = (event) => {
      console.log("🔌 WebSocket disconnected:", event.code, event.reason);
      this.events.emit("websocketDisconnected", event);
      
      // Stop heartbeat on disconnect
      this.stopHeartbeat();

      // Only reconnect if autoReconnect is enabled and it's not a manual close
      if (this.config.autoReconnect && event.code !== 1000) {
        console.log("🔄 Attempting to reconnect in 1 second...");
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
    
    console.log("💓 Started heartbeat");
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log("💓 Stopped heartbeat");
    }
  }

  /**
   * Send heartbeat to server
   */
  sendHeartbeat() {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: "heartbeat",
        payload: { timestamp: Date.now() }
      }));
    }
  }

  /**
   * Handle incoming heartbeat from server
   * @param {Object} data - The heartbeat data
   */
  handleHeartbeat(data) {
    // Respond to server heartbeat
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: "heartbeat",
        payload: { timestamp: Date.now() }
      }));
    }
  }

  /**
   * Handle heartbeat response from server
   * @param {Object} data - The heartbeat response data
   */
  handleHeartbeatResponse(data) {
    // Server confirmed our heartbeat
    console.log("💓 Heartbeat confirmed by server");
  }

  /**
   * Send REST heartbeat to server
   */
  async sendRestHeartbeat() {
    if (!this.sessionId || !this.participantId) {
      return;
    }

    try {
      const response = await this._makeRequest("POST", `/session/${this.sessionId}/heartbeat`, {
        participantId: this.participantId
      });
      
      if (response.success) {
        console.log("💓 REST heartbeat sent successfully");
      }
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
      console.log("🔌 Manually disconnecting WebSocket");
      this.config.autoReconnect = false; // Prevent auto-reconnection
      this.websocket.close(1000, "Manual disconnect");
      this.websocket = null;
    }
    return this;
  }

  /**
   * Store game token in localStorage
   * @param {string} sessionId - The session ID
   * @param {string} gameToken - The game token to store for game authentication
   * @private
   */
  _storeGameToken(sessionId, gameToken) {
    try {
      const tokens = this._getAllGameTokens();
      tokens[sessionId] = gameToken;
      localStorage.setItem("kubic_game_tokens", JSON.stringify(tokens));
      console.log(`🔐 Stored game token for session: ${sessionId}`);
    } catch (error) {
      console.error("Error storing game token:", error);
    }
  }

  /**
   * Get game token from localStorage for game authentication
   * @param {string} sessionId - The session ID
   * @returns {string|null} The game token or null if not found
   * @private
   */
  _getGameToken(sessionId) {
    try {
      const tokens = this._getAllGameTokens();
      return tokens[sessionId] || null;
    } catch (error) {
      console.error("Error getting game token:", error);
      return null;
    }
  }

  /**
   * Clear game token from localStorage
   * @param {string} sessionId - The session ID
   * @private
   */
  _clearGameToken(sessionId) {
    try {
      const tokens = this._getAllGameTokens();
      delete tokens[sessionId];
      localStorage.setItem("kubic_game_tokens", JSON.stringify(tokens));
      console.log(`🔐 Cleared game token for session: ${sessionId}`);
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
      console.log("🔐 Cleared all game tokens");
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
        "Content-Type": "application/json"
      }
    };

    if (data && method !== "GET") {
      options.body = JSON.stringify(data);
    }

    let lastError;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          throw new KubicClientError(`HTTP ${response.status}: ${response.statusText}`, "HTTP_ERROR", { status: response.status, statusText: response.statusText, url, method });
        }

        const result = await response.json();

        // Auto-set sessionId from init response
        if (endpoint.includes("/session/init/") && result.session_id) {
          this.sessionId = result.session_id;
          this.events.emit("sessionInitialized", { sessionId: this.sessionId });
        }

        return {
          success: true,
          data: result
        };

      } catch (error) {
        lastError = error;
        console.warn(`Request attempt ${attempt} failed:`, error.message);

        if (attempt < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
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
    const result = await this.route.session("join", { participantName, participantType });
    if (result.success && result.data.participant_id) {
      this.participantId = result.data.participant_id;
    }
    return result;
  }

  async spectateSession(participantName) {
    const result = await this.route.session("spectate", { participantName });
    if (result.success && result.data.participant_id) {
      this.participantId = result.data.participant_id;
    }
    return result;
  }

  async leaveSession() {
    if (!this.participantId || !this.sessionId) {
      throw new KubicClientError("No active session or participant to leave", "NO_SESSION_TO_LEAVE", { participantId: this.participantId, sessionId: this.sessionId });
    }
    
    const result = await this.route.session("leave", { participantId: this.participantId });
    if (result.success) {
      this.participantId = null;
      this.sessionId = null;
      this.gameToken = null;
      this.disconnectWebSocket();
    }
    return result;
  }

  async startGame(options = {}) {
    return await this.route.game("start", options);
  }

  async playTurn(x, y, additionalData = {}) {
    if (!this.currentGame) {
      throw new KubicClientError("No game selected. Call game.use() first.", "NO_GAME_SELECTED", { suggestion: "Call KubicKode.game.use(gameId) to select a game" });
    }

    const gameRoute = this.currentGame.replace(/-/g, "_");
    if (this.route[gameRoute] && this.route[gameRoute].playTurn) {
      return await this.route[gameRoute].playTurn(x, y, additionalData);
    } else {
      throw new KubicClientError(`Game '${this.currentGame}' not registered. Call game.register("${this.currentGame}") first.`, "GAME_NOT_REGISTERED", { gameId: this.currentGame, suggestion: `Call KubicKode.game.register("${this.currentGame}") first` });
    }
  }

  /**
   * Get current session state
   * @returns {Object} Object containing current session information
   */
  getState() {
    return {
      sessionId: this.sessionId,
      currentGame: this.currentGame,
      registeredGames: Array.from(this.registeredGames.keys()),
      config: this.config,
      hasGameToken: !!this.gameToken
    };
  }
}

// Create the singleton instance
const KubicKode = new KubicKodeHelper();
console.log("🔧 Created KubicKode instance:", KubicKode);

// Return exports for UMD pattern
return {
  KubicKode: KubicKode,
  KubicKodeHelper: KubicKodeHelper
};

}); 