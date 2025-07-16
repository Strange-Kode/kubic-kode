import { GameSession } from "./game-session.js";
import { gameRegistry } from "./game-registry.js";
import { v4 as uuidv4 } from "uuid";

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

  createSession(gameVariantId) {
    console.log("creating game session...");
    const sessionId = uuidv4(); // generate unique ID
    const gameInstance = gameRegistry.createGameInstance(
      gameVariantId,
      sessionId
    );
    if (this.sessions.has(sessionId)) {
      // Unlikely, but just in case
      return this.createSession(gameTypeId);
    }
    console.log(
      `allocated new session id: ${sessionId} for game variant: ${gameVariantId}`
    );
    const session = new GameSession(sessionId, gameInstance);
    this.sessions.set(sessionId, session);
    return session; // Return the session instance, not an object
  }

  hasSession(sessionId) {
    return this.sessions.get(sessionId) !== undefined;
  }

  hasSessions() {
    return this.sessions.size > 0;
  }
}

export const sessionManager = new SessionManager();
