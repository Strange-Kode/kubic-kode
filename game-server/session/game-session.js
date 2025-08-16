import { InactivityManager } from "../../game-utility/inactivity-manager.js";
import { SessionParticipantManager } from "./session-participant-manager.js";
import { SessionLobbyManager } from "./session-lobby-manager.js";
import { SessionChatManager } from "./session-chat-manager.js";
import { SessionVoteManager } from "./session-vote-manager.js";
import { SessionConnectionManager } from "./session-connection-manager.js";
import { SessionHistoryManager } from "./session-history-manager.js";
import { 
  KubicSystemError, 
  KubicValidationError, 
  ErrorFactory,
  ErrorCodes 
} from "../../game-engine/kubic-kode-error.js";

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
    throw ErrorFactory.system(
      "Attempting to access winCounter property on GameSession. Not allowed, winCounter is a protected property. Use getWinCounter() instead.",
      "GameSession",
      { context: { suggestion: "Use getWinCounter() method instead", property: "winCounter" } }
    );
  }

  get restartCounter() {
    throw ErrorFactory.system(
      "Attempting to access restartCounter property on GameSession. Not allowed, restartCounter is a protected property. Use getRestartCounter() instead.",
      "GameSession",
      { context: { suggestion: "Use getRestartCounter() method instead", property: "restartCounter" } }
    );
  }

  get participants() {
    throw ErrorFactory.system(
      "Attempting to access participants property on GameSession. Not allowed, participants is a protected property. Use getParticipants() instead.",
      "GameSession",
      { context: { suggestion: "Use getParticipants() method instead", property: "participants" } }
    );
  }

  get maxParticipants() {
    throw ErrorFactory.system(
      "Attempting to access maxParticipants property on GameSession. Not allowed, maxParticipants is a protected property. Use getMaxParticipants() instead.",
      "GameSession",
      { context: { suggestion: "Use getMaxParticipants() method instead", property: "maxParticipants" } }
    );
  }

  get started() {
    throw ErrorFactory.system(
      "Attempting to access started property on GameSession. Not allowed, started is a protected property. Use isStarted() instead.",
      "GameSession",
      { context: { suggestion: "Use isStarted() method instead", property: "started" } }
    );
  }

  get sessionId() {
    throw ErrorFactory.system(
      "Attempting to access sessionId property on GameSession. Not allowed, sessionId is a protected property. Use getSessionId() instead.",
      "GameSession",
      { context: { suggestion: "Use getSessionId() method instead", property: "sessionId" } }
    );
  }

  get gameVariantId() {
    throw ErrorFactory.system(
      "Attempting to access gameVariantId property on GameSession. Not allowed, gameVariantId is a protected property. Use getGameVariantId() instead.",
      "GameSession",
      { context: { suggestion: "Use getGameVariantId() method instead", property: "gameVariantId" } }
    );
  }

  get restartVote() {
    throw ErrorFactory.system(
      "Attempting to access restartVote property on GameSession. Not allowed, restartVote is a protected property. Use getRestartVote() instead.",
      "GameSession",
      { context: { suggestion: "Use getRestartVote() method instead", property: "restartVote" } }
    );
  }

  get inactivityManager() {
    throw ErrorFactory.system(
      "Attempting to access inactivityManager property on GameSession. Not allowed, inactivityManager is a protected property. Use getInactivityManager() instead.",
      "GameSession",
      { context: { suggestion: "Use getInactivityManager() method instead", property: "inactivityManager" } }
    );
  }

  get gameHistory() {
    throw ErrorFactory.system(
      "Attempting to access gameHistory property on GameSession. Not allowed, gameHistory is a protected property. Use getGameHistory() instead.",
      "GameSession",
      { context: { suggestion: "Use getGameHistory() method instead", property: "gameHistory" } }
    );
  }

  get participantTokens() {
    throw ErrorFactory.system(
      "Attempting to access participantTokens property on GameSession. Not allowed, participantTokens is a private property. Use getAllParticipantTokens() instead.",
      "GameSession",
      { context: { suggestion: "Use getAllParticipantTokens() method instead", property: "participantTokens" } }
    );
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
      throw ErrorFactory.validation(
        "Participant not found",
        "participantId",
        id,
        { context: { method: "GameSession.removeParticipant", suggestion: "Check if the participant ID is correct and the participant exists" } }
      );
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
      throw ErrorFactory.validation(
        "Cannot start game. Not enough players (need at least 2 playable participants)",
        "playableParticipants",
        playableParticipants,
        { context: { 
          method: "GameSession.markStarted", 
          currentCount: playableParticipants.length,
          requiredCount: 2,
          suggestion: "Add more playable participants before starting the game"
        } }
      );
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
