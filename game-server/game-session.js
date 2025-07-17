export class GameSession {
  constructor(sessionId, gameInstance, maxParticipants = 2) {
    this.sessionId = sessionId;
    this.gameInstance = gameInstance;
    this.maxParticipants = maxParticipants;
    this.participants = []; // { id, name }
    this.started = false;
    this.participant_alloc_idx = 0;
    
    this.restartVote = null; // { votes: {}, totalParticipants: N }
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

    // Check for duplicate names (not IDs, since ID doesn't exist yet)
    const existing = this.participants.find((p) => p.name === name);
    if (existing) {
      throw new Error("Participant with this name already exists.");
    }

    const participantId = this.allocateParticipantId();
    this.participants.push({
      id: participantId,
      name: name,
    });

    // Return the participant ID (was missing!)
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
  }

  markEnded() {
    this.started = false;
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
      totalParticipants: this.participants.length
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
    return Object.keys(this.restartVote.votes).length === this.restartVote.totalParticipants;
  }
  
  getRestartVoteResult() {
    if (!this.isRestartVoteComplete()) {
      throw new Error("Vote not complete.");
    }
    return Object.values(this.restartVote.votes).every(v => v === true);
  }
  
  clearRestartVote() {
    this.restartVote = null;
  }
  
}
