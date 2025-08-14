export class SessionParticipantManager {
  constructor(sessionId) {
    this._sessionId = sessionId;
    this._participants = []; // { id, name, type }
    this._participant_alloc_idx = 0;
    this._hostId = null;
    this._hostInfo = null; // { id, name, joinedAt }
    this._connectionStatus = new Map(); // participantId -> { connected: boolean, lastSeen: Date, reconnectionAttempts: number }
    this._participantTokens = new Map(); // participantId -> encrypted game token
  }

  // Participant Management
  // ---------------------

  /**
   * Allocate a new participant ID
   * @returns {number} The next available participant ID
   */
  allocateParticipantId() {
    this._participant_alloc_idx++;
    return this._participant_alloc_idx;
  }

  /**
   * Add a participant to the session
   * @param {string} name - The participant's name (must be unique)
   * @param {string} participant_type - The type of participant ("user", "computer", or "spectator")
   * @param {number} maxParticipants - Maximum number of participants allowed
   * @param {boolean} started - Whether the session has started
   * @returns {number} The allocated participant ID
   * @throws {Error} If name is already in use, session is full, or invalid participant type
   */
  addParticipant(name, participant_type = "user", maxParticipants = 2, started = false) {
    // Validate unique names within session
    const existingName = this._participants.find(p => p.name === name);
    if (existingName) {
      throw new Error(`Participant name "${name}" is already in use. Names must be unique within the session.`);
    }

    // Only count playable participants (user, computer) against maxParticipants limit
    // Spectators can join even when the game is "full"
    const playableParticipants = this._participants.filter(p => this.isParticipantPlayable(p));
    if (participant_type !== "spectator" && playableParticipants.length >= maxParticipants) {
      throw new Error("Game session is full.");
    }

    if (started && participant_type !== "spectator") {
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

    // Generate a game token for this participant
    this.generateParticipantToken(participantId).then(token => {
      this._participantTokens.set(participantId, token);
      console.log(`Generated game token for participant ${participantId} (${name}) in session ${this._sessionId}`);
    }).catch(error => {
      console.error(`Failed to generate game token for participant ${participantId}:`, error);
    });

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

    // Remove from tokens
    this._participantTokens.delete(id);

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

    return participant;
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

  /**
   * Get all participants in the session
   * @returns {Array<Object>} Array of all participant objects
   */
  getParticipants() {
    return this._participants;
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

  /**
   * Check if a participant name is already in use
   * @param {string} name - The name to check
   * @returns {boolean} True if the name is in use, false otherwise
   */
  isNameInUse(name) {
    return this._participants.some(p => p.name === name);
  }

  // Host Management
  // ---------------

  /**
   * Set the host for this session
   * @param {number} participantId - The participant ID to set as host
   * @param {string} participantName - The participant's name
   */
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

  /**
   * Get the current host information
   * @returns {Object|null} The host info object or null if no host
   */
  getHost() {
    return this._hostInfo;
  }

  /**
   * Get the current host ID
   * @returns {number|null} The host ID or null if no host
   */
  getHostId() {
    return this._hostId;
  }

  /**
   * Check if a participant is the host
   * @param {number} participantId - The participant ID to check
   * @returns {boolean} True if the participant is the host, false otherwise
   */
  isHost(participantId) {
    return this._hostId === participantId;
  }

  /**
   * Transfer host privileges to a new participant
   * @param {number} newHostId - The new host participant ID
   */
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

  // Connection Management
  // ---------------------

  /**
   * Update a participant's connection status
   * @param {number} participantId - The participant ID
   * @param {boolean} connected - Whether the participant is connected
   */
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
        }
      }
    }
  }

  /**
   * Check if a participant is connected
   * @param {number} participantId - The participant ID
   * @returns {boolean} True if the participant is connected, false otherwise
   */
  isParticipantConnected(participantId) {
    const status = this._connectionStatus.get(participantId);
    return status ? status.connected : false;
  }

  /**
   * Get all connected participants
   * @returns {Array<Object>} Array of connected participant objects
   */
  getConnectedParticipants() {
    return this._participants.filter(p => this.isParticipantConnected(p.id));
  }

  /**
   * Get all disconnected participants
   * @returns {Array<Object>} Array of disconnected participant objects
   */
  getDisconnectedParticipants() {
    return this._participants.filter(p => p.disconnected || !this.isParticipantConnected(p.id));
  }

  /**
   * Handle participant reconnection
   * @param {number} participantId - The participant ID
   * @returns {boolean} True if reconnection was successful, false otherwise
   */
  handleParticipantReconnection(participantId) {
    const participant = this.getParticipantById(participantId);
    if (!participant) {
      return false;
    }
    
    // Update connection status
    this.updateParticipantConnection(participantId, true);
    
    return true;
  }

  /**
   * Handle participant disconnection
   * @param {number} participantId - The participant ID
   * @returns {boolean} True if disconnection was successful, false otherwise
   */
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
    
    return true;
  }

  // Game Token Management
  // ---------------------

  /**
   * Get the game token for a specific participant
   * @param {number} participantId - The participant ID
   * @returns {string|null} - The encrypted game token for the participant, or null if not found
   */
  getParticipantToken(participantId) {
    return this._participantTokens.get(participantId) || null;
  }

  /**
   * Set the game token for a specific participant
   * @param {number} participantId - The participant ID
   * @param {string} token - The encrypted game token
   */
  setParticipantToken(participantId, token) {
    this._participantTokens.set(participantId, token);
  }

  /**
   * Get all participant tokens for this session
   * @returns {Map<number, string>} - Map of participantId to encrypted game token
   */
  getAllParticipantTokens() {
    return new Map(this._participantTokens);
  }

  /**
   * Generate a new game token for a specific participant
   * @param {number} participantId - The participant ID
   * @returns {Promise<string>} - Promise that resolves to the encrypted game token
   */
  async generateParticipantToken(participantId) {
    // Import the service dynamically to avoid circular dependencies
    return import("../game-token-service.js").then(({ gameTokenService }) => {
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
      this._participantTokens.set(participantId, token);
      console.log(`Regenerated game token for participant ${participantId} in session ${this._sessionId}`);
      return token;
    });
  }

  // Utility Methods
  // ---------------

  /**
   * Get the total number of participants
   * @returns {number} The total participant count
   */
  getParticipantCount() {
    return this._participants.length;
  }

  /**
   * Get the number of playable participants
   * @returns {number} The playable participant count
   */
  getPlayableParticipantCount() {
    return this.getPlayableParticipants().length;
  }

  /**
   * Get the number of spectator participants
   * @returns {number} The spectator count
   */
  getSpectatorCount() {
    return this.getSpectatorParticipants().length;
  }

  /**
   * Check if a participant exists
   * @param {number} participantId - The participant ID to check
   * @returns {boolean} True if the participant exists, false otherwise
   */
  hasParticipant(participantId) {
    return this._participants.some(p => p.id === participantId);
  }

  /**
   * Get a participant by name
   * @param {string} name - The participant name
   * @returns {Object|null} The participant object or null if not found
   */
  getParticipantByName(name) {
    return this._participants.find(p => p.name === name) || null;
  }

  /**
   * Get participant statistics
   * @returns {Object} Object containing various participant statistics
   */
  getParticipantStats() {
    const allParticipants = this._participants;
    const playableParticipants = this.getPlayableParticipants();
    const spectatorParticipants = this.getSpectatorParticipants();
    const connectedParticipants = this.getConnectedParticipants();

    return {
      total: allParticipants.length,
      playable: playableParticipants.length,
      spectators: spectatorParticipants.length,
      connected: connectedParticipants.length,
      disconnected: allParticipants.length - connectedParticipants.length,
      host: this.getHost()
    };
  }
}
