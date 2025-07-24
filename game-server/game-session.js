import { InactivityManager } from "../game-utility/inactivity-manager.js";
import { GameHistory } from "./game-history.js";

export class GameSession {
  constructor(sessionId, maxParticipants = 2) {
    this.sessionId = sessionId;
    this.maxParticipants = maxParticipants;
    this.participants = []; // { id, name }
    this.started = false;
    this.participant_alloc_idx = 0;
    this.gameInstance = null;

    this.restartVote = null; // { votes: {}, totalParticipants: N }
    this.inactivityManager = null;
    
    // Game history instance
    this.gameHistory = new GameHistory(sessionId);
  }

  setGameInstance(gameInstance) {
    this.gameInstance = gameInstance;
  }

  allocateParticipantId() {
    this.participant_alloc_idx++;
    return this.participant_alloc_idx;
  }

  addParticipant(name) {
    if (this.participants.length >= this.maxParticipants) {
      throw new Error("Session is full.");
    }

    if (this.started) {
      throw new Error("Cannot join. Game has already started.");
    }

    const participantId = this.allocateParticipantId();

    const existing = this.participants.find((p) => p.id === participantId);
    if (existing) {
      throw new Error("Participant with this ID already exists.");
    }

    this.participants.push({
      id: participantId,
      name: name,
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
    return this.participants.map((p) => ({ id: p.id, name: p.name }));
  }

  getParticipants() {
    return this.participants;
  }

  markStarted() {
    if (this.participants.length < 2) {
      throw new Error("Cannot start game. Not enough participants.");
    }
    
    this.started = true;
    if (this.gameInstance.handleInactivity) {
      const inactivityManager = new InactivityManager(this, this.gameInstance);
      this.inactivityManager = inactivityManager;
      inactivityManager.startTimer();
    }
    else {
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
    this.gameHistory.addRestartVoteRegisteredEvent(participantId, voteYes, Object.keys(this.restartVote.votes).length);
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
}
