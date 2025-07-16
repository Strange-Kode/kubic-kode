export class GameSession {

    constructor(sessionId, gameInstance, maxParticipants = 2) {
        this.sessionId = sessionId;
        this.gameInstance = gameInstance;
        this.maxParticipants = maxParticipants;
        this.participants = [];   // { id, name }
        this.started = false;
        this.participant_alloc_idx = 0;
    }
    
    allocateParticipantId() {
        this.participant_alloc_idx++;
        return this.participant_alloc_idx;
    }

    addParticipant(name) {
        if (this.participants.length >= this.maxParticipants) {
            throw new Error('Session is full.');
        }

        if (this.started) {
            throw new Error('Cannot join. Game has already started.');
        }

        const existing = this.participants.find(p => p.id === id);
        if (existing) {
            throw new Error('Participant with this ID already exists.');
        }

        this.participants.push({
            id: this.allocateParticipantId(),
            name: name
        });
    }

    removeParticipant(id) {
        const index = this.participants.findIndex(p => p.id === id);

        if (index === -1) {
            throw new Error('Participant not found.');
        }

        this.participants.splice(index, 1);
    }

    listParticipants() {
        return this.participants.map(p => ({ id: p.id, name: p.name }));
    }

    markStarted() {
        if (this.participants.length < 2) {
            throw new Error('Cannot start game. Not enough participants.');
        }
        this.started = true;
    }

    markEnded() {
        this.started = false;
    }
    
    getParticipants() {
        return this.participants;
    }

    getParticipantById(id) {
        return this.participants.find(p => p.id === id) || null;
    }
    
    getGameInstance() {
        return this.gameInstance;
    }

}
