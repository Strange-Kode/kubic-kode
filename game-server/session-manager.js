import { GameSession } from './game-session.js';
// import { gameEngine } from './gameEngineInstance.js';  // Singleton engine instance

class SessionManager {

    constructor() {
        this.sessions = new Map();
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    createSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            throw new Error('Session already exists.');
        }
        const session = new GameSession(sessionId);
        this.sessions.set(sessionId, session);
        return session;
    }

    // createGameEntityForParticipant(sessionId, participantId) {
    //     const session = this.getSession(sessionId);

    //     if (!session) {
    //         throw new Error('Session not found.');
    //     }

    //     const entity = gameEngine.createPlayerEntity();  // Assumes method to create empty player entity
    //     gameEngine.registerEntity(entity);
    //     return entity;
    // }

}

export const sessionManager = new SessionManager();
