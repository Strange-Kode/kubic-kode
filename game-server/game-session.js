import { InactivityManager } from "../game-utility/inactivity-manager.js";

export class GameSession {
  constructor(sessionId, gameInstance, maxParticipants = 2) {
    this.sessionId = sessionId;
    this.gameInstance = gameInstance;
    this.maxParticipants = maxParticipants;
    this.participants = []; // { id, name }
    this.started = false;
    this.participant_alloc_idx = 0;

    this.restartVote = null; // { votes: {}, totalParticipants: N }
    this.inactivityManager = null;
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

    return participantId;
  }

  removeParticipant(id) {
    const index = this.participants.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error("Participant not found.");
    }

    this.participants.splice(index, 1);
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
    const inactivityManager = new InactivityManager(this, this.gameInstance);
    this.inactivityManager = inactivityManager;
    inactivityManager.startTimer();
  }

  markEnded() {
    this.started = false;
    if (this.inactivityManager) {
      this.inactivityManager.clearTimer();
    }
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
  }

  registerRestartVote(participantId, voteYes) {
    if (!this.restartVote) {
      throw new Error("No active restart vote.");
    }

    this.restartVote.votes[participantId] = voteYes;
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
    this.restartVote = null;
  }

  getInactivityManager() {
    return this.inactivityManager;
  }
}
