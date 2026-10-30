import { WebSocketServer } from "ws";
import { kubicLog } from "../kubic-log.js";
import { KubicBroadcastError, ErrorCodes } from "../game-engine/kubic-kode-error.js";
import { resolveSeat } from "./game-token-middleware.js";

/* Application close code for a refused seat; the client's WS_CLOSE_UNAUTHORIZED
   (client/kubic-kode-helper/core/constants.js) is its pair and treats it as
   final, no reconnect. The client bundle cannot share a module with the server. */
const WS_CLOSE_UNAUTHORIZED = 4401;
/* Standard "Try Again Later": the client's backoff retries it, unlike 4401 */
const WS_CLOSE_TRY_AGAIN_LATER = 1013;

const connectionsBySession = new Map();
const participantConnections = new Map(); // sessionId -> Map(participantId -> ws)
const heartbeatIntervals = new Map(); // sessionId -> interval
const connectionTimeouts = new Map(); // sessionId -> Map(participantId -> timeout)
let wss = null;

/** Set by SessionManager via setSessionManager() to avoid circular import. */
let _sessionManager = null;

/**
 * Set the session manager reference. Called by SessionManager after creation to break circular dependency.
 * @param {{ getSession: (id: string) => *, removeSession: (id: string) => boolean }} sm
 */
function setSessionManager(sm) {
  _sessionManager = sm;
}

// Broadcast event management
const registeredBroadcasts = new Set();
const KUBIC_NAMESPACE = "kubic::";

// Built-in broadcast events with kubic:: namespace
const KUBIC_BUILT_IN_EVENTS = new Set([
  // Session Events
  "kubic::sessionParticipantJoined",
  "kubic::sessionSpectatorJoined", 
  "kubic::sessionParticipantLeft",
  "kubic::sessionEnded",
  "kubic::participantDisconnected",
  "kubic::participantReconnected",
  "kubic::participantRemoved",
  "kubic::participantForceDisconnected",
  
  // Game Events
  "kubic::gameStarted",
  "kubic::gameStopped", 
  "kubic::gameEnded",
  "kubic::turnPlayed",
  "kubic::playerWon",
  "kubic::gameTied",
  "kubic::winCount",
  
  // Lobby Events
  "kubic::lobbyConfigUpdated",
  "kubic::lobbyConfigDeleted",
  "kubic::syncPhaseStarted", 
  "kubic::participantReadyChanged",
  "kubic::participantKicked",
  "kubic::hostTransferred",
  "kubic::lobbyChatMessage",
  
  // Restart Events
  "kubic::restartVoteStarted",
  "kubic::restartVoteUpdate", 
  "kubic::restartVoteResult",
  "kubic::restartVoteRegistered",
  "kubic::restartVoteCleared",
  
  // Game Management Events
  "kubic::playerAdded",
  "kubic::gameInstanceStarted",
  "kubic::gameInstanceReset",
  "kubic::invalidTurnAttempted",
  "kubic::playerInactive",
  "kubic::timeLeft",
  
  // Connection Events
  "kubic::connectionConfirmed",
  "kubic::heartbeat",
  "kubic::heartbeatResponse"
]);

// Initialize built-in events as registered
KUBIC_BUILT_IN_EVENTS.forEach(event => registeredBroadcasts.add(event));

// Heartbeat configuration (configurable via env vars)
const HEARTBEAT_INTERVAL = parseInt(process.env.KUBIC_HEARTBEAT_INTERVAL) || 30000;
const HEARTBEAT_TIMEOUT = parseInt(process.env.KUBIC_HEARTBEAT_TIMEOUT) || 60000;
const RECONNECTION_WINDOW = parseInt(process.env.KUBIC_RECONNECTION_WINDOW) || 120000;

/**
 * Register a new broadcast event type
 * @param {string} eventType - The event type to register
 * @throws {KubicBroadcastError} If the event type is illegal or already exists
 */
