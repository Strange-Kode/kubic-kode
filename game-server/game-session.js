import { InactivityManager } from "../game-utility/inactivity-manager.js";
import { gameHistoryManager } from "./game-history-manager.js";
import { GameEventService } from "./game-event-service.js";
import { kubicLog } from "../kubic-log.js";

export class GameSession {
  constructor(sessionId, maxParticipants = 2, gameVariantId = null) {
    this.sessionId = sessionId;
    this.maxParticipants = maxParticipants;
    this.gameVariantId = gameVariantId;
    this.participants = []; // { id, name, type }
    this.started = false;
    this.participant_alloc_idx = 0;
    this.winCounter = 0;
    this.restartCounter = 0; // Track number of game restarts for alternating first player
    this.gameInstance = null;
    
    // Host information
    this._hostId = null;
    this._hostInfo = null; // { id, name, joinedAt }
    
    // Lobby state
    this._lobbyConfig = new Map(); // Session-level game configuration
    this._readyStates = new Map(); // participantId -> boolean
    this._syncPhase = false; // Whether in sync/ready check phase
    this._chatMessages = []; // { id, participantId, participantName, message, timestamp, type }

    this.restartVote = null; // { votes: {}, totalParticipants: N }
    this.inactivityManager = null;
    this.participantTokens = new Map(); // participantId -> encrypted game token

    // Connection management
    this._connectionStatus = new Map(); // participantId -> { connected: boolean, lastSeen: Date, reconnectionAttempts: number }
    this._heartbeatStarted = false;

    // Get game history from the manager (returns a proxy)
    this.gameHistory = gameHistoryManager.getGameHistory(sessionId);
  }

  setGameInstance(gameInstance) {
    this.gameInstance = gameInstance;
  }

  getWinCounter() {
    return this.winCounter;
  }

  increaseWinCounter() {
    this.winCounter++;
  }

  resetWinCounter() {
    this.winCounter = 0;
  }

  getRestartCounter() {
    return this.restartCounter;
  }

  increaseRestartCounter() {
    this.restartCounter++;
  }

  resetRestartCounter() {
    this.restartCounter = 0;
  }

  allocateParticipantId() {
    this.participant_alloc_idx++;
    return this.participant_alloc_idx;
  }

  addParticipant(name, participant_type = 'user') {
    // Validate unique names within session
    const existingName = this.participants.find(p => p.name === name);
    if (existingName) {
      throw new Error(`Participant name '${name}' is already in use. Names must be unique within the session.`);
    }

    // Only count playable participants (user, computer) against maxParticipants limit
    // Spectators can join even when the game is "full"
    const playableParticipants = this.participants.filter(p => this.isParticipantPlayable(p));
    if (participant_type !== 'spectator' && playableParticipants.length >= this.maxParticipants) {
      throw new Error("Game session is full.");
    }

    if (this.started && participant_type !== 'spectator') {
      throw new Error("Cannot join. Game session has already started.");
    }

    // Validate participant type
    if (!['user', 'computer', 'spectator'].includes(participant_type)) {
      throw new Error(`Invalid participant type specified: ${participant_type}. Expected: 'user', 'computer', or 'spectator'`);
    }

    const participantId = this.allocateParticipantId();

    const existing = this.participants.find((p) => p.id === participantId);
    if (existing) {
      throw new Error("Participant with this ID already exists.");
    }

    const participant = {
      id: participantId,
      name: name,
      type: participant_type,
      joinedAt: new Date().toISOString(),
      disconnected: false,
      disconnectedAt: null
    };

    this.participants.push(participant);

    // Initialize connection status
    this._connectionStatus.set(participantId, {
      connected: false,
      lastSeen: new Date(),
      reconnectionAttempts: 0
    });

    // Set host if this is the first participant
    if (this._hostId === null && participant_type !== 'spectator') {
      this.setHost(participantId, name);
    }

    // Initialize ready state for playable participants
    if (this.isParticipantPlayable(participant)) {
      this._readyStates.set(participantId, false);
    }

    // Generate a game token for this participant
    this.generateParticipantToken(participantId).then(token => {
      this.participantTokens.set(participantId, token);
      kubicLog.info(`[GameSession]::generateParticipantToken -  Generated game token for participant ${participantId} (${name}) in session ${this.sessionId}`);
    }).catch(error => {
      kubicLog.error(`[GameSession]::generateParticipantToken - Failed to generate game token for participant ${participantId}:`, error);
    });

    // Add to game history
    this.gameHistory.addParticipantJoinedEvent(participantId, name, participant_type);

    return participantId;
  }

