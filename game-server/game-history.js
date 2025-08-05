export class GameHistory {
  // Define all possible game history event types
  static GAME_HISTORY_EVENT_TYPES = {
    TURN_PLAYED: 'turnPlayed',
    PLAYER_WON: 'playerWon',
    GAME_STARTED: 'gameStarted',
    GAME_ENDED: 'gameEnded',
    GAME_TIED: 'gameTied',
    PARTICIPANT_JOINED: 'participantJoined',
    PARTICIPANT_LEFT: 'participantLeft',
    RESTART_VOTE_STARTED: 'restartVoteStarted',
    RESTART_VOTE_REGISTERED: 'restartVoteRegistered',
    RESTART_VOTE_CLEARED: 'restartVoteCleared',
    PLAYER_ADDED: 'playerAdded',
    GAME_INSTANCE_STARTED: 'gameInstanceStarted',
    GAME_INSTANCE_RESET: 'gameInstanceReset',
    GAME_STOPPED: 'gameStopped',
    INVALID_TURN_ATTEMPTED: 'invalidTurnAttempted'
  };

  // Get all valid game history event type strings
  static getValidEventTypes() {
    return Object.values(GameHistory.GAME_HISTORY_EVENT_TYPES);
  }

  // Check if an event type is a valid game history event
  static isValidEventType(eventType) {
    return GameHistory.getValidEventTypes().includes(eventType);
  }

  constructor(sessionId) {
    this.sessionId = sessionId;
    this._gameHistory = [];
  }

  // Read-only access to game history
  get gameHistory() {
    return [...this._gameHistory]; // Return a copy to maintain read-only access
  }

  /**
   * Add an event to the game history
   * @param {Object} event - The event object to add
   * @param {string} event.type - Type of event (must be one of the valid game history event types)
   * @param {string} event.playerId - ID of the player who triggered the event (optional)
   * @param {string} event.participantId - ID of the participant (optional)
   * @param {Object} event.payload - Additional event data (optional)
   * @param {Date} event.timestamp - Timestamp of the event (auto-generated if not provided)
   * @returns {Object} The event that was added to the history
   */
  addEvent(event) {
    // Validate that the event type is a valid game history event type
    if (!GameHistory.isValidEventType(event.type)) {
      throw new Error(`Invalid game history event type: ${event.type}. Valid types are: ${GameHistory.getValidEventTypes().join(', ')}`);
    }

    const historyEvent = {
      type: event.type,
      playerId: event.playerId || null,
      participantId: event.participantId || null,
      payload: event.payload || {},
      timestamp: event.timestamp || new Date(),
      sessionId: this.sessionId
    };
    
    this._gameHistory.push(historyEvent);
    
    // Return the event that was added
    return historyEvent;
  }

  /**
   * Get game history filtered by event type
   * @param {string} eventType - The type of events to filter by
   * @returns {Array} Array of matching history events
   */
  getByType(eventType) {
    return this._gameHistory.filter(event => event.type === eventType);
  }

  /**
   * Get game history filtered by player ID
   * @param {string} playerId - The player ID to filter by
   * @returns {Array} Array of matching history events
   */
  getByPlayerId(playerId) {
    return this._gameHistory.filter(event => event.playerId === playerId);
  }

  /**
   * Get game history filtered by participant ID
   * @param {string} participantId - The participant ID to filter by
   * @returns {Array} Array of matching history events
   */
  getByParticipantId(participantId) {
    return this._gameHistory.filter(event => event.participantId === participantId);
  }

  /**
   * Get game history filtered by time range
   * @param {Date} startTime - Start time for filtering
   * @param {Date} endTime - End time for filtering
   * @returns {Array} Array of matching history events
   */
  getByTimeRange(startTime, endTime) {
    return this._gameHistory.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    );
  }

  /**
   * Get game history filtered by multiple criteria
   * @param {Object} filters - Object containing filter criteria
   * @param {string} filters.type - Event type to filter by
   * @param {string} filters.playerId - Player ID to filter by
   * @param {string} filters.participantId - Participant ID to filter by
   * @param {Date} filters.startTime - Start time for filtering
   * @param {Date} filters.endTime - End time for filtering
   * @returns {Array} Array of matching history events
   */
  getByFilters(filters = {}) {
    return this._gameHistory.filter(event => {
      if (filters.type && event.type !== filters.type) return false;
      if (filters.playerId && event.playerId !== filters.playerId) return false;
      if (filters.participantId && event.participantId !== filters.participantId) return false;
      if (filters.startTime && event.timestamp < filters.startTime) return false;
      if (filters.endTime && event.timestamp > filters.endTime) return false;
      return true;
    });
  }

  /**
   * Get all win events for a specific player
   * @param {string} playerId - The player ID to get wins for
   * @returns {Array} Array of win events for the player
   */
  getPlayerWins(playerId) {
    return this._gameHistory.filter(event => 
      event.type === GameHistory.GAME_HISTORY_EVENT_TYPES.PLAYER_WON && event.playerId === playerId
    );
  }

  /**
   * Get all win events for a specific participant
   * @param {string} participantId - The participant ID to get wins for
   * @returns {Array} Array of win events for the participant
   */
  getParticipantWins(participantId) {
    return this._gameHistory.filter(event => 
      event.type === GameHistory.GAME_HISTORY_EVENT_TYPES.PLAYER_WON && event.participantId === participantId
    );
  }

  /**
   * Get the most recent event of a specific type
   * @param {string} eventType - The type of event to find
   * @returns {Object|null} The most recent event of the specified type, or null if not found
   */
  getLastEventByType(eventType) {
    const events = this.getByType(eventType);
    return events.length > 0 ? events[events.length - 1] : null;
  }

  /**
   * Clear all game history
   */
  clear() {
    this._gameHistory = [];
  }

  /**
   * Add a turn played event to game history
   * @param {string} playerId - ID of the player who played the turn
   * @param {string} participantId - ID of the participant (optional)
   * @param {Object} turnData - Additional turn data (position, result, etc.)
   * @returns {Object} The event that was added
   */
  addTurnPlayedEvent(playerId, participantId = null, turnData = {}) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.TURN_PLAYED,
      playerId: playerId,
      participantId: participantId,
      payload: turnData
    });
  }

  /**
   * Add a player won event to game history
   * @param {string} playerId - ID of the winning player
   * @param {string} participantId - ID of the winning participant (optional)
   * @param {Object} winData - Additional win data (win condition, final state, etc.)
   * @returns {Object} The event that was added
   */
  addPlayerWonEvent(playerId, participantId = null, winData = {}) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.PLAYER_WON,
      playerId: playerId,
      participantId: participantId,
      payload: winData
    });
  }

  /**
   * Add a game tied event to game history
   * @param {Object} tieData - Additional tie data (final state, etc.)
   * @returns {Object} The event that was added
   */
  addGameTiedEvent(tieData = {}) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.GAME_TIED,
      payload: tieData
    });
  }

  /**
   * Add a game state change event to game history
   * @param {string} eventType - Type of state change (e.g., 'gamePaused', 'gameResumed', 'timeout')
   * @param {Object} stateData - Additional state data
   * @returns {Object} The event that was added
   */
  addGameStateEvent(eventType, stateData = {}) {
    return this.addEvent({
      type: eventType,
      payload: stateData
    });
  }

  /**
   * Add a participant joined event to game history
   * @param {string} participantId - ID of the participant who joined
   * @param {string} name - Name of the participant
   * @returns {Object} The event that was added
   */
  addParticipantJoinedEvent(participantId, name) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.PARTICIPANT_JOINED,
      participantId: participantId,
      payload: { name: name }
    });
  }

  /**
   * Add a participant left event to game history
   * @param {string} participantId - ID of the participant who left
   * @param {string} name - Name of the participant
   * @returns {Object} The event that was added
   */
  addParticipantLeftEvent(participantId, name) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.PARTICIPANT_LEFT,
      participantId: participantId,
      payload: { name: name }
    });
  }

  /**
   * Add a game started event to game history
   * @param {Array} participants - Array of participants
   * @returns {Object} The event that was added
   */
  addSessionStartedEvent(participants) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.GAME_STARTED,
      payload: { 
        participantCount: participants.length,
        participants: participants.map(p => ({ id: p.id, name: p.name }))
      }
    });
  }

  /**
   * Add a game ended event to game history
   * @param {number} participantCount - Number of participants
   * @returns {Object} The event that was added
   */
  addSessionEndedEvent(participantCount) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.GAME_ENDED,
      payload: { 
        participantCount: participantCount,
        totalEvents: this._gameHistory.length
      }
    });
  }

  /**
   * Add a restart vote started event to game history
   * @param {number} totalParticipants - Total number of participants
   * @returns {Object} The event that was added
   */
  addRestartVoteStartedEvent(totalParticipants) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.RESTART_VOTE_STARTED,
      payload: { 
        totalParticipants: totalParticipants
      }
    });
  }

  /**
   * Add a restart vote registered event to game history
   * @param {string} participantId - ID of the participant who voted
   * @param {boolean} vote - The vote (true/false)
   * @param {number} totalVotes - Total number of votes cast
   * @returns {Object} The event that was added
   */
  addRestartVoteRegisteredEvent(participantId, vote, totalVotes) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.RESTART_VOTE_REGISTERED,
      participantId: participantId,
      payload: { 
        vote: vote,
        totalVotes: totalVotes
      }
    });
  }

  /**
   * Add a restart vote cleared event to game history
   * @param {boolean|null} voteResult - The result of the vote
   * @returns {Object} The event that was added
   */
  addRestartVoteClearedEvent(voteResult) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.RESTART_VOTE_CLEARED,
      payload: { 
        voteResult: voteResult
      }
    });
  }

  /**
   * Add a player added event to game history
   * @param {string} playerId - ID of the player who was added
   * @param {string} participantId - ID of the participant (optional)
   * @param {Object} playerData - Additional player data (name, etc.)
   */
  addPlayerAddedEvent(playerId, participantId = null, playerData = {}) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.PLAYER_ADDED,
      playerId: playerId,
      participantId: participantId,
      payload: playerData
    });
  }

  /**
   * Add a game instance started event to game history
   * @param {Object} gameData - Additional game data (playerCount, gameType, etc.)
   */
  addGameInstanceStartedEvent(gameData = {}) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.GAME_INSTANCE_STARTED,
      payload: gameData
    });
  }

  /**
   * Add a game instance reset event to game history
   * @param {Object} resetData - Additional reset data (gameType, resetReason, etc.)
   */
  addGameInstanceResetEvent(resetData = {}) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.GAME_INSTANCE_RESET,
      payload: resetData
    });
  }

  /**
   * Add a game stopped event to game history
   * @param {Object} stopData - Additional stop data (reason, etc.)
   */
  addGameStoppedEvent(stopData = {}) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.GAME_STOPPED,
      payload: stopData
    });
  }

  /**
   * Add an invalid turn attempted event to game history
   * @param {string} playerId - ID of the player who attempted the invalid turn
   * @param {string} participantId - ID of the participant (optional)
   * @param {Object} turnData - Additional turn data (reason, attempted move, etc.)
   */
  addInvalidTurnAttemptedEvent(playerId, participantId = null, turnData = {}) {
    return this.addEvent({
      type: GameHistory.GAME_HISTORY_EVENT_TYPES.INVALID_TURN_ATTEMPTED,
      playerId: playerId,
      participantId: participantId,
      payload: turnData
    });
  }
} 