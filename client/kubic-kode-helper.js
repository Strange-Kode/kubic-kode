/**
 * KubicKode Helper - Client-side game development helper
 * Provides a clean API for interacting with KubicKode game server
 * Eliminates HTTP boilerplate and manages session state automatically
 */

class KubicKodeHelper {
  constructor() {
    this.config = {
      apiPrefix: 'http://localhost:3000/api',
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
    
    // Bind methods to maintain context
    this.route = this.route.bind(this);
    this.game = this.game.bind(this);
    this.events = this.events.bind(this);
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
   */
  game = {
    /**
     * Register a game type
     */
    register: (gameId) => {
      const helper = this;
      helper.registeredGames.set(gameId, {
        id: gameId,
        routes: new Map()
      });
      
      // Create dynamic route methods for this game
      helper[gameId.replace(/-/g, '_')] = {
        playTurn: (x, y, options = {}) => 
          helper.route[gameId.replace(/-/g, '_')]('play-turn', { x, y, ...options }),
        getTileMap: () => 
          helper.route.game('get-tilemap'),
        getCurrentPlayer: () => 
          helper.route.game('get-current-player'),
        isActive: () => 
          helper.route.game('is-active')
      };
      
      return helper;
    },

    /**
     * Set the current game context
     */
    use: (gameId) => {
      this.currentGame = gameId;
      return this;
    }
  };

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
    if (this.websocket) {
      this.websocket.close();
    }

    const wsUrl = this.config.apiPrefix.replace('/api', '').replace('http', 'ws') + '/ws';
    this.websocket = new WebSocket(wsUrl);

    this.websocket.onopen = () => {
      console.log('🔌 WebSocket connected');
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

    this.websocket.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      this.events.emit('websocketDisconnected');
      
      if (this.config.autoReconnect) {
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
    return await this.route[gameRoute]('play-turn', { x, y, ...additionalData });
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

// Create and export the singleton instance
export const KubicKode = new KubicKodeHelper();

// Also export the class for testing/custom instances
export { KubicKodeHelper }; 