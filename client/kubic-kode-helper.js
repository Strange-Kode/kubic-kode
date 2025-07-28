/**
 * KubicKode Helper - Client-side game development helper
 * Provides a clean API for interacting with KubicKode game server
 * Eliminates HTTP boilerplate and manages session state automatically
 * 
 * Available as:
 * - ES6 module: import { KubicKode, KubicKodeHelper } from './kubic-kode-helper.js'
 * - Browser global: window.KubicKode, window.KubicKodeHelper
 */

(function (global, factory) {
  // UMD pattern to support multiple module systems
  if (typeof module === 'object' && typeof module.exports === 'object') {
    // CommonJS
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    // AMD
    define(factory);
  } else if (typeof exports !== 'undefined') {
    // ES6 module environment
    const result = factory();
    exports.KubicKode = result.KubicKode;
    exports.KubicKodeHelper = result.KubicKodeHelper;
  } else {
    // Browser global
    console.log('🔧 Setting up KubicKode for browser global usage');
    const result = factory();
    global.KubicKode = result.KubicKode;
    global.KubicKodeHelper = result.KubicKodeHelper;
    console.log('✅ KubicKode available as window.KubicKode:', global.KubicKode);
  }
})(typeof window !== 'undefined' ? window : this, function () {

class KubicKodeHelper {
  constructor(apiPrefix = 'http://localhost:4000/api') {
    this.config = {
      apiPrefix: apiPrefix,
      defaultGame: null,
      autoReconnect: true,
      retryAttempts: 3,
      retryDelay: 1000
    };

    this.sessionId = null;
    this.currentGame = null;
    this.registeredGames = new Map();
    this.eventListeners = new Map();
    this.websocket = null;

    // Create game object with proper context binding
    this.game = {
      register: (gameId) => {
        this.registeredGames.set(gameId, {
          id: gameId,
          routes: new Map()
        });

        // Create dynamic route methods for this game
        const gameRouteKey = gameId.replace(/-/g, '_');
        this.route[gameRouteKey] = {
          playTurn: (x, y, options = {}) => {
            return this._makeRequest('POST', `/${gameId}/play-turn/${this.sessionId}`, { xPos: x, yPos: y, ...options });
          },
          restartGame: (options = {}) => {
            return this._makeRequest('POST', `/${gameId}/restart-game/${this.sessionId}`, options);
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
    this.events.on('sessionInitialized', (data) => {
      console.log('🔌 Auto-connecting WebSocket after session initialization');
      this.connectWebSocket();
    });
  }

  /**
   * Configure the KubicKode helper
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
        case 'init':
          return await helper._makeRequest('GET', `/session/init/${helper.currentGame}`);
        case 'join':
          return await helper._makeRequest('POST', `/session/${helper.sessionId}/join`, data);
        case 'leave':
          return await helper._makeRequest('POST', `/session/${helper.sessionId}/leave`, data);
        case 'participants':
          return await helper._makeRequest('GET', `/session/participants/list/${helper.sessionId}`);
        case 'restart-vote':
          return await helper._makeRequest('GET', `/session/request-restart-vote/${helper.sessionId}`);
        case 'submit-vote':
          return await helper._makeRequest('POST', `/session/submit-restart-vote/${helper.sessionId}`, data);
        case 'history':
          return await helper._makeRequest('POST', `/session/history/${helper.sessionId}`, data);
        default:
          throw new Error(`Unknown session action: ${action}`);
      }
    },

    /**
     * Game-related routes
     */
    game: async (action, data = {}) => {
      const helper = this;

      if (!helper.sessionId) {
        throw new Error('No active session. Call session.init() first.');
      }

      switch (action) {
        case 'start':
          return await helper._makeRequest('POST', `/game/start/${helper.sessionId}`, data);
        case 'stop':
          return await helper._makeRequest('GET', `/game/stop/${helper.sessionId}`);
        case 'get-current-player':
          return await helper._makeRequest('GET', `/game/get-current-player/${helper.sessionId}`);
        case 'is-active':
          return await helper._makeRequest('GET', `/game/is-active/${helper.sessionId}`);
        case 'get-tilemap':
          return await helper._makeRequest('GET', `/game/get-tilemap/${helper.sessionId}`);
        case 'options':
          return await helper._makeRequest('GET', `/game/options/${helper.sessionId}`);
        default:
          throw new Error(`Unknown game action: ${action}`);
      }
    }
  };

  /**
   * Event management
   */
  events = {
    on: (eventType, callback) => {
      if (!this.eventListeners.has(eventType)) {
        this.eventListeners.set(eventType, []);
      }
      this.eventListeners.get(eventType).push(callback);
      return this;
    },

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
   */
  connectWebSocket() {
    if (!this.sessionId) {
      console.warn('🔌 Cannot connect WebSocket: No sessionId available');
      return this;
    }

    if (this.websocket) {
      this.websocket.close();
    }

    // Construct WebSocket URL using the same approach as the working implementation
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    
    const hostIP = window.location.hostname;
    const hostPort = window.location.port || '3000';
    
    const wsUrl = `${protocol}://${hostIP}:${hostPort}/?sessionId=${this.sessionId}`;
    
    console.log('🔌 Attempting WebSocket connection to:', wsUrl);
    this.websocket = new WebSocket(wsUrl);

    // Send participant name when WebSocket opens
    this.websocket.onopen = () => {
      console.log('🔌 WebSocket connected successfully');
      this.events.emit('websocketConnected');
    };

    this.websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.events.emit(data.type, data.payload);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.websocket.onclose = (event) => {
      console.log('🔌 WebSocket disconnected:', event.code, event.reason);
      this.events.emit('websocketDisconnected', event);

      // Only reconnect if autoReconnect is enabled and it's not a manual close
      if (this.config.autoReconnect && event.code !== 1000) {
        console.log('🔄 Attempting to reconnect in 1 second...');
        setTimeout(() => this.connectWebSocket(), 1000);
      }
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.events.emit('websocketError', error);
    };

    return this;
  }

  /**
   * Disconnect WebSocket connection
   */
  disconnectWebSocket() {
    if (this.websocket) {
      console.log('🔌 Manually disconnecting WebSocket');
      this.config.autoReconnect = false; // Prevent auto-reconnection
      this.websocket.close(1000, 'Manual disconnect');
      this.websocket = null;
    }
    return this;
  }

  /**
   * Make HTTP request with retry logic
   */
  async _makeRequest(method, endpoint, data = null) {
    const url = `${this.config.apiPrefix}${endpoint}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    let lastError;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, options);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        // Auto-set sessionId from init response
        if (endpoint.includes('/session/init/') && result.session_id) {
          this.sessionId = result.session_id;
          this.events.emit('sessionInitialized', { sessionId: this.sessionId });
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
    return await this.route.session('init');
  }

  async joinSession(participantName, participantType = 'human') {
    return await this.route.session('join', { participantName, participantType });
  }

  async startGame(options = {}) {
    return await this.route.game('start', options);
  }

  async playTurn(x, y, additionalData = {}) {
    if (!this.currentGame) {
      throw new Error('No game selected. Call game.use() first.');
    }

    const gameRoute = this.currentGame.replace(/-/g, '_');
    if (this.route[gameRoute] && this.route[gameRoute].playTurn) {
      return await this.route[gameRoute].playTurn(x, y, additionalData);
    } else {
      throw new Error(`Game '${this.currentGame}' not registered. Call game.register('${this.currentGame}') first.`);
    }
  }

  /**
   * Get current session state
   */
  getState() {
    return {
      sessionId: this.sessionId,
      currentGame: this.currentGame,
      registeredGames: Array.from(this.registeredGames.keys()),
      config: this.config
    };
  }
}

// Create the singleton instance
const KubicKode = new KubicKodeHelper();
console.log('🔧 Created KubicKode instance:', KubicKode);

// Return exports for UMD pattern
return {
  KubicKode: KubicKode,
  KubicKodeHelper: KubicKodeHelper
};

}); 