function registerBroadcast(eventType) {
  if (eventType.startsWith(KUBIC_NAMESPACE)) {
    throw new KubicBroadcastError(
      `Attempting to register broadcast with reserved kubic:: namespace: ${eventType}`,
      eventType,
      "illegal_namespace",
      { code: ErrorCodes.ILLEGAL_BROADCAST_NAMESPACE }
    );
  }
  
  if (registeredBroadcasts.has(eventType)) {
    throw new KubicBroadcastError(
      `Broadcast event type already exists: ${eventType}`,
      eventType,
      "duplicate_name",
      { code: ErrorCodes.DUPLICATE_BROADCAST_NAME }
    );
  }
  
  registeredBroadcasts.add(eventType);
  kubicLog.info(`[GameEventService]::registerBroadcast: Registered broadcast event type: ${eventType}`);
}

/**
 * Deregister an existing broadcast event type
 * @param {string} eventType - The event type to deregister
 * @throws {KubicBroadcastError} If attempting to deregister kubic:: namespace events
 */
function deregisterBroadcast(eventType) {
  if (eventType.startsWith(KUBIC_NAMESPACE)) {
    throw new KubicBroadcastError(
      `Cannot deregister built-in kubic:: broadcast event: ${eventType}`,
      eventType,
      "illegal_deregister",
      { code: ErrorCodes.ILLEGAL_BROADCAST_NAMESPACE }
    );
  }
  
  if (!registeredBroadcasts.has(eventType)) {
    throw new KubicBroadcastError(
      `Cannot deregister unregistered broadcast event: ${eventType}`,
      eventType,
      "not_found",
      { code: ErrorCodes.BROADCAST_NOT_FOUND }
    );
  }
  
  registeredBroadcasts.delete(eventType);
  kubicLog.info(`[GameEventService]::deregisterBroadcast: Deregistered broadcast event type: ${eventType}`);
}

/**
 * Check if a broadcast event type is registered
 * @param {string} eventType - The event type to check
 * @returns {boolean} True if registered, false otherwise
 */
function isBroadcastRegistered(eventType) {
  return registeredBroadcasts.has(eventType);
}

/**
 * Get all registered broadcast event types
 * @returns {Array<string>} Array of registered event types
 */
function getRegisteredBroadcasts() {
  return Array.from(registeredBroadcasts);
}

/**
 * A seat is claimed from the URL alone, so the same token every game route
 * demands has to be presented here too, before any seat state (connection
 * map, timeouts, viability) is touched. A seatless socket only reads the
 * session's broadcasts, but it still has to name a live session: every
 * sessionId it names becomes a key in the connection map.
 * @returns {string|null} The close reason, or null when the socket may bind
 */
function getHandshakeRefusal(sessionId, participantId, gameToken) {
  if (participantId) {
    const seat = resolveSeat(_sessionManager, sessionId, participantId, gameToken);
    return seat.refusal ? seat.refusal.message : null;
  }
  return _sessionManager.getSession(sessionId) ? null : "Game session not found";
}

