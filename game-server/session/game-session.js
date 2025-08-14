import { InactivityManager } from "../../game-utility/inactivity-manager.js";
import { SessionParticipantManager } from "./session-participant-manager.js";
import { SessionLobbyManager } from "./session-lobby-manager.js";
import { SessionChatManager } from "./session-chat-manager.js";
import { SessionVoteManager } from "./session-vote-manager.js";
import { SessionConnectionManager } from "./session-connection-manager.js";
import { SessionHistoryManager } from "./session-history-manager.js";

export class GameSession {
  /**
   * Create a new game session
   * @param {string} sessionId - Unique identifier for the session
   * @param {number} maxParticipants - Maximum number of participants allowed (default: 2)
   * @param {string|null} gameVariantId - Optional game variant identifier
   */
  constructor(sessionId, maxParticipants = 2, gameVariantId = null) {
    this._sessionId = sessionId;
    this._maxParticipants = maxParticipants;
    this._gameVariantId = gameVariantId;
    this._started = false;
    this._winCounter = 0;
    this._restartCounter = 0; // Track number of game restarts for alternating first player
    this._gameInstance = null;
    this._inactivityManager = null;

    // Initialize all manager classes
    this._participantManager = new SessionParticipantManager(sessionId);
    this._lobbyManager = new SessionLobbyManager(this._participantManager);
    this._chatManager = new SessionChatManager(this._participantManager);
    this._voteManager = new SessionVoteManager(sessionId);
    this._connectionManager = new SessionConnectionManager(sessionId, this._participantManager);
    this._historyManager = new SessionHistoryManager(sessionId);
  }

  // Protected property getters - prevent direct access to protected properties
  get winCounter() {
    throw new Error("Attempting to access winCounter property on GameSession. Not allowed, winCounter is a protected property. Use getWinCounter() instead.");
  }

  get restartCounter() {
    throw new Error("Attempting to access restartCounter property on GameSession. Not allowed, restartCounter is a protected property. Use getRestartCounter() instead.");
  }

  get participants() {
    throw new Error("Attempting to access participants property on GameSession. Not allowed, participants is a protected property. Use getParticipants() instead.");
  }

  get maxParticipants() {
    throw new Error("Attempting to access maxParticipants property on GameSession. Not allowed, maxParticipants is a protected property. Use getMaxParticipants() instead.");
  }

  get started() {
    throw new Error("Attempting to access started property on GameSession. Not allowed, started is a protected property. Use isStarted() instead.");
  }

  get sessionId() {
    throw new Error("Attempting to access sessionId property on GameSession. Not allowed, sessionId is a protected property. Use getSessionId() instead.");
  }

  get gameVariantId() {
    throw new Error("Attempting to access gameVariantId property on GameSession. Not allowed, gameVariantId is a protected property. Use getGameVariantId() instead.");
  }

  get restartVote() {
    throw new Error("Attempting to access restartVote property on GameSession. Not allowed, restartVote is a protected property. Use getRestartVote() instead.");
  }

  get inactivityManager() {
    throw new Error("Attempting to access inactivityManager property on GameSession. Not allowed, inactivityManager is a protected property. Use getInactivityManager() instead.");
  }

  get gameHistory() {
    throw new Error("Attempting to access gameHistory property on GameSession. Not allowed, gameHistory is a protected property. Use getGameHistory() instead.");
  }

  get participantTokens() {
    throw new Error("Attempting to access participantTokens property on GameSession. Not allowed, participantTokens is a private property. Use getAllParticipantTokens() instead.");
  }

  // Manager getters - allow direct access to managers
  getParticipantManager() {
    return this._participantManager;
  }

  getLobbyManager() {
    return this._lobbyManager;
  }

  getChatManager() {
    return this._chatManager;
  }

  getVoteManager() {
    return this._voteManager;
  }

  getConnectionManager() {
    return this._connectionManager;
  }

  getHistoryManager() {
    return this._historyManager;
  }

  // Core session methods
  setGameInstance(gameInstance) {
    this._gameInstance = gameInstance;
  }

  getGameInstance() {
    return this._gameInstance;
  }

  getWinCounter() {
    return this._winCounter;
  }

  increaseWinCounter() {
    this._winCounter++;
  }

  resetWinCounter() {
    this._winCounter = 0;
  }

  getRestartCounter() {
    return this._restartCounter;
  }

  increaseRestartCounter() {
    this._restartCounter++;
  }

  resetRestartCounter() {
    this._restartCounter = 0;
  }

