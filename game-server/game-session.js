export class GameSession {

    constructor(sessionId, maxParticipants = 2) {
        this.sessionId = sessionId;
        this.maxParticipants = maxParticipants;
        this.participants = [];   // { id, name, gameEntity }
        this.started = false;
    }

    addParticipant(id, name, gameEntity) {
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
            id: id,
            name: name,
            gameEntity: gameEntity    // Must be pre-registered into the GameEngine externally
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

    getParticipantById(id) {
        return this.participants.find(p => p.id === id) || null;
    }

}
