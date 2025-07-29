import { GameSession } from "./game-session.js";
import { gameRegistry } from "./game-registry.js";
import { validateGameInstance } from "../game-engine/interface-compliance-checker.js";
import { KubicKodeGame } from "../game-engine/kubic-kode-game.js";
import { gameHistoryManager } from "./game-history-manager.js";
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

  createSession(gameVariantId, options = {}) {
    console.log("creating game session...");
    const sessionId = uuidv4(); // generate unique ID

    if (this.sessions.has(sessionId)) {
      // Unlikely, but just in case
      return this.createSession(gameVariantId, options);
    }
    
    const gameInstance = gameRegistry.createGameInstance(
      gameVariantId,
      sessionId,
      options
    );
    
    // Validate that the game instance implements the required interface
    validateGameInstance(gameInstance, gameInstance.constructor.name);
    
    console.log(
      `allocated new session id: ${sessionId} for game variant: ${gameVariantId}`
    );
    
    // Create the session with sessionId and maxParticipants (default 2)
    const session = new GameSession(sessionId, options.maxParticipants || 2);
    
    // Create the wrapper with the session reference
    const kubicKodeGame = new KubicKodeGame(gameInstance, session);
    
    // Set the wrapper in the session
    session.setGameInstance(kubicKodeGame);
    
    this.sessions.set(sessionId, session);
    return session; // Return the session instance, not an object
  }

  hasSession(sessionId) {
    return this.sessions.get(sessionId) !== undefined;
  }

  hasSessions() {
    return this.sessions.size > 0;
  }

  /**
   * Remove a session and clean up its resources
   * @param {string} sessionId - The session ID to remove
   * @returns {boolean} True if session was removed, false if not found
   */
  removeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.log(`[SessionManager] Session ${sessionId} not found for removal`);
      return false;
    }

    try {
      // Clear game history manager resources for this session
      gameHistoryManager.removeSessionHistory(sessionId);
      
      // Remove from sessions map
      this.sessions.delete(sessionId);
      
      console.log(`[SessionManager] Successfully removed session ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`[SessionManager] Error removing session ${sessionId}:`, error);
      return false;
    }
  }
}

export const sessionManager = new SessionManager();
