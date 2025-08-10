import { GameSession } from "./game-session.js";
import { gameRegistry } from "./game-registry.js";
import { validateGameInstance } from "../game-engine/interface-compliance-checker.js";
import { KubicKodeGame } from "../game-engine/kubic-kode-game.js";
import { gameHistoryManager } from "./game-history-manager.js";
import { GameEventService } from "./game-event-service.js";
import { kubicLog } from "../kubic-log.js";
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
    kubicLog.info("[SessionManager]::createSession: creating game session...");
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
    
    kubicLog.info(
      `[SessionManager]::createSession: allocated new session id: ${sessionId} for game variant: ${gameVariantId}`
    );
    
    // Create the session with sessionId, maxParticipants (default 2), and gameVariantId
    const session = new GameSession(sessionId, options.maxParticipants || 2, gameVariantId);
    
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
      kubicLog.warn(`[SessionManager]::removeSession: Session ${sessionId} not found for removal`);
      return false;
    }

    try {
      // Stop heartbeat and clean up WebSocket connections
      session.stopHeartbeat();
      GameEventService.cleanupSession(sessionId);
      
      // Clear game history manager resources for this session
      gameHistoryManager.removeSessionHistory(sessionId);
      
      // Remove from sessions map
      this.sessions.delete(sessionId);
      
      kubicLog.info(`[SessionManager]::removeSession: Successfully removed session ${sessionId}`);
      return true;
    } catch (error) {
      kubicLog.error(`[SessionManager]::removeSession: Error removing session ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * Get all sessions with their connection status
   * @returns {Array} Array of session status objects
   */
  getSessionsWithStatus() {
    return Array.from(this.sessions.values()).map(session => ({
      ...session.getSessionStatus(),
      participants: session.listParticipants()
    }));
  }

  /**
   * Get sessions that are viable (have enough connected players)
   * @returns {Array} Array of viable sessions
   */
  getViableSessions() {
    return Array.from(this.sessions.values()).filter(session => {
      const status = session.getSessionStatus();
      return status.viable && !status.started;
    });
  }

  /**
   * Clean up inactive sessions
   * @param {number} maxInactiveTime - Maximum time in milliseconds for a session to be inactive
   */
  cleanupInactiveSessions(maxInactiveTime = 30 * 60 * 1000) { // 30 minutes default
    const now = Date.now();
    const sessionsToRemove = [];

    for (const [sessionId, session] of this.sessions) {
      const status = session.getSessionStatus();
      
      // Remove sessions that have ended and have no connected participants
      if (status.started === false && status.connectedParticipants === 0) {
        sessionsToRemove.push(sessionId);
        continue;
      }

      // Check for sessions that have been inactive for too long
      const participants = session.getParticipants();
      const allDisconnected = participants.every(p => p.disconnected);
      const lastActivity = participants.reduce((latest, p) => {
        if (p.disconnectedAt) {
          const disconnectedTime = new Date(p.disconnectedAt).getTime();
          return Math.max(latest, disconnectedTime);
        }
        return latest;
      }, 0);

      if (allDisconnected && (now - lastActivity) > maxInactiveTime) {
        sessionsToRemove.push(sessionId);
      }
    }

    // Remove the identified sessions
    sessionsToRemove.forEach(sessionId => {
      kubicLog.info(`[SessionManager]::cleanupInactiveSessions: Cleaning up inactive session: ${sessionId}`);
      this.removeSession(sessionId);
    });

    if (sessionsToRemove.length > 0) {
      kubicLog.info(`[SessionManager]::cleanupInactiveSessions: Cleaned up ${sessionsToRemove.length} inactive sessions`);
    }
  }

  /**
   * Get session statistics
   * @returns {Object} Session statistics
   */
  getSessionStats() {
    const sessions = Array.from(this.sessions.values());
    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.getSessionStatus().started).length;
    const viableSessions = sessions.filter(s => s.getSessionStatus().viable).length;
    
    let totalParticipants = 0;
    let connectedParticipants = 0;
    let disconnectedParticipants = 0;

    sessions.forEach(session => {
      const participants = session.getParticipants();
      totalParticipants += participants.length;
      connectedParticipants += participants.filter(p => !p.disconnected).length;
      disconnectedParticipants += participants.filter(p => p.disconnected).length;
    });

    return {
      totalSessions,
      activeSessions,
      viableSessions,
      totalParticipants,
      connectedParticipants,
      disconnectedParticipants
    };
  }
}

export const sessionManager = new SessionManager();
