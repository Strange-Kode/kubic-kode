export class SessionLobbyManager {
  constructor(participantManager) {
    this._participantManager = participantManager;
    this._lobbyConfig = new Map(); // Session-level game configuration
    this._readyStates = new Map(); // participantId -> boolean
    this._syncPhase = false; // Whether in sync/ready check phase
  }

  // Lobby Configuration
  // -------------------

  /**
   * Set a lobby configuration value
   * @param {string} key - The configuration key
   * @param {any} value - The configuration value
   * @param {number} hostId - The host participant ID for validation
   */
  setLobbyConfig(key, value, hostId) {
    if (!this._participantManager.isHost(hostId)) {
      throw new Error("Only the host can configure lobby settings.");
    }
    
    this._lobbyConfig.set(key, value);
  }

  /**
   * Get a lobby configuration value
   * @param {string} key - The configuration key
   * @returns {any} The configuration value or undefined if not found
   */
  getLobbyConfig(key) {
    return this._lobbyConfig.get(key);
  }

  /**
   * Get all lobby configuration
   * @returns {Object} Object containing all lobby configuration
   */
  getAllLobbyConfig() {
    return Object.fromEntries(this._lobbyConfig);
  }

  /**
   * Delete a lobby configuration key
   * @param {string} key - The configuration key to delete
   * @param {number} hostId - The host participant ID for validation
   * @returns {boolean} True if the key was deleted, false if it didn't exist
   */
  deleteLobbyConfig(key, hostId) {
    if (!this._participantManager.isHost(hostId)) {
      throw new Error("Only the host can delete lobby settings.");
    }
    
    return this._lobbyConfig.delete(key);
  }

  // Ready States & Synchronization
  // ------------------------------

  /**
   * Initialize ready state for a participant
   * @param {number} participantId - The participant ID
   */
  initializeReadyState(participantId) {
    const participant = this._participantManager.getParticipantById(participantId);
    if (participant && this._participantManager.isParticipantPlayable(participant)) {
      this._readyStates.set(participantId, false);
    }
  }

  /**
   * Set a participant's ready state
   * @param {number} participantId - The participant ID
   * @param {boolean} ready - Whether the participant is ready
   */
  setParticipantReady(participantId, ready) {
    const participant = this._participantManager.getParticipantById(participantId);
    if (!participant) {
      throw new Error("Participant not found.");
    }
    
    if (!this._participantManager.isParticipantPlayable(participant)) {
      throw new Error("Only playable participants can have ready states.");
    }
    
    this._readyStates.set(participantId, ready === true);
  }

  /**
   * Get a participant's ready state
   * @param {number} participantId - The participant ID
   * @returns {boolean} The participant's ready state, false if not set
   */
  getParticipantReady(participantId) {
    return this._readyStates.get(participantId) || false;
  }

  /**
   * Get all ready states
   * @returns {Object} Object mapping participantId to ready state
   */
  getAllReadyStates() {
    const readyStates = {};
    for (const [participantId, ready] of this._readyStates) {
      readyStates[participantId] = ready;
    }
    return readyStates;
  }

  /**
   * Check if all participants are ready
   * @returns {boolean} True if all playable participants are ready, false otherwise
   */
  areAllParticipantsReady() {
    const playableParticipants = this._participantManager.getPlayableParticipants();
    if (playableParticipants.length < 2) return false;
    
    return playableParticipants.every(p => this._readyStates.get(p.id) === true);
  }

  /**
   * Remove ready state for a participant
   * @param {number} participantId - The participant ID
   */
  removeReadyState(participantId) {
    this._readyStates.delete(participantId);
  }

  /**
   * Start the synchronization phase
   */
  startSyncPhase() {
    this._syncPhase = true;
    
    // Reset all ready states to false
    for (const participant of this._participantManager.getPlayableParticipants()) {
      this._readyStates.set(participant.id, false);
    }
  }

  /**
   * End the synchronization phase
   */
  endSyncPhase() {
    this._syncPhase = false;
  }

  /**
   * Check if currently in synchronization phase
   * @returns {boolean} True if in sync phase, false otherwise
   */
  isInSyncPhase() {
    return this._syncPhase;
  }

  // Kick Functionality
  // ------------------

  /**
   * Kick a participant from the session
   * @param {number} participantIdToKick - The participant ID to kick
   * @param {number} hostId - The host participant ID for validation
   */
  kickParticipant(participantIdToKick, hostId) {
    if (!this._participantManager.isHost(hostId)) {
      throw new Error("Only the host can kick participants.");
    }
    
    if (participantIdToKick === hostId) {
      throw new Error("Host cannot kick themselves.");
    }
    
    this._participantManager.removeParticipant(participantIdToKick);
  }

  // Lobby Status
  // ------------

  /**
   * Get comprehensive lobby status information
   * @returns {Object} Object containing lobby status information
   */
  getLobbyStatus() {
    const playableParticipants = this._participantManager.getPlayableParticipants();
    const spectators = this._participantManager.getSpectatorParticipants();
    
    return {
      participantCount: {
        players: playableParticipants.length,
        spectators: spectators.length,
        total: this._participantManager.getParticipantCount()
      },
      host: this._participantManager.getHost(),
      lobbyConfig: this.getAllLobbyConfig(),
      readyStates: this.getAllReadyStates(),
      canStart: playableParticipants.length >= 2 && this.areAllParticipantsReady(),
      needsMorePlayers: playableParticipants.length < 2,
      participants: this._participantManager.listParticipants(),
      inSyncPhase: this._syncPhase
    };
  }
}
