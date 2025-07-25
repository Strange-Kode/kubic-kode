export class GameHistory {
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
   * @param {string} event.type - Type of event (e.g., 'turnPlayed', 'gameStarted', 'playerWon', etc.)
   * @param {string} event.playerId - ID of the player who triggered the event (optional)
   * @param {string} event.participantId - ID of the participant (optional)
   * @param {Object} event.payload - Additional event data (optional)
   * @param {Date} event.timestamp - Timestamp of the event (auto-generated if not provided)
   */
  addEvent(event) {
    const historyEvent = {
      type: event.type,
      playerId: event.playerId || null,
      participantId: event.participantId || null,
      payload: event.payload || {},
      timestamp: event.timestamp || new Date(),
      sessionId: this.sessionId
    };
    
    this._gameHistory.push(historyEvent);
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
      event.type === 'playerWon' && event.playerId === playerId
    );
  }

  /**
   * Get all win events for a specific participant
   * @param {string} participantId - The participant ID to get wins for
   * @returns {Array} Array of win events for the participant
   */
  getParticipantWins(participantId) {
    return this._gameHistory.filter(event => 
      event.type === 'playerWon' && event.participantId === participantId
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
   */
  addTurnPlayedEvent(playerId, participantId = null, turnData = {}) {
    this.addEvent({
      type: 'turnPlayed',
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
   */
  addPlayerWonEvent(playerId, participantId = null, winData = {}) {
    this.addEvent({
      type: 'playerWon',
      playerId: playerId,
      participantId: participantId,
      payload: winData
    });
  }

  /**
   * Add a game state change event to game history
   * @param {string} eventType - Type of state change (e.g., 'gamePaused', 'gameResumed', 'timeout')
   * @param {Object} stateData - Additional state data
   */
  addGameStateEvent(eventType, stateData = {}) {
    this.addEvent({
      type: eventType,
      payload: stateData
    });
  }

  /**
   * Add a participant joined event to game history
   * @param {string} participantId - ID of the participant who joined
   * @param {string} name - Name of the participant
   */
  addParticipantJoinedEvent(participantId, name) {
    this.addEvent({
      type: 'participantJoined',
      participantId: participantId,
      payload: { name: name }
    });
  }

  /**
   * Add a participant left event to game history
   * @param {string} participantId - ID of the participant who left
   * @param {string} name - Name of the participant
   */
  addParticipantLeftEvent(participantId, name) {
    this.addEvent({
      type: 'participantLeft',
      participantId: participantId,
      payload: { name: name }
    });
  }

  /**
   * Add a game started event to game history
   * @param {Array} participants - Array of participants
   */
  addSessionStartedEvent(participants) {
    this.addEvent({
      type: 'gameStarted',
      payload: { 
        participantCount: participants.length,
        participants: participants.map(p => ({ id: p.id, name: p.name }))
      }
    });
  }

  /**
   * Add a game ended event to game history
   * @param {number} participantCount - Number of participants
   */
  addSessionEndedEvent(participantCount) {
    this.addEvent({
      type: 'gameEnded',
      payload: { 
        participantCount: participantCount,
        totalEvents: this._gameHistory.length
      }
    });
  }

  /**
   * Add a restart vote started event to game history
   * @param {number} totalParticipants - Total number of participants
   */
  addRestartVoteStartedEvent(totalParticipants) {
    this.addEvent({
      type: 'restartVoteStarted',
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
   */
  addRestartVoteRegisteredEvent(participantId, vote, totalVotes) {
    this.addEvent({
      type: 'restartVoteRegistered',
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
   */
  addRestartVoteClearedEvent(voteResult) {
    this.addEvent({
      type: 'restartVoteCleared',
      payload: { 
        voteResult: voteResult
      }
    });
  }
} 