function initWebSocketServer(server) {
  // permessage-deflate instantly closes the socket after upgrade on some
  // mobile browsers (confirmed via A/B on a Samsung S22: 1Hz reconnect storm
  // with it on, stable with it off - Strange-Kode/kubic-kode#189). ws also
  // disables it by default on the server and warns about zlib fragmentation.
  wss = new WebSocketServer({ server, perMessageDeflate: false });
  
  wss.on("connection", (ws, req) => {
    const params = new URLSearchParams(req.url.split("?")[1]);
    const sessionId = params.get("sessionId");
    const participantId = params.get("participantId");
    const gameToken = params.get("gameToken");

    kubicLog.info(`[GameEventService]::initWebSocketServer: New WebSocket connection for session: ${sessionId}, participant: ${participantId}`);

    // Installed before the refusal path: a peer we are closing on can still
    // send a bad frame, and ws turns an unlistened error into an uncaught one
    ws.on("error", (error) => {
      kubicLog.error(`[GameEventService]::initWebSocketServer: WebSocket error for session ${sessionId}, participant ${participantId}:`, error);
    });

    if (!_sessionManager) {
      ws.close(WS_CLOSE_TRY_AGAIN_LATER, "Server not ready");
      return;
    }

    const refusalMessage = getHandshakeRefusal(sessionId, participantId, gameToken);
    if (refusalMessage) {
      kubicLog.warn(`[GameEventService]::initWebSocketServer: Refused socket for session ${sessionId}, participant ${participantId}: ${refusalMessage}`);
      ws.close(WS_CLOSE_UNAUTHORIZED, refusalMessage);
      return;
    }
    
    if (!connectionsBySession.has(sessionId)) {
      connectionsBySession.set(sessionId, []);
    }
    connectionsBySession.get(sessionId).push(ws);
    
    // Track participant connection
    if (participantId) {
      if (!participantConnections.has(sessionId)) {
        participantConnections.set(sessionId, new Map());
      }
      participantConnections.get(sessionId).set(participantId, ws);
      
      // Clear any existing timeout for this participant
      clearParticipantTimeout(sessionId, participantId);
      
      // Send immediate connection confirmation
      ws.send(JSON.stringify({
        type: "kubic::connectionConfirmed",
        payload: { sessionId, participantId }
      }));
    }
    
    kubicLog.debug(`[GameEventService]::initWebSocketServer: Total connections for session ${sessionId}: ${connectionsBySession.get(sessionId).length}`);
    
    // Handle incoming messages (including heartbeats)
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === "heartbeat" || message.type === "kubic::heartbeat") {
          handleHeartbeat(sessionId, participantId, ws);
        }
      } catch (error) {
        kubicLog.error(`[GameEventService]::initWebSocketServer: Error parsing message:`, error);
      }
    });
    
    ws.on("close", () => {
      const conns = connectionsBySession.get(sessionId) || [];
      connectionsBySession.set(sessionId, conns.filter(conn => conn !== ws));
      
      // Remove participant connection tracking
      if (participantId && participantConnections.has(sessionId)) {
        participantConnections.get(sessionId).delete(participantId);
      }
      
      kubicLog.debug(`[GameEventService]::initWebSocketServer: WebSocket closed for (session ${sessionId}, participant ${participantId}), remaining connections: ${connectionsBySession.get(sessionId).length}`);
      
      // Start disconnection timeout for this participant
      if (participantId) {
        startParticipantTimeout(sessionId, participantId);
      }
    });
    
  });
}

function handleHeartbeat(sessionId, participantId, ws) {
  if (participantId) {
    resetParticipantTimeout(sessionId, participantId);
    
    // Send heartbeat response
    ws.send(JSON.stringify({
      type: "kubic::heartbeatResponse",
      payload: { timestamp: Date.now() }
    }));
  }
}

function startParticipantTimeout(sessionId, participantId) {
  clearParticipantTimeout(sessionId, participantId);
  
  // First timeout: Mark as disconnected after HEARTBEAT_TIMEOUT
  const heartbeatTimeout = setTimeout(() => {
    handleParticipantDisconnection(sessionId, participantId);
  }, HEARTBEAT_TIMEOUT);
  
  // Second timeout: End session after RECONNECTION_WINDOW
  const reconnectionTimeout = setTimeout(() => {
    handleSessionTermination(sessionId, participantId);
  }, RECONNECTION_WINDOW);
  
  if (!connectionTimeouts.has(sessionId)) {
    connectionTimeouts.set(sessionId, new Map());
  }
  connectionTimeouts.get(sessionId).set(participantId, {
    heartbeatTimeout,
    reconnectionTimeout
  });
}

function resetParticipantTimeout(sessionId, participantId) {
  clearParticipantTimeout(sessionId, participantId);
}

function clearParticipantTimeout(sessionId, participantId) {
  if (connectionTimeouts.has(sessionId)) {
    const timeouts = connectionTimeouts.get(sessionId);
    if (timeouts.has(participantId)) {
      const timeoutObj = timeouts.get(participantId);
      clearTimeout(timeoutObj.heartbeatTimeout);
      clearTimeout(timeoutObj.reconnectionTimeout);
      timeouts.delete(participantId);
    }
  }
}

function handleParticipantDisconnection(sessionId, participantId) {
  kubicLog.warn(`[GameEventService]::handleParticipantDisconnection: Participant ${participantId} in session ${sessionId} is considered disconnected`);
  if (!_sessionManager) return;
  const session = _sessionManager.getSession(sessionId);
  if (!session) return;
  const participant = session.getParticipantById(participantId);
  if (!participant) return;
  participant.disconnected = true;
  participant.disconnectedAt = new Date().toISOString();
  broadcastToSession(session, {
    type: "kubic::participantDisconnected",
    payload: {
      participantId,
      participantName: participant.name,
      disconnectedAt: participant.disconnectedAt
    }
  });
  checkSessionViability(session);
}

