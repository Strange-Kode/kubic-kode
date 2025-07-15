import { GameSession } from "./game-session.js";
import { v4 as uuidv4 } from "uuid";

// import { gameEngine } from './gameEngineInstance.js';  // Singleton engine instance

class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  getSessions() {
    return Array.from(this.sessions.values());
  }

  createSession() {
    console.log("creating game session...");
    const sessionId = uuidv4(); // generate unique ID
    if (this.sessions.has(sessionId)) {
      // Unlikely, but just in case
      return this.createSession();
    }
    console.log(`allocated new session id: ${sessionId}`);
    const session = new GameSession(sessionId);
    this.sessions.set(sessionId, session);
    return session; // Return the session instance, not an object
  }

  hasSession(sessionId) {
    return this.sessions.get(sessionId) !== undefined;
  }

  hasSessions() {
    return this.sessions.size > 0;
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
