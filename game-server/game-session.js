export class GameSession {
  constructor(sessionId, gameInstance, maxParticipants = 2) {
    this.sessionId = sessionId;
    this.gameInstance = gameInstance;
    this.maxParticipants = maxParticipants;
    this.participants = []; // { id, name }
    this.started = false;
    this.participant_alloc_idx = 0;
  }

  allocateParticipantId() {
    this.participant_alloc_idx++;
    return this.participant_alloc_idx;
  }

  addParticipant(name, participant_type) {
    if (this.participants.length >= this.maxParticipants) {
      throw new Error("Game session is full.");
    }

    if (this.started) {
      throw new Error("Cannot join. Game session has already started.");
    }

    // Check for duplicate names (not IDs, since ID doesn't exist yet)
    const existing = this.participants.find((p) => p.name === name);
    if (existing) {
      throw new Error("Participant with this name already exists.");
    }
    
    if (!['human', 'computer'].includes(participant_type)) {
      throw new Error(`Invalid participant type specified: ${participant_type}. Expected: 'human' or 'computer'`)
    }

    const participantId = this.allocateParticipantId();
    this.participants.push({
      id: participantId,
      name: name,
      type: participant_type
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
}
