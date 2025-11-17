/**
 * KubicKode Helper - Main orchestrator
 * Client-side game development SDK that provides a clean API for interacting with KubicKode game server
 *
 * This orchestrator wires together all modular components:
 * - Core: Configuration and error handling
 * - Network: HTTP and WebSocket clients, token management
 * - Events: Event emission and listening
 * - State: Session, game, wins, voting, inactivity, and flow state
 * - API: Session and game routes, game registration
 * - Convenience: High-level API methods
 */

import { DEFAULT_CONFIG } from "./constants.js";
import { KubicClientError } from "./errors.js";
import { createHttpClient } from "../network/http-client.js";
import { createWebSocketClient } from "../network/websocket-client.js";
import { createTokenManager } from "../network/token-manager.js";
import { createEventEmitter } from "../events/event-emitter.js";
import { createSessionState } from "../state/session-state.js";
import { createGameState } from "../state/game-state.js";
import { createWinsState } from "../state/wins-state.js";
import { createVotingState } from "../state/voting-state.js";
import { createInactivityState } from "../state/inactivity-state.js";
import { createFlowState } from "../state/flow-state.js";
import { createConfigState } from "../state/config-state.js";
import { createSessionRoutes } from "../api/session-routes.js";
import { createGameRoutes } from "../api/game-routes.js";
import { createGameRegistry } from "../api/game-registry.js";
import { createHighLevelAPI } from "../convenience/high-level-api.js";

/**
 * KubicKodeHelper - Main SDK class
 * Orchestrates all modules and provides the public API
 */
export class KubicKodeHelper {
  /**
   * Create a new KubicKodeHelper instance
   * @param {string} apiPrefix - Optional API base URL (defaults to value from constants.js)
   */
  constructor(apiPrefix) {
    // Core configuration - use DEFAULT_CONFIG and only override apiPrefix if provided
    this.config = {
      ...DEFAULT_CONFIG,
      ...(apiPrefix && { apiPrefix }),
    };

    // Core state
    this.sessionId = null;
    this.participantId = null;
    this.currentGame = null;
    this.registeredGames = new Map();
    this.gameToken = null;

    // Event listeners storage (used by event-emitter)
    this.eventListeners = new Map();

    // WebSocket state (used by websocket-client)
    this.websocket = null;
    this.heartbeatInterval = null;

    // Initialize network layer
    this.http = createHttpClient(this);
    this.ws = createWebSocketClient(this);
    this.tokens = createTokenManager(this);

    // Initialize events
    this.events = createEventEmitter(this);

    // Initialize state modules
    this.session = createSessionState(this);
    this.game = createGameState(this);
    this.wins = createWinsState(this);
    this.voting = createVotingState(this);
    this.inactivity = createInactivityState(this);
    this.flow = createFlowState(this);
    this.sessionConfig = createConfigState(this);

    // Initialize API routes
    this.route = {
      session: createSessionRoutes(this),
      game: createGameRoutes(this),
    };

    // Attach game registry (adds game.register() and game.use())
    const gameRegistry = createGameRegistry(this);
    this.game.register = gameRegistry.register;
    this.game.use = gameRegistry.use;

    // Attach high-level convenience methods
    const highLevelAPI = createHighLevelAPI(this);

    // Attach all convenience methods to this instance
    this.initSession = highLevelAPI.initSession;
    this.joinSession = highLevelAPI.joinSession;
    this.spectateSession = highLevelAPI.spectateSession;
    this.leaveSession = highLevelAPI.leaveSession;
    this.addAIParticipant = highLevelAPI.addAIParticipant;
    this.joinAsSpectator = highLevelAPI.joinAsSpectator;
    this.getSessionStats = highLevelAPI.getSessionStats;
    this.getParticipants = highLevelAPI.getParticipants;
    this.getGameHistory = highLevelAPI.getGameHistory;
    this.checkSessionAvailability = highLevelAPI.checkSessionAvailability;
    this.syncSessionState = highLevelAPI.syncSessionState;
    this.startGame = highLevelAPI.startGame;
    this.playTurn = highLevelAPI.playTurn;
    this.requestRestartVote = highLevelAPI.requestRestartVote;
    this.submitRestartVote = highLevelAPI.submitRestartVote;
    this.listAllSessions = highLevelAPI.listAllSessions;
    this.listJoinableSessions = highLevelAPI.listJoinableSessions;
    this.listSessionsByGame = highLevelAPI.listSessionsByGame;
    this.autoJoinSession = highLevelAPI.autoJoinSession;
    this.getSessionLobbyStatus = highLevelAPI.getSessionLobbyStatus;
    this.setGameConfig = highLevelAPI.setGameConfig;
    this.getGameConfig = highLevelAPI.getGameConfig;
    this.deleteGameConfigKey = highLevelAPI.deleteGameConfigKey;
    this.getShareableSessionLink = highLevelAPI.getShareableSessionLink;

    // Attach WebSocket methods for backward compatibility
    this.connectWebSocket = this.ws.connect.bind(this.ws);
    this.disconnectWebSocket = this.ws.disconnect.bind(this.ws);
    this.startHeartbeat = this.ws.startHeartbeat.bind(this.ws);
    this.stopHeartbeat = this.ws.stopHeartbeat.bind(this.ws);
    this.sendHeartbeat = this.ws.sendHeartbeat.bind(this.ws);
    this.handleHeartbeat = this.ws.handleHeartbeat.bind(this.ws);
    this.handleHeartbeatResponse = this.ws.handleHeartbeatResponse.bind(
      this.ws
    );
    this.sendRestHeartbeat = this.ws.sendRestHeartbeat.bind(this.ws);

    // Attach token management methods for backward compatibility
    this._storeGameToken = this.tokens.store.bind(this.tokens);
    this._getGameToken = this.tokens.get.bind(this.tokens);
    this._clearGameToken = this.tokens.clear.bind(this.tokens);
    this._getAllGameTokens = this.tokens.getAll.bind(this.tokens);
    this.clearAllGameTokens = this.tokens.clearAll.bind(this.tokens);

    // Attach HTTP client for backward compatibility
    this._makeRequest = this.http.makeRequest.bind(this.http);

    // Export KubicClientError for external use
    this.KubicClientError = KubicClientError;

    // Setup WebSocket event handlers for game flow
    // This enables auto-start, game state updates, and all WebSocket-driven features
    this.flow.setupEventHandlers();
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
      sessionConfig: this.sessionConfig.getState(),
    };
  }
}
