import { gameHistoryManager } from "../game-history-manager.js";

import { kubicLog } from "../../kubic-log.js";

export class SessionHistoryManager {
  constructor(sessionId) {
    this._sessionId = sessionId;
    // Get game history from the manager (returns a proxy)
    this._gameHistory = gameHistoryManager.getGameHistory(sessionId);
  }

  // Game History Access
  // -------------------

  /**
   * Get the game history for this session
   * @returns {Object} The game history proxy object
   */
  getGameHistory() {
    return this._gameHistory;
  }

  // Subscription Management
  // -----------------------

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

  // Game History Events
  // -------------------

  /**
   * Add participant joined event to game history
   * @param {number} participantId - The participant ID
   * @param {string} participantName - The participant name
   * @param {string} participantType - The participant type
   */
  addParticipantJoinedEvent(participantId, participantName, participantType) {
    this._gameHistory.addParticipantJoinedEvent(participantId, participantName, participantType);
  }

  /**
   * Add participant left event to game history
   * @param {number} participantId - The participant ID
   * @param {string} participantName - The participant name
   */
  addParticipantLeftEvent(participantId, participantName) {
    this._gameHistory.addParticipantLeftEvent(participantId, participantName);
  }

  /**
   * Add session started event to game history
   * @param {Array<Object>} participants - Array of participant objects
   */
  addSessionStartedEvent(participants) {
    this._gameHistory.addSessionStartedEvent(participants);
  }

  /**
   * Add session ended event to game history
   * @param {number} participantCount - Number of participants when session ended
   */
  addSessionEndedEvent(participantCount) {
    this._gameHistory.addSessionEndedEvent(participantCount);
  }

  /**
   * Add restart vote started event to game history
   * @param {number} participantCount - Number of playable participants
   */
  addRestartVoteStartedEvent(participantCount) {
    this._gameHistory.addRestartVoteStartedEvent(participantCount);
  }

  /**
   * Add restart vote registered event to game history
   * @param {number} participantId - The participant ID
   * @param {boolean} voteYes - Whether the participant voted yes
   * @param {number} totalVotes - Total number of votes cast
   */
  addRestartVoteRegisteredEvent(participantId, voteYes, totalVotes) {
    this._gameHistory.addRestartVoteRegisteredEvent(participantId, voteYes, totalVotes);
  }

  /**
   * Add restart vote cleared event to game history
   * @param {boolean|null} voteResult - The result of the vote, or null if vote was incomplete
   */
  addRestartVoteClearedEvent(voteResult) {
    this._gameHistory.addRestartVoteClearedEvent(voteResult);
  }

  // History Statistics
  // ------------------

  /**
   * Get game history statistics
   * @returns {Object} Object containing game history statistics
   */
  getHistoryStats() {
    const events = this._gameHistory.getAllEvents();
    
    const eventTypes = {};
    events.forEach(event => {
      const type = event.type;
      eventTypes[type] = (eventTypes[type] || 0) + 1;
    });

    return {
      totalEvents: events.length,
      eventTypes: eventTypes,
      sessionId: this._sessionId,
      subscriptions: this.getGameHistorySubscriptions()
    };
  }

  /**
   * Get events by type
   * @param {string} eventType - The event type to filter by
   * @returns {Array<Object>} Array of events of the specified type
   */
  getEventsByType(eventType) {
    const events = this._gameHistory.getAllEvents();
    return events.filter(event => event.type === eventType);
  }

  /**
   * Get events by date range
   * @param {Date} startDate - Start date for filtering
   * @param {Date} endDate - End date for filtering
   * @returns {Array<Object>} Array of events within the date range
   */
  getEventsByDateRange(startDate, endDate) {
    const events = this._gameHistory.getAllEvents();
    return events.filter(event => {
      const eventDate = new Date(event.timestamp);
      return eventDate >= startDate && eventDate <= endDate;
    });
  }

  /**
   * Clear all game history for this session
   */
  clearGameHistory() {
    // This would need to be implemented in the game history manager
    // For now, we'll just log that this was called
    console.log(`Clearing game history for session ${this._sessionId}`);
  }

  /**
   * Export game history to JSON
   * @returns {Object} JSON representation of the game history
   */
  exportGameHistory() {
    const events = this._gameHistory.getAllEvents();
    return {
      sessionId: this._sessionId,
      exportDate: new Date().toISOString(),
      totalEvents: events.length,
      events: events
    };
  }
}
