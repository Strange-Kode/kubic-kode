import { kubicLog } from "../../kubic-log.js";

export default {
  async init() {
    kubicLog.info('[session] Module initialized');
  },

  /**
   * Initialize or reuse existing session
   * @param {Object} sessionManager - The session manager
   * @param {string} gameId - The game variant ID
   * @param {Object} options - Session initialization options
   * @returns {Object} Session initialization result
   */
  initSession(sessionManager, gameId, options = {}) {
    const { forceNew = false, ...otherOptions } = options;
    let sessionState, session_created;
    
    // Check if we should force new session creation or reuse existing
    if (!forceNew && sessionManager.hasSessions()) {
      sessionState = sessionManager.getSessions()[0];
      session_created = false;
    } else {
      sessionState = sessionManager.createSession(gameId, { ...otherOptions });
      session_created = true;
    }
    
    kubicLog.info(`[session] Session created: ${session_created}`);
    kubicLog.info(`[session] Session id: ${sessionState.getSessionId()}`);
    
    return {
      session_id: sessionState.getSessionId(),
      session_created: session_created,
    };
  },

  /**
   * Get lobby status for a session
   * @param {Object} session - The game session
   * @returns {Object} Lobby status information
   */
  getLobbyStatus(session) {
    return {
      success: true,
      lobby: session.getLobbyStatus()
    };
  },

  /**
   * List all sessions with lobby information
   * @param {Object} sessionManager - The session manager
   * @returns {Object} List of all sessions
   */
  listSessions(sessionManager) {
    const allSessions = sessionManager.getSessions();
    const sessionList = allSessions.map(session => session.getLobbyStatus());
    
    return {
      success: true,
      total_sessions: sessionList.length,
      sessions: sessionList
    };
  },

  /**
   * Get sessions by game variant
   * @param {Object} sessionManager - The session manager
   * @param {string} gameVariantId - The game variant ID
   * @param {boolean} onlyJoinable - Whether to filter to only joinable sessions
   * @returns {Object} Filtered sessions list
   */
  getSessionsByVariant(sessionManager, gameVariantId, onlyJoinable = false) {
    const allSessions = sessionManager.getSessions();
    let filteredSessions = allSessions.filter(session => 
      session.getGameVariantId() === gameVariantId
    );
    
    // If onlyJoinable flag is set, filter to only sessions that need players
    if (onlyJoinable) {
      filteredSessions = filteredSessions.filter(session => {
        const status = session.getLobbyStatus();
        return !status.started && status.needsMorePlayers;
      });
    }
    
    const sessionList = filteredSessions.map(session => session.getLobbyStatus());
    
    return {
      success: true,
      game_variant_id: gameVariantId,
      only_joinable: onlyJoinable,
      total_sessions: sessionList.length,
      sessions: sessionList
    };
  },

  /**
   * Get session status
   * @param {Object} session - The game session
   * @returns {Object} Session status information
   */
  getSessionStatus(session) {
    const status = session.getSessionStatus();
    const participants = session.listParticipants();
    
    return {
      success: true,
      session_id: session.getSessionId(),
      status: status,
      participants: participants
    };
  },

  /**
   * Get all sessions with status
   * @param {Object} sessionManager - The session manager
   * @returns {Object} All sessions with their statuses
   */
  getSessionsWithStatus(sessionManager) {
    const sessionsWithStatus = sessionManager.getSessionsWithStatus();
    const stats = sessionManager.getSessionStats();
    
    return {
      success: true,
      sessions: sessionsWithStatus,
      stats: stats
    };
  },

  /**
   * Get viable sessions (with enough connected players)
   * @param {Object} sessionManager - The session manager
   * @returns {Object} List of viable sessions
   */
  getViableSessions(sessionManager) {
    const viableSessions = sessionManager.getViableSessions();
    
    return {
      success: true,
      sessions: viableSessions,
      count: viableSessions.length
    };
  },

  /**
   * Cleanup inactive sessions
   * @param {Object} sessionManager - The session manager
   * @param {number} maxInactiveTime - Maximum inactive time in milliseconds
   * @returns {Object} Cleanup result
   */
  cleanupInactiveSessions(sessionManager, maxInactiveTime = 30 * 60 * 1000) {
    sessionManager.cleanupInactiveSessions(maxInactiveTime);
    const stats = sessionManager.getSessionStats();
    
    return {
      success: true,
      message: "Session cleanup completed",
      stats: stats
    };
  },

  /**
   * Get game history with optional filters
   * @param {Object} gameSession - The game session
   * @param {Object} filters - Optional filters for history
   * @returns {Object} Game history result
   */
  getGameHistory(gameSession, filters = {}) {
    // Convert string dates to Date objects if provided
    const processedFilters = { ...filters };
    if (filters.startTime && typeof filters.startTime === "string") {
      processedFilters.startTime = new Date(filters.startTime);
    }
    if (filters.endTime && typeof filters.endTime === "string") {
      processedFilters.endTime = new Date(filters.endTime);
    }

    // Get filtered game history
    const history = gameSession.getGameHistory().getByFilters(processedFilters);

    return {
      success: true,
      sessionId: gameSession.getSessionId(),
      totalEvents: history.length,
      history: history,
    };
  },

  /**
   * Get current subscriptions for a session
   * @param {Object} gameSession - The game session
   * @returns {Object} Current subscriptions
   */
  getSubscriptions(gameSession) {
    const currentSubscriptions = gameSession.getHistoryManager().getGameHistorySubscriptions();

    return {
      success: true,
      sessionId: gameSession.getSessionId(),
      subscribedEventTypes: currentSubscriptions,
      totalSubscriptions: currentSubscriptions.length,
      note: "Subscriptions only apply to game history events. Regular session events (joins, leaves, etc.) are always broadcast.",
    };
  }
};

