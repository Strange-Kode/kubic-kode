import { InactivityManager } from "../game-utility/inactivity-manager.js";
import { gameHistoryManager } from "./game-history-manager.js";

export class GameSession {
  constructor(sessionId, maxParticipants = 2) {
    this.sessionId = sessionId;
    this.maxParticipants = maxParticipants;
    this.participants = []; // { id, name }
    this.started = false;
    this.participant_alloc_idx = 0;
    this.winCounter = 0;
    this.gameInstance = null;

    this.restartVote = null; // { votes: {}, totalParticipants: N }
    this.inactivityManager = null;

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

  allocateParticipantId() {
    this.participant_alloc_idx++;
    return this.participant_alloc_idx;
  }

  addParticipant(name, participant_type = 'human') {
    if (this.participants.length >= this.maxParticipants) {
      throw new Error("Game session is full.");
    }

    if (this.started) {
      throw new Error("Cannot join. Game session has already started.");
    }

    // Validate participant type
    if (!['human', 'computer'].includes(participant_type)) {
      throw new Error(`Invalid participant type specified: ${participant_type}. Expected: 'human' or 'computer'`);
    }

    const participantId = this.allocateParticipantId();

    const existing = this.participants.find((p) => p.id === participantId);
    if (existing) {
      throw new Error("Participant with this ID already exists.");
    }

    this.participants.push({
      id: participantId,
      name: name,
      type: participant_type
    });

    // Add to game history
    this.gameHistory.addParticipantJoinedEvent(participantId, name);

    return participantId;
  }

  removeParticipant(id) {
    const index = this.participants.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error("Participant not found.");
    }

    const participant = this.participants[index];
    this.participants.splice(index, 1);

    // Add to game history
    this.gameHistory.addParticipantLeftEvent(id, participant.name);
  }

  listParticipants() {
    return this.participants.map((p) => ({ id: p.id, name: p.name, type: p.type || 'human' }));
  }

  getParticipants() {
    return this.participants;
  }

  markStarted() {
    this.resetWinCounter();
    if (this.participants.length < 2) {
      throw new Error("Cannot start game. Not enough participants.");
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

    // Add to game history
    this.gameHistory.addSessionStartedEvent(this.participants);
  }

  markEnded() {
    this.started = false;
    if (this.inactivityManager) {
      this.inactivityManager.clearTimer();
    }

    // Add to game history
    this.gameHistory.addSessionEndedEvent(this.participants.length);
  }

  getGameInstance() {
    return this.gameInstance;
  }

  getParticipantById(id) {
    return this.participants.find((p) => p.id === id) || null;
  }

  getSessionId() {
    return this.sessionId;
  }

  startRestartVote() {
    this.restartVote = {
      votes: {}, // participantId => true/false
      totalParticipants: this.participants.length,
    };

    // Add to game history
    this.gameHistory.addRestartVoteStartedEvent(this.participants.length);
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
}