function handleSessionTermination(sessionId, participantId) {
  kubicLog.warn(`[GameEventService]::handleSessionTermination: Participant ${participantId} in session ${sessionId} failed to reconnect within reconnection window`);
  if (!_sessionManager) return;
  const session = _sessionManager.getSession(sessionId);
  if (!session) return;
  const participant = session.getParticipantById(participantId);
  if (!participant) return;
  session.removeParticipant(participantId);
  broadcastToSession(session, {
    type: "kubic::participantRemoved",
    payload: {
      participantId,
      participantName: participant.name,
      reason: "reconnection_timeout"
    }
  });
  checkSessionViability(session);
}

function checkSessionViability(session) {
  const sessionId = session.getSessionId();
  const conns = connectionsBySession.get(sessionId) || [];
  const playableParticipants = session.getPlayableParticipants();
  const connectedParticipants = playableParticipants.filter(p => !p.disconnected);

  // Get required players from the game instance
  const gameInstance = session.getGameInstance();
  const requiredPlayers = gameInstance ? gameInstance.requiredPlayers() : 2;

  // Check if there are no active connections (orphaned session)
  if (conns.length === 0) {
    kubicLog.warn(`[GameEventService]::checkSessionViability: Session ${sessionId} has no active connections, ending orphaned session`);
    session.markEnded();
    setTimeout(() => {
      if (_sessionManager) _sessionManager.removeSession(sessionId);
    }, 1000);
    return;
  }

  // Check if there are insufficient connected players
  if (connectedParticipants.length < requiredPlayers) {
    kubicLog.warn(`[GameEventService]::checkSessionViability: Session ${sessionId} has insufficient connected players (${connectedParticipants.length}/${requiredPlayers}), ending session`);
    session.markEnded();
    broadcastToSession(session, {
      type: "kubic::sessionEnded",
      payload: {
        reason: "insufficient_players",
        message: "Session ended due to insufficient connected players",
        connectedParticipants: connectedParticipants.length,
        requiredParticipants: requiredPlayers
      }
    });
    setTimeout(() => {
      if (_sessionManager) _sessionManager.removeSession(sessionId);
    }, 5000);
  }
}

function startHeartbeatForSession(sessionId) {
  if (heartbeatIntervals.has(sessionId)) {
    return; // Already started
  }
  
  const interval = setInterval(() => {
    const conns = connectionsBySession.get(sessionId) || [];
    conns.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: "kubic::heartbeat",
          payload: { timestamp: Date.now() }
        }));
      }
    });
  }, HEARTBEAT_INTERVAL);
  
  heartbeatIntervals.set(sessionId, interval);
  kubicLog.debug(`[GameEventService]::startHeartbeatForSession: Started heartbeat for session ${sessionId}`);
}

function stopHeartbeatForSession(sessionId) {
  if (heartbeatIntervals.has(sessionId)) {
    clearInterval(heartbeatIntervals.get(sessionId));
    heartbeatIntervals.delete(sessionId);
    kubicLog.debug(`[GameEventService]::stopHeartbeatForSession: Stopped heartbeat for session ${sessionId}`);
  }
}

function isParticipantConnected(sessionId, participantId) {
  if (!participantConnections.has(sessionId)) {
    return false;
  }
  const participantWs = participantConnections.get(sessionId).get(participantId);
  return participantWs && participantWs.readyState === participantWs.OPEN;
}

function getConnectedParticipants(sessionId) {
  if (!participantConnections.has(sessionId)) {
    return [];
  }
  
  const connected = [];
  participantConnections.get(sessionId).forEach((ws, participantId) => {
    if (ws.readyState === ws.OPEN) {
      connected.push(participantId);
    }
  });
  return connected;
}