  removeParticipant(id) {
    const index = this.participants.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error("Participant not found.");
    }

    const participant = this.participants[index];
    this.participants.splice(index, 1);

    // Remove from ready states and tokens
    this._readyStates.delete(id);
    this.participantTokens.delete(id);

    // Remove connection status
    this._connectionStatus.delete(id);

    // Handle host transfer if host is leaving
    if (this._hostId === id) {
      this._hostId = null;
      this._hostInfo = null;
      
      // Find next eligible host (first playable participant)
      const nextHost = this.participants.find(p => this.isParticipantPlayable(p));
      if (nextHost) {
        this.setHost(nextHost.id, nextHost.name);
      }
    }

    // Add to game history
    this.gameHistory.addParticipantLeftEvent(id, participant.name);
  }

  listParticipants() {
    return this.participants.map((p) => ({ 
      id: p.id, 
      name: p.name, 
      type: p.type || 'user',
      isPlayable: this.isParticipantPlayable(p)
    }));
  }

  getParticipants() {
    return this.participants;
  }

  markStarted() {
    // Don't reset win counter here - it should persist across games in the same session
    // this.resetWinCounter(); // Removed - win counter should only reset on session restart
    
    // Count only playable participants for game start requirement
    const playableParticipants = this.participants.filter(p => this.isParticipantPlayable(p));
    if (playableParticipants.length < 2) {
      throw new Error("Cannot start game. Not enough players (need at least 2 playable participants).");
    }

    if (this.inactivityManager) {
      this.inactivityManager.clearTimer();
      this.inactivityManager = null;
    }

    this.started = true;
    if (this.gameInstance.handleInactivity) {
      const inactivityManager = new InactivityManager(this, this.gameInstance);
      this.inactivityManager = inactivityManager;
      inactivityManager.startTimer();
    } else {
      this.inactivityManager = null;
    }

    // Start heartbeat for the session
    this.startHeartbeat();

    // Add to game history
    this.gameHistory.addSessionStartedEvent(this.participants);
  }

  markEnded() {
    this.started = false;
    if (this.inactivityManager) {
      this.inactivityManager.clearTimer();
    }

    // Stop heartbeat
    this.stopHeartbeat();

    // Add to game history
    this.gameHistory.addSessionEndedEvent(this.participants.length);
  }

  getGameInstance() {
    return this.gameInstance;
  }

  getParticipantById(id) {
    // Convert id to number if it's a string, since participant IDs are numbers
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    return this.participants.find((p) => p.id === numericId) || null;
  }

  getPlayableParticipants() {
    return this.participants.filter(p => this.isParticipantPlayable(p));
  }

  getSpectatorParticipants() {
    return this.participants.filter(p => p.type === 'spectator');
  }

  isParticipantPlayable(participant) {
    return ['user', 'computer'].includes(participant.type);
  }

  getSessionId() {
    return this.sessionId;
  }

  startRestartVote() {
    // Only count playable participants (users and computers) for voting
    const playableParticipants = this.getPlayableParticipants();
    this.restartVote = {
      votes: {}, // participantId => true/false
      totalParticipants: playableParticipants.length,
    };

    // Add to game history with playable participants count
    this.gameHistory.addRestartVoteStartedEvent(playableParticipants.length);
  }

  registerRestartVote(participantId, voteYes) {
    if (!this.restartVote) {
      throw new Error("No active restart vote.");
    }

    this.restartVote.votes[participantId] = voteYes;

    // Add to game history
    this.gameHistory.addRestartVoteRegisteredEvent(
      participantId,
      voteYes,
      Object.keys(this.restartVote.votes).length
    );
  }

  isRestartVoteInProgress() {
    return this.restartVote !== null;
  }

  isRestartVoteComplete() {
    if (!this.restartVote) return false;
    return (
      Object.keys(this.restartVote.votes).length ===
      this.restartVote.totalParticipants
    );
  }

  getRestartVoteResult() {
    if (!this.isRestartVoteComplete()) {
      throw new Error("Vote not complete.");
    }
    return Object.values(this.restartVote.votes).every((v) => v === true);
  }

  clearRestartVote() {
    const voteResult = this.restartVote ? this.getRestartVoteResult() : null;
    this.restartVote = null;

    // Add to game history
    this.gameHistory.addRestartVoteClearedEvent(voteResult);
  }

  getInactivityManager() {
    return this.inactivityManager;
  }

  getGameHistory() {
    return this.gameHistory;
  }

  // Subscription management methods
  // ------------------------------

  /**
   * Subscribe to game history event types
   * @param {Array<string>} eventTypes - Array of game history event types to subscribe to
   */
  subscribeToGameHistoryEvents(eventTypes) {
    gameHistoryManager.subscribe(this.sessionId, eventTypes);
  }

  /**
   * Unsubscribe from game history event types
   * @param {Array<string>} eventTypes - Array of game history event types to unsubscribe from
   */
  unsubscribeFromGameHistoryEvents(eventTypes) {
    gameHistoryManager.unsubscribe(this.sessionId, eventTypes);
  }

  /**
   * Get current game history event subscriptions
   * @returns {Array<string>} Array of subscribed event types
   */
  getGameHistorySubscriptions() {
    return gameHistoryManager.getSubscriptions(this.sessionId);
  }

  /**
   * Check if subscribed to a specific game history event type
   * @param {string} eventType - The event type to check
   * @returns {boolean} True if subscribed, false otherwise
   */
  isSubscribedToGameHistoryEvent(eventType) {
    return gameHistoryManager.isSubscribed(this.sessionId, eventType);
  }

  // Host Management
  // ---------------

  setHost(participantId, participantName) {
    const participant = this.getParticipantById(participantId);
    if (!participant) {
      throw new Error("Cannot set host: participant not found.");
    }
    
    if (!this.isParticipantPlayable(participant)) {
      throw new Error("Cannot set host: only playable participants can be host.");
    }

    this._hostId = participantId;
    this._hostInfo = {
      id: participantId,
      name: participantName,
      joinedAt: participant.joinedAt || new Date().toISOString()
    };
  }

  getHost() {
    return this._hostInfo;
  }

  getHostId() {
    return this._hostId;
  }

  isHost(participantId) {
    return this._hostId === participantId;
  }

  transferHost(newHostId) {
    const newHost = this.getParticipantById(newHostId);
    if (!newHost) {
      throw new Error("Cannot transfer host: new host participant not found.");
    }
    
    if (!this.isParticipantPlayable(newHost)) {
      throw new Error("Cannot transfer host: only playable participants can be host.");
    }

    this.setHost(newHostId, newHost.name);
  }

  // Lobby Configuration
  // -------------------

  setLobbyConfig(key, value, hostId) {
    if (!this.isHost(hostId)) {
      throw new Error("Only the host can configure lobby settings.");
    }
    
    this._lobbyConfig.set(key, value);
  }

  getLobbyConfig(key) {
    return this._lobbyConfig.get(key);
  }

  getAllLobbyConfig() {
    return Object.fromEntries(this._lobbyConfig);
  }

  deleteLobbyConfig(key, hostId) {
    if (!this.isHost(hostId)) {
      throw new Error("Only the host can delete lobby settings.");
    }
    
    return this._lobbyConfig.delete(key);
  }

  // Ready States & Synchronization
  // ------------------------------

  setParticipantReady(participantId, ready) {
    const participant = this.getParticipantById(participantId);
    if (!participant) {
      throw new Error("Participant not found.");
    }
    
    if (!this.isParticipantPlayable(participant)) {
      throw new Error("Only playable participants can have ready states.");
    }
    
    this._readyStates.set(participantId, ready === true);
  }

  getParticipantReady(participantId) {
    return this._readyStates.get(participantId) || false;
  }

  getAllReadyStates() {
    const readyStates = {};
    for (const [participantId, ready] of this._readyStates) {
      readyStates[participantId] = ready;
    }
    return readyStates;
  }

  areAllParticipantsReady() {
    const playableParticipants = this.getPlayableParticipants();
    if (playableParticipants.length < 2) return false;
    
    return playableParticipants.every(p => this._readyStates.get(p.id) === true);
  }

  startSyncPhase() {
    this._syncPhase = true;
    
    // Reset all ready states to false
    for (const participant of this.getPlayableParticipants()) {
      this._readyStates.set(participant.id, false);
    }
  }

  endSyncPhase() {
    this._syncPhase = false;
  }

  isInSyncPhase() {
    return this._syncPhase;
  }

  kickParticipant(participantIdToKick, hostId) {
    if (!this.isHost(hostId)) {
      throw new Error("Only the host can kick participants.");
    }
    
    if (participantIdToKick === hostId) {
      throw new Error("Host cannot kick themselves.");
    }
    
    this.removeParticipant(participantIdToKick);
  }

  // Chat Functionality
  // ------------------

  addChatMessage(participantId, message, messageType = 'user') {
    const participant = this.getParticipantById(participantId);
    if (!participant) {
      throw new Error("Participant not found.");
    }

    const chatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      participantId: participantId,
      participantName: participant.name,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      type: messageType // 'user', 'system', 'host'
    };

    this._chatMessages.push(chatMessage);
    
    // Keep only last 100 messages to prevent memory bloat
    if (this._chatMessages.length > 100) {
      this._chatMessages = this._chatMessages.slice(-100);
    }

    return chatMessage;
  }

  getChatMessages(limit = 50) {
    return this._chatMessages.slice(-limit);
  }

  addSystemMessage(message) {
    const systemMessage = {
      id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      participantId: null,
      participantName: 'System',
      message: message.trim(),
      timestamp: new Date().toISOString(),
      type: 'system'
    };

    this._chatMessages.push(systemMessage);
    
    // Keep only last 100 messages to prevent memory bloat
    if (this._chatMessages.length > 100) {
      this._chatMessages = this._chatMessages.slice(-100);
    }

    return systemMessage;
  }

  // Lobby Status Information
  // ------------------------

  getLobbyStatus() {
    const playableParticipants = this.getPlayableParticipants();
    const spectators = this.getSpectatorParticipants();
    
    return {
      sessionId: this.sessionId,
      gameVariantId: this.gameVariantId,
      started: this.started,
      inSyncPhase: this._syncPhase,
      participantCount: {
        players: playableParticipants.length,
        spectators: spectators.length,
        total: this.participants.length,
        maxPlayers: this.maxParticipants
      },
      host: this._hostInfo,
      lobbyConfig: this.getAllLobbyConfig(),
      readyStates: this.getAllReadyStates(),
      canStart: playableParticipants.length >= 2 && this.areAllParticipantsReady(),
      needsMorePlayers: playableParticipants.length < this.maxParticipants,
      participants: this.listParticipants(),
      recentChat: this.getChatMessages(10)
    };
  }

  // Connection management methods
  // -----------------------------
  updateParticipantConnection(participantId, connected) {
    const status = this._connectionStatus.get(participantId);
    if (status) {
      status.connected = connected;
      status.lastSeen = new Date();
      
      if (connected) {
        // Reset reconnection attempts on successful connection
        status.reconnectionAttempts = 0;
        
        // Mark participant as reconnected if they were previously disconnected
        const participant = this.getParticipantById(participantId);
        if (participant && participant.disconnected) {
          participant.disconnected = false;
          participant.disconnectedAt = null;
          
          // Broadcast reconnection event
          GameEventService.broadcastToSession(this, {
            type: 'participantReconnected',
            payload: {
              participantId: participantId,
              participantName: participant.name,
              reconnectedAt: new Date().toISOString()
            }
          });
        }
      }
    }
  }

  isParticipantConnected(participantId) {
    const status = this._connectionStatus.get(participantId);
    return status ? status.connected : false;
  }

  getConnectedParticipants() {
    return this.participants.filter(p => this.isParticipantConnected(p.id));
  }

  getDisconnectedParticipants() {
    return this.participants.filter(p => p.disconnected);
  }

  startHeartbeat() {
    if (this._heartbeatStarted) {
      return;
    }
    
    GameEventService.startHeartbeatForSession(this.sessionId);
    this._heartbeatStarted = true;
  }

  stopHeartbeat() {
    if (!this._heartbeatStarted) {
      return;
    }
    
    GameEventService.stopHeartbeatForSession(this.sessionId);
    this._heartbeatStarted = false;
  }

  checkSessionViability() {
    const playableParticipants = this.getPlayableParticipants();
    const connectedParticipants = playableParticipants.filter(p => !p.disconnected);
    
    // Get required players from the game instance
    const requiredPlayers = this.gameInstance.requiredPlayers();
    
    if (connectedParticipants.length < requiredPlayers) {
      // End the session if insufficient connected players
      this.markEnded();
      
      // Broadcast session ended event
      GameEventService.broadcastToSession(this, {
        type: 'sessionEnded',
        payload: {
          reason: 'insufficient_players',
          message: 'Session ended due to insufficient connected players',
          connectedParticipants: connectedParticipants.length,
          requiredParticipants: requiredPlayers
        }
      });
      
      return false;
    }
    
    return true;
  }

  // Enhanced participant management for reconnection
  handleParticipantReconnection(participantId) {
    const participant = this.getParticipantById(participantId);
    if (!participant) {
      return false;
    }
    
    // Update connection status
    this.updateParticipantConnection(participantId, true);
    
    // Check if this reconnection makes the session viable again
    if (this.started) {
      this.checkSessionViability();
    }
    
    return true;
  }

  handleParticipantDisconnection(participantId) {
    const participant = this.getParticipantById(participantId);
    if (!participant) {
      return false;
    }
    
    // Mark participant as disconnected
    participant.disconnected = true;
    participant.disconnectedAt = new Date().toISOString();
    
    // Update connection status
    this.updateParticipantConnection(participantId, false);
    
    // Check session viability
    if (this.started) {
      this.checkSessionViability();
    }
    
    return true;
  }

  // Get session status including connection information
  getSessionStatus() {
    const playableParticipants = this.getPlayableParticipants();
    const connectedParticipants = playableParticipants.filter(p => !p.disconnected);
    const disconnectedParticipants = this.getDisconnectedParticipants();
    
    // Get required players from the game instance
    const requiredPlayers = this.gameInstance.requiredPlayers();
    
    return {
      sessionId: this.sessionId,
      started: this.started,
      totalParticipants: this.participants.length,
      connectedParticipants: connectedParticipants.length,
      disconnectedParticipants: disconnectedParticipants.length,
      playableParticipants: playableParticipants.length,
      requiredParticipants: requiredPlayers,
      viable: connectedParticipants.length >= requiredPlayers
    };
  }

  // Game Token Management
  // ---------------------

  /**
   * Get the game token for a specific participant
   * @param {number} participantId - The participant ID
   * @returns {string|null} - The encrypted game token for the participant, or null if not found
   */
  getParticipantToken(participantId) {
    return this.participantTokens.get(participantId) || null;
  }

  /**
   * Set the game token for a specific participant
   * @param {number} participantId - The participant ID
   * @param {string} token - The encrypted game token
   */
  setParticipantToken(participantId, token) {
    this.participantTokens.set(participantId, token);
  }

  /**
   * Get all participant tokens for this session
   * @returns {Map<number, string>} - Map of participantId to encrypted game token
   */
  getAllParticipantTokens() {
    return new Map(this.participantTokens);
  }

  /**
   * Generate a new game token for a specific participant
   * @param {number} participantId - The participant ID
   * @returns {Promise<string>} - Promise that resolves to the encrypted game token
   */
  async generateParticipantToken(participantId) {
    // Import the service dynamically to avoid circular dependencies
    return import('./game-token-service.js').then(({ gameTokenService }) => {
      return gameTokenService.instance.generateToken(this.sessionId, participantId);
    });
  }

  /**
   * Regenerate a game token for a specific participant
   * @param {number} participantId - The participant ID
   * @returns {Promise<string>} - Promise that resolves to the new encrypted game token
   */
  async regenerateParticipantToken(participantId) {
    return this.generateParticipantToken(participantId).then(token => {
      this.participantTokens.set(participantId, token);
      kubicLog.info(`[GameSession]::regenerateParticipantToken - Regenerated game token for participant ${participantId} in session ${this.sessionId}`);
      return token;
    });
  }
}