  addParticipant(name, participant_type = "user") {
    const participantId = this._participantManager.addParticipant(name, participant_type, this._maxParticipants, this._started);

    // Initialize ready state for playable participants
    if (this._participantManager.isParticipantPlayable(this._participantManager.getParticipantById(participantId))) {
      this._lobbyManager.initializeReadyState(participantId);
    }

    // Add to game history
    this._historyManager.addParticipantJoinedEvent(participantId, name, participant_type);

    return participantId;
  }

  removeParticipant(id) {
    const participant = this._participantManager.getParticipantById(id);
    if (!participant) {
      throw new Error("Participant not found.");
    }

    this._lobbyManager.removeReadyState(id);
    this._participantManager.removeParticipant(id);

    // Add to game history
    this._historyManager.addParticipantLeftEvent(id, participant.name);
  }

  markStarted() {
    // Count only playable participants for game start requirement
    const playableParticipants = this._participantManager.getPlayableParticipants();
    if (playableParticipants.length < 2) {
      throw new Error("Cannot start game. Not enough players (need at least 2 playable participants).");
    }

    if (this._inactivityManager) {
      this._inactivityManager.clearTimer();
      this._inactivityManager = null;
    }

    this._started = true;
    if (this._gameInstance && this._gameInstance.handleInactivity) {
      const inactivityManager = new InactivityManager(this, this._gameInstance);
      this._inactivityManager = inactivityManager;
      inactivityManager.startTimer();
    } else {
      this._inactivityManager = null;
    }

    // Start heartbeat for the session
    this._connectionManager.startHeartbeat();

    // Add to game history
    this._historyManager.addSessionStartedEvent(this._participantManager.getParticipants());
  }

  markEnded() {
    this._started = false;
    if (this._inactivityManager) {
      this._inactivityManager.clearTimer();
    }

    // Stop heartbeat
    this._connectionManager.stopHeartbeat();

    // Add to game history
    this._historyManager.addSessionEndedEvent(this._participantManager.getParticipantCount());
  }

  getSessionId() {
    return this._sessionId;
  }

  getMaxParticipants() {
    return this._maxParticipants;
  }

  isStarted() {
    return this._started;
  }

  getGameVariantId() {
    return this._gameVariantId;
  }

  getInactivityManager() {
    return this._inactivityManager;
  }

  // Convenience methods for common operations
  listParticipants() {
    return this._participantManager.listParticipants();
  }

  getParticipants() {
    return this._participantManager.getParticipants();
  }

  getParticipantById(id) {
    return this._participantManager.getParticipantById(id);
  }

  getPlayableParticipants() {
    return this._participantManager.getPlayableParticipants();
  }

  getSpectatorParticipants() {
    return this._participantManager.getSpectatorParticipants();
  }

  isParticipantPlayable(participant) {
    return this._participantManager.isParticipantPlayable(participant);
  }

  // Session status and viability
  checkSessionViability() {
    return this._connectionManager.checkSessionViability(this._gameInstance);
  }

  getSessionStatus() {
    return this._connectionManager.getSessionStatus(this._gameInstance);
  }

  getLobbyStatus() {
    const lobbyStatus = this._lobbyManager.getLobbyStatus();
    lobbyStatus.started = this._started;
    lobbyStatus.gameVariantId = this._gameVariantId;
    lobbyStatus.maxPlayers = this._maxParticipants;
    lobbyStatus.recentChat = this._chatManager.getRecentChat(10);
    return lobbyStatus;
  }

  // Connection management convenience methods
  updateParticipantConnection(participantId, connected) {
    this._participantManager.updateParticipantConnection(participantId, connected);
  }

  isParticipantConnected(participantId) {
    return this._participantManager.isParticipantConnected(participantId);
  }

  getConnectedParticipants() {
    return this._participantManager.getConnectedParticipants();
  }

  getDisconnectedParticipants() {
    return this._participantManager.getDisconnectedParticipants();
  }

  // Game history convenience method
  getGameHistory() {
    return this._historyManager.getGameHistory();
  }

  // Game token convenience method
  async generateParticipantToken(participantId) {
    return this._participantManager.generateParticipantToken(participantId);
  }

  // Additional convenience methods for session-routes.js
  getMaxParticipants() {
    return this._maxParticipants;
  }

  isStarted() {
    return this._started;
  }

  getGameVariantId() {
    return this._gameVariantId;
  }

  handleParticipantReconnection(participantId) {
    const result = this._connectionManager.handleParticipantReconnection(participantId);
    
    // Check if this reconnection makes the session viable again
    if (this._started) {
      this.checkSessionViability();
    }
    
    return result;
  }

  handleParticipantDisconnection(participantId) {
    const result = this._connectionManager.handleParticipantDisconnection(participantId);
    
    // Check session viability
    if (this._started) {
      this.checkSessionViability();
    }
    
    return result;
  }
}