function broadcastToSession(gameSession, messageObj) {
  const sessionId = gameSession.getSessionId()
  const gameInstance = gameSession.getGameInstance();
  const conns = connectionsBySession.get(sessionId) || [];
  
  // Validate broadcast event type
  const eventType = messageObj.type;
  if (!isBroadcastRegistered(eventType)) {
    // If it's a kubic:: event that's not registered, it's likely a built-in event that should be allowed
    if (eventType.startsWith(KUBIC_NAMESPACE)) {
      kubicLog.debug(`[GameEventService]::broadcastToSession: Broadcasting built-in kubic:: event: ${eventType}`);
      // Don't try to register it, just allow it to broadcast
    } else {
      kubicLog.warn(`[GameEventService]::broadcastToSession: Attempting to broadcast unregistered event type: ${eventType}. Auto-registering...`);
      try {
        registerBroadcast(eventType);
      } catch (error) {
        kubicLog.error(`[GameEventService]::broadcastToSession: Failed to auto-register broadcast event ${eventType}:`, error);
        // For non-kubic events, log and continue (backwards compatibility)
      }
    }
  }
  
  // intercept and add message data
  const finalMessageObj = { ... messageObj };
  finalMessageObj.sessionData = {
    sessionId: sessionId,
    turnNumber: gameInstance ? gameInstance.getGameEngine().getTurnNumber() : 0 // Handle null gameInstance case
  }
  const message = JSON.stringify(finalMessageObj);
  
  // Early return if no connections available
  if (conns.length === 0) {
    kubicLog.debug(`[GameEventService]::broadcastToSession: No active connections for session ${sessionId}, skipping broadcast of ${messageObj.type} (unsent message: ${JSON.stringify(messageObj)})`);
    
    // Trigger session cleanup only if no participants are connected and no game is active
    setTimeout(() => {
      if (!_sessionManager) return;
      const session = _sessionManager.getSession(sessionId);
      if (!session) return;
      const participants = session.getParticipants();
      const gameInstance = session.getGameInstance();
      const isGameActive = gameInstance && gameInstance.isGameActive();
      if (participants.length === 0 && !isGameActive) {
        kubicLog.info(`[GameEventService]::broadcastToSession - Cleaning up orphaned session ${sessionId} with no participants and no active game`);
        _sessionManager.removeSession(sessionId);
      } else {
        kubicLog.debug(`[GameEventService]::broadcastToSession - Keeping session ${sessionId} (participants: ${participants.length}, game active: ${isGameActive})`);
      }
    }, 30000); // 30 second delay to allow for HTTP-only usage and temporary disconnections
    
    return;
  }
  
  kubicLog.debug(`[GameEventService]::broadcastToSession: Broadcasting ${messageObj.type} to session ${sessionId} with ${conns.length} connections`);
  kubicLog.trace(`[GameEventService]::broadcastToSession: Message:`, finalMessageObj);
  
  // Log payload size for turnPlayed events (delta vs full-tilemap comparison)
  if (messageObj.type === "kubic::turnPlayed") {
    const uncompressedBytes = Buffer.byteLength(message, "utf8");
    const uncompressedKB = (uncompressedBytes / 1024).toFixed(1);
    kubicLog.info(`[ws-size] turn=${finalMessageObj.sessionData.turnNumber} uncompressed=${uncompressedKB}KB (${uncompressedBytes} bytes)`);
  }

  conns.forEach(ws => {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    } else {
      kubicLog.debug(`[GameEventService]::broadcastToSession: Skipping closed WebSocket connection`);
    }
  });
}

function cleanupSession(sessionId) {
  // Stop heartbeat
  stopHeartbeatForSession(sessionId);
  
  // Clear timeouts
  if (connectionTimeouts.has(sessionId)) {
    const participantIds = Array.from(connectionTimeouts.get(sessionId).keys());
    participantIds.forEach(participantId => clearParticipantTimeout(sessionId, participantId));
    connectionTimeouts.delete(sessionId);
  }
  
  // Clear connections
  connectionsBySession.delete(sessionId);
  participantConnections.delete(sessionId);
  
  kubicLog.debug(`[GameEventService]::cleanupSession: Cleaned up session ${sessionId}`);
}

export const GameEventService = {
  setSessionManager,
  initWebSocketServer,
  broadcastToSession,
  startHeartbeatForSession,
  stopHeartbeatForSession,
  isParticipantConnected,
  getConnectedParticipants,
  cleanupSession,
  checkSessionViability,
  registerBroadcast,
  deregisterBroadcast,
  isBroadcastRegistered,
  getRegisteredBroadcasts
};
