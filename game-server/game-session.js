import { InactivityManager } from "../game-utility/inactivity-manager.js";
import { gameHistoryManager } from "./game-history-manager.js";
import { GameEventService } from "./game-event-service.js";
import { kubicLog } from "../kubic-log.js";

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
    this._participants = []; // { id, name, type }
    this._started = false;
    this.__participant_alloc_idx = 0;
    this._winCounter = 0;
    this._restartCounter = 0; // Track number of game restarts for alternating first player
    this._gameInstance = null;
    
    // Host information
    this._hostId = null;
    this._hostInfo = null; // { id, name, joinedAt }
    
    // Lobby state
    this._lobbyConfig = new Map(); // Session-level game configuration
    this._readyStates = new Map(); // participantId -> boolean
    this._syncPhase = false; // Whether in sync/ready check phase
    this._chatMessages = []; // { id, participantId, participantName, message, timestamp, type }

    this._restartVote = null; // { votes: {}, totalParticipants: N }
    this._inactivityManager = null;
    this.__participantTokens = new Map(); // participantId -> encrypted game token

    // Connection management
    this._connectionStatus = new Map(); // participantId -> { connected: boolean, lastSeen: Date, reconnectionAttempts: number }
    this._heartbeatStarted = false;

    // Get game history from the manager (returns a proxy)
    this._gameHistory = gameHistoryManager.getGameHistory(sessionId);
  }

  /**
   * Get the game instance associated with this session
   * @returns {Object|null} The game instance or null if not set
   */
  getGameInstance() {
    return this._gameInstance;
  }

  /**
   * Set the game instance for this session
   * @param {Object} gameInstance - The game instance to set
   */
  setGameInstance(gameInstance) {
    this._gameInstance = gameInstance;
  }

  get winCounter() {
    throw new Error("Attempting to access winCounter property on GameSession. Not allowed, winCounter is a protected property. Use getWinCounter() instead.");
  }

  /**
   * Get the current win counter value
   * @returns {number} The number of wins in this session
   */
  getWinCounter() {
    return this._winCounter;
  }

  /**
   * Increment the win counter
   */
  increaseWinCounter() {
    this._winCounter++;
  }

  /**
   * Reset the win counter to zero
   */
  resetWinCounter() {
    this._winCounter = 0;
  }

  get restartCounter() {
    throw new Error("Attempting to access restartCounter property on GameSession. Not allowed, restartCounter is a protected property. Use getRestartCounter() instead.");
  }

  /**
   * Get the current restart counter value
   * @returns {number} The number of game restarts in this session
   */
  getRestartCounter() {
    return this._restartCounter;
  }

  /**
   * Increment the restart counter
   */
  increaseRestartCounter() {
    this._restartCounter++;
  }

  /**
   * Reset the restart counter to zero
   */
  resetRestartCounter() {
    this._restartCounter = 0;
  }

  /**
   * Allocate a new participant ID
   * @returns {number} The next available participant ID
   */
  allocateParticipantId() {
    this.__participant_alloc_idx++;
    return this.__participant_alloc_idx;
  }

  /**
   * Add a participant to the session
   * @param {string} name - The participant's name (must be unique)
   * @param {string} participant_type - The type of participant ("user", "computer", or "spectator")
   * @returns {number} The allocated participant ID
   * @throws {Error} If name is already in use, session is full, or invalid participant type
   */
  addParticipant(name, participant_type = "user") {
    // Validate unique names within session
    const existingName = this._participants.find(p => p.name === name);
    if (existingName) {
      throw new Error(`Participant name "${name}" is already in use. Names must be unique within the session.`);
    }

    // Only count playable participants (user, computer) against maxParticipants limit
    // Spectators can join even when the game is "full"
    const playableParticipants = this._participants.filter(p => this.isParticipantPlayable(p));
    if (participant_type !== "spectator" && playableParticipants.length >= this._maxParticipants) {
      throw new Error("Game session is full.");
    }

    if (this._started && participant_type !== "spectator") {
      throw new Error("Cannot join. Game session has already started.");
    }

    // Validate participant type
    if (!["user", "computer", "spectator"].includes(participant_type)) {
      throw new Error(`Invalid participant type specified: ${participant_type}. Expected: "user", "computer", or "spectator"`);
    }

    const participantId = this.allocateParticipantId();

    const existing = this._participants.find((p) => p.id === participantId);
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

    this._participants.push(participant);

    // Initialize connection status
    this._connectionStatus.set(participantId, {
      connected: false,
      lastSeen: new Date(),
      reconnectionAttempts: 0
    });

    // Set host if this is the first participant
    if (this._hostId === null && participant_type !== "spectator") {
      this.setHost(participantId, name);
    }

    // Initialize ready state for playable participants
    if (this.isParticipantPlayable(participant)) {
      this._readyStates.set(participantId, false);
    }

    // Generate a game token for this participant
    this.generateParticipantToken(participantId).then(token => {
      this.__participantTokens.set(participantId, token);
      kubicLog.info(`[GameSession]::generateParticipantToken -  Generated game token for participant ${participantId} (${name}) in session ${this._sessionId}`);
    }).catch(error => {
      kubicLog.error(`[GameSession]::generateParticipantToken - Failed to generate game token for participant ${participantId}:`, error);
    });

    // Add to game history
    this._gameHistory.addParticipantJoinedEvent(participantId, name, participant_type);

    return participantId;
  }

  /**
   * Remove a participant from the session.
   * Removing a participant may affect the session, such as if the host leaves.
   * (a new host will be automatically selected if the host leaves)
   * @param {number} id - The participant ID to remove
   * @throws {Error} If participant is not found
   */
  removeParticipant(id) {
    const index = this._participants.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error("Participant not found.");
    }

    const participant = this._participants[index];
    this._participants.splice(index, 1);

    // Remove from ready states and tokens
    this._readyStates.delete(id);
    this.__participantTokens.delete(id);

    // Remove connection status
    this._connectionStatus.delete(id);

    // Handle host transfer if host is leaving
    if (this._hostId === id) {
      this._hostId = null;
      this._hostInfo = null;
      
      // Find next eligible host (first playable participant)
      const nextHost = this._participants.find(p => this.isParticipantPlayable(p));
      if (nextHost) {
        this.setHost(nextHost.id, nextHost.name);
      }
    }

    // Add to game history
    this._gameHistory.addParticipantLeftEvent(id, participant.name);
  }

  /**
   * Get a list of all participants in the session
   * @returns {Array<Object>} Array of participant objects with id, name, type, and isPlayable flag
   */
  listParticipants() {
    return this._participants.map((p) => ({ 
      id: p.id, 
      name: p.name, 
      type: p.type || "user",
      isPlayable: this.isParticipantPlayable(p)
    }));
  }

  get participants() {
    throw new Error("Attempting to access participants property on GameSession. Not allowed, participants is a protected property. Use getParticipants() instead.");
  }

  /**
   * Get all participants in the session
   * @returns {Array<Object>} Array of all participant objects
   */
  getParticipants() {
    return this._participants;
  }

  get maxParticipants() {
    throw new Error("Attempting to access maxParticipants property on GameSession. Not allowed, maxParticipants is a protected property. Use getMaxParticipants() instead.");
  }

  /**
   * Get the maximum number of participants allowed in this session
   * @returns {number} The maximum participant count
   */
  getMaxParticipants() {
    return this._maxParticipants;
  }

  get started() {
    throw new Error("Attempting to access started property on GameSession. Not allowed, started is a protected property. Use isStarted() instead.");
  }

  /**
   * Check if the session has been started
   * @returns {boolean} True if the session is started, false otherwise
   */
  isStarted() {
    return this._started;
  }

  /**
   * Mark the session as started and initialize game state
   * @throws {Error} If not enough players are available to start
   */
  markStarted() {
    // Don't reset win counter here - it should persist across games in the same session
    // this.resetWinCounter(); // Removed - win counter should only reset on session restart
    
    // Count only playable participants for game start requirement
    const playableParticipants = this._participants.filter(p => this.isParticipantPlayable(p));
    if (playableParticipants.length < 2) {
      throw new Error("Cannot start game. Not enough players (need at least 2 playable participants).");
    }

    if (this._inactivityManager) {
      this._inactivityManager.clearTimer();
      this._inactivityManager = null;
    }

    this._started = true;
    if (this._gameInstance.handleInactivity) {
      const inactivityManager = new InactivityManager(this, this._gameInstance);
      this._inactivityManager = inactivityManager;
      inactivityManager.startTimer();
    } else {
      this._inactivityManager = null;
    }

    // Start heartbeat for the session
    this.startHeartbeat();

    // Add to game history
    this._gameHistory.addSessionStartedEvent(this._participants);
  }

  /**
   * Mark the session as ended and clean up resources
   */
  markEnded() {
    this._started = false;
    if (this._inactivityManager) {
      this._inactivityManager.clearTimer();
    }

    // Stop heartbeat
    this.stopHeartbeat();

    // Add to game history
    this._gameHistory.addSessionEndedEvent(this._participants.length);
  }

  /**
   * Find a participant by their ID
   * @param {number|string} id - The participant ID to find
   * @returns {Object|null} The participant object or null if not found
   */
  getParticipantById(id) {
    // Convert id to number if it's a string, since participant IDs are numbers
    const numericId = typeof id === "string" ? parseInt(id, 10) : id;
    return this._participants.find((p) => p.id === numericId) || null;
  }

  /**
   * Get all playable participants (users and computers)
   * @returns {Array<Object>} Array of playable participant objects
   */
  getPlayableParticipants() {
    return this._participants.filter(p => this.isParticipantPlayable(p));
  }

  /**
   * Get all spectator participants
   * @returns {Array<Object>} Array of spectator participant objects
   */
  getSpectatorParticipants() {
    return this._participants.filter(p => p.type === "spectator");
  }

  /**
   * Check if a participant is playable (user or computer)
   * @param {Object} participant - The participant object to check
   * @returns {boolean} True if the participant is playable, false otherwise
   */
  isParticipantPlayable(participant) {
    return ["user", "computer"].includes(participant.type);
  }

  get sessionId() {
    throw new Error("Attempting to access sessionId property on GameSession. Not allowed, sessionId is a protected property. Use getSessionId() instead.");
  }

  /**
   * Get the session ID
   * @returns {string} The session ID
   */
  getSessionId() {
    return this._sessionId;
  }

  get gameVariantId() {
    throw new Error("Attempting to access gameVariantId property on GameSession. Not allowed, gameVariantId is a protected property. Use getGameVariantId() instead.");
  }

  /**
   * Get the game variant ID
   * @returns {string|null} The game variant ID or null if not set
   */
  getGameVariantId() {
    return this._gameVariantId;
  }

  /**
   * Start a restart game vote for the session
   */
  startRestartVote() {
    // Only count playable participants (users and computers) for voting
    const playableParticipants = this.getPlayableParticipants();
    this._restartVote = {
      votes: {}, // participantId => true/false
      totalParticipants: playableParticipants.length,
    };

    // Add to game history with playable participants count
    this._gameHistory.addRestartVoteStartedEvent(playableParticipants.length);
  }

  /**
   * Register a participant's vote for restart
   * @param {number} participantId - The participant ID
   * @param {boolean} voteYes - Whether the participant voted yes for restart
   * @throws {Error} If no active restart vote exists
   */
  registerRestartVote(participantId, voteYes) {
    if (!this._restartVote) {
      throw new Error("No active restart vote.");
    }

    this._restartVote.votes[participantId] = voteYes;

    // Add to game history
    this._gameHistory.addRestartVoteRegisteredEvent(
      participantId,
      voteYes,
      Object.keys(this._restartVote.votes).length
    );
  }

  /**
   * Check if a restart vote is currently in progress
   * @returns {boolean} True if a restart vote is active, false otherwise
   */
  isRestartVoteInProgress() {
    return this._restartVote !== null;
  }

  /**
   * Check if the restart vote is complete (all playable participants (including "computer") have voted)
   * Note: computer always votes yes.
   * @returns {boolean} True if all playable participants have voted, false otherwise
   */
  isRestartVoteComplete() {
    if (!this._restartVote) return false;
    return (
      Object.keys(this._restartVote.votes).length ===
      this._restartVote.totalParticipants
    );
  }

  /**
   * Get the result of the restart vote
   * @returns {boolean} True if all playable participants (including "computer") voted yes, false otherwise
   * Note: computer always votes yes.
   * @throws {Error} If the vote is not complete
   */
  getRestartVoteResult() {
    if (!this.isRestartVoteComplete()) {
      throw new Error("Vote not complete.");
    }
    return Object.values(this._restartVote.votes).every((v) => v === true);
  }

  /**
   * Clear the current restart vote
   */
  clearRestartVote() {
    const voteResult = this._restartVote ? this.getRestartVoteResult() : null;
    this._restartVote = null;

    // Add to game history
    this._gameHistory.addRestartVoteClearedEvent(voteResult);
  }

  get restartVote() {
    throw new Error("Attempting to access restartVote property on GameSession. Not allowed, restartVote is a protected property. Use getRestartVote() instead.");
  }

  /**
   * Get the current restart vote state
   * @returns {Object|null} The restart vote object or null if no vote is active
   */
  getRestartVote() {
    return this._restartVote;
  }

  get inactivityManager() {
    throw new Error("Attempting to access inactivityManager property on GameSession. Not allowed, inactivityManager is a protected property. Use getInactivityManager() instead.");
  }

  /**
   * Get the inactivity manager for this session
   * @returns {InactivityManager|null} The inactivity manager or null if not set
   */
  getInactivityManager() {
    return this._inactivityManager;
  }

  get gameHistory() {
    throw new Error("Attempting to access gameHistory property on GameSession. Not allowed, gameHistory is a protected property. Use getGameHistory() instead.");
  }

  /**
   * Get the game history for this session
   * @returns {Object} The game history proxy object
   */
  getGameHistory() {
    return this._gameHistory;
  }

  // Subscription management methods
  // ------------------------------

  /**
   * Subscribe to game history event types
   * @param {Array<string>} eventTypes - Array of game history event types to subscribe to
   */
  subscribeToGameHistoryEvents(eventTypes) {
    gameHistoryManager.subscribe(this._sessionId, eventTypes);
  }

  /**
   * Unsubscribe from game history event types
   * @param {Array<string>} eventTypes - Array of game history event types to unsubscribe from
   */
  unsubscribeFromGameHistoryEvents(eventTypes) {
    gameHistoryManager.unsubscribe(this._sessionId, eventTypes);
  }

  /**
   * Get current game history event subscriptions
   * @returns {Array<string>} Array of subscribed event types
   */
  getGameHistorySubscriptions() {
    return gameHistoryManager.getSubscriptions(this._sessionId);
  }

  /**
   * Check if subscribed to a specific game history event type
   * @param {string} eventType - The event type to check
   * @returns {boolean} True if subscribed, false otherwise
   */
  isSubscribedToGameHistoryEvent(eventType) {
    return gameHistoryManager.isSubscribed(this._sessionId, eventType);
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

  addChatMessage(participantId, message, messageType = "user") {
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
      type: messageType // "user", "system", "host"
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
      participantName: "System",
      message: message.trim(),
      timestamp: new Date().toISOString(),
      type: "system"
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
      sessionId: this._sessionId,
      gameVariantId: this._gameVariantId,
      started: this._started,
      inSyncPhase: this._syncPhase,
      participantCount: {
        players: playableParticipants.length,
        spectators: spectators.length,
        total: this._participants.length,
        maxPlayers: this._maxParticipants
      },
      host: this._hostInfo,
      lobbyConfig: this.getAllLobbyConfig(),
      readyStates: this.getAllReadyStates(),
      canStart: playableParticipants.length >= 2 && this.areAllParticipantsReady(),
      needsMorePlayers: playableParticipants.length < this._maxParticipants,
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
            type: "participantReconnected",
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
    return this._participants.filter(p => this.isParticipantConnected(p.id));
  }

  getDisconnectedParticipants() {
    return this._participants.filter(p => p.disconnected);
  }

  startHeartbeat() {
    if (this._heartbeatStarted) {
      return;
    }
    
    GameEventService.startHeartbeatForSession(this._sessionId);
    this._heartbeatStarted = true;
  }

  stopHeartbeat() {
    if (!this._heartbeatStarted) {
      return;
    }
    
    GameEventService.stopHeartbeatForSession(this._sessionId);
    this._heartbeatStarted = false;
  }

  checkSessionViability() {
    const playableParticipants = this.getPlayableParticipants();
    const connectedParticipants = playableParticipants.filter(p => !p.disconnected);
    
    // Get required players from the game instance
    const requiredPlayers = this._gameInstance.requiredPlayers();
    
    if (connectedParticipants.length < requiredPlayers) {
      // End the session if insufficient connected players
      this.markEnded();
      
      // Broadcast session ended event
      GameEventService.broadcastToSession(this, {
        type: "sessionEnded",
        payload: {
          reason: "insufficient_players",
          message: "Session ended due to insufficient connected players",
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
    if (this._started) {
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
    if (this._started) {
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
    const requiredPlayers = this._gameInstance.requiredPlayers();
    
    return {
      sessionId: this._sessionId,
      started: this._started,
      totalParticipants: this._participants.length,
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
    return this.__participantTokens.get(participantId) || null;
  }

  /**
   * Set the game token for a specific participant
   * @param {number} participantId - The participant ID
   * @param {string} token - The encrypted game token
   */
  setParticipantToken(participantId, token) {
    this.__participantTokens.set(participantId, token);
  }

  /**
   * Get all participant tokens for this session
   * @returns {Map<number, string>} - Map of participantId to encrypted game token
   */
  getAllParticipantTokens() {
    return new Map(this.__participantTokens);
  }

  get participantTokens() {
    throw new Error("Attempting to access participantTokens property on GameSession. Not allowed, participantTokens is a private property. Use getAllParticipantTokens() instead.");
  }

  /**
   * Generate a new game token for a specific participant
   * @param {number} participantId - The participant ID
   * @returns {Promise<string>} - Promise that resolves to the encrypted game token
   */
  async generateParticipantToken(participantId) {
    // Import the service dynamically to avoid circular dependencies
    return import("./game-token-service.js").then(({ gameTokenService }) => {
      return gameTokenService.instance.generateToken(this._sessionId, participantId);
    });
  }

  /**
   * Regenerate a game token for a specific participant
   * @param {number} participantId - The participant ID
   * @returns {Promise<string>} - Promise that resolves to the new encrypted game token
   */
  async regenerateParticipantToken(participantId) {
    return this.generateParticipantToken(participantId).then(token => {
      this.__participantTokens.set(participantId, token);
      kubicLog.info(`[GameSession]::regenerateParticipantToken - Regenerated game token for participant ${participantId} in session ${this._sessionId}`);
      return token;
    });
  }
}
