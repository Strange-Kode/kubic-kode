import { WebSocketServer } from 'ws';
import { kubicLog } from '../kubic-log.js';

const connectionsBySession = new Map();
const participantConnections = new Map(); // sessionId -> Map(participantId -> ws)
const heartbeatIntervals = new Map(); // sessionId -> interval
const connectionTimeouts = new Map(); // sessionId -> Map(participantId -> timeout)
let wss = null;

// Heartbeat configuration
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 60000; // 60 seconds - if no heartbeat for 60s, consider disconnected
const RECONNECTION_WINDOW = 120000; // 2 minutes - time to allow reconnection

function initWebSocketServer(server) {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        const params = new URLSearchParams(req.url.split('?')[1]);
        const sessionId = params.get('sessionId');
        const participantId = params.get('participantId');

        kubicLog.info(`[GameEventService]::initWebSocketServer: New WebSocket connection for session: ${sessionId}, participant: ${participantId}`);

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
                type: 'connectionConfirmed',
                payload: { sessionId, participantId }
            }));
        }

        kubicLog.debug(`[GameEventService]::initWebSocketServer: Total connections for session ${sessionId}: ${connectionsBySession.get(sessionId).length}`);

        // Handle incoming messages (including heartbeats)
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                
                if (message.type === 'heartbeat') {
                    handleHeartbeat(sessionId, participantId, ws);
                }
                // TODO: this should be handled elsewhere in the code (#99)
                /* else if (message.type === 'gameAction') {
                    // Reset timeout on any game action
                    if (participantId) {
                        resetParticipantTimeout(sessionId, participantId);
                    }
                } */
            } catch (error) {
                kubicLog.error(`[GameEventService]::initWebSocketServer: Error parsing message:`, error);
            }
        });

        ws.on('close', () => {
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

        ws.on('error', (error) => {
            kubicLog.error(`[GameEventService]::initWebSocketServer: WebSocket error for session ${sessionId}, participant ${participantId}:`, error);
        });
    });
}

function handleHeartbeat(sessionId, participantId, ws) {
    if (participantId) {
        resetParticipantTimeout(sessionId, participantId);
        
        // Send heartbeat response
        ws.send(JSON.stringify({
            type: 'heartbeatResponse',
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
    
    // Import session manager here to avoid circular dependency
    import('./session-manager.js').then(({ sessionManager }) => {
        const session = sessionManager.getSession(sessionId);
        
        if (session) {
            // Check if participant is still in the session
            const participant = session.getParticipantById(participantId);
            if (participant) {
                // Mark participant as disconnected but don't remove yet
                participant.disconnected = true;
                participant.disconnectedAt = new Date().toISOString();
                
                // Broadcast disconnection event
                broadcastToSession(session, {
                    type: 'participantDisconnected',
                    payload: { 
                        participantId: participantId,
                        participantName: participant.name,
                        disconnectedAt: participant.disconnectedAt
                    }
                });
                
                // Check if we should end the session
                checkSessionViability(session);
            }
        }
    }).catch(error => {
        kubicLog.error(`[GameEventService]::handleParticipantDisconnection: Error handling disconnection:`, error);
    });
}

function handleSessionTermination(sessionId, participantId) {
    kubicLog.warn(`[GameEventService]::handleSessionTermination: Participant ${participantId} in session ${sessionId} failed to reconnect within reconnection window`);
    
    // Import session manager here to avoid circular dependency
    import('./session-manager.js').then(({ sessionManager }) => {
        const session = sessionManager.getSession(sessionId);
        
        if (session) {
            // Check if participant is still in the session
            const participant = session.getParticipantById(participantId);
            if (participant) {
                // Remove participant from session
                session.removeParticipant(participantId);
                
                // Broadcast participant removal
                broadcastToSession(session, {
                    type: 'participantRemoved',
                    payload: { 
                        participantId: participantId,
                        participantName: participant.name,
                        reason: 'reconnection_timeout'
                    }
                });
                
                // Check if we should end the session
                checkSessionViability(session);
            }
        }
    }).catch(error => {
        kubicLog.error(`[GameEventService]::handleSessionTermination: Error handling session termination:`, error);
    });
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
        
        // End the session
        session.markEnded();
        
        // Clean up session immediately since no one can receive the broadcast
        setTimeout(() => {
            import('./session-manager.js').then(({ sessionManager }) => {
                sessionManager.removeSession(sessionId);
            }).catch(error => {
                kubicLog.error(`[GameEventService]::checkSessionViability: Error removing orphaned session ${sessionId}:`, error);
            });
        }, 1000);
        return;
    }
    
    // Check if there are insufficient connected players
    if (connectedParticipants.length < requiredPlayers) {
        kubicLog.warn(`[GameEventService]::checkSessionViability: Session ${sessionId} has insufficient connected players (${connectedParticipants.length}/${requiredPlayers}), ending session`);
        
        // End the session
        session.markEnded();
        
        // Broadcast session ended due to disconnection
        broadcastToSession(session, {
            type: 'sessionEnded',
            payload: { 
                reason: 'insufficient_players',
                message: 'Session ended due to insufficient connected players',
                connectedParticipants: connectedParticipants.length,
                requiredParticipants: requiredPlayers
            }
        });
        
        // Clean up session after a delay
        setTimeout(() => {
            import('./session-manager.js').then(({ sessionManager }) => {
                sessionManager.removeSession(sessionId);
            }).catch(error => {
                kubicLog.error(`[GameEventService]::checkSessionViability: Error removing session:`, error);
            });
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
                    type: 'heartbeat',
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
        
        // Trigger session cleanup since no clients are connected to receive any broadcasts
        // This prevents orphaned sessions from consuming resources
        setTimeout(() => {
            import('./session-manager.js').then(({ sessionManager }) => {
                const session = sessionManager.getSession(sessionId);
                if (session) {
                    kubicLog.info(`[GameEventService]::broadcastToSession: Cleaning up orphaned session ${sessionId} with no active connections`);
                    sessionManager.removeSession(sessionId);
                }
            }).catch(error => {
                kubicLog.error(`[GameEventService]::broadcastToSession: Error cleaning up orphaned session ${sessionId}:`, error);
            });
        }, 1000); // Small delay to avoid immediate cleanup on temporary disconnections
        
        return;
    }

    kubicLog.debug(`[GameEventService]::broadcastToSession: Broadcasting ${messageObj.type} to session ${sessionId} with ${conns.length} connections`);
    kubicLog.trace(`[GameEventService]::broadcastToSession: Message:`, finalMessageObj);

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
        const timeouts = connectionTimeouts.get(sessionId);
        timeouts.forEach(timeout => clearTimeout(timeout));
        connectionTimeouts.delete(sessionId);
    }
    
    // Clear connections
    connectionsBySession.delete(sessionId);
    participantConnections.delete(sessionId);
    
    kubicLog.debug(`[GameEventService]::cleanupSession: Cleaned up session ${sessionId}`);
}

export const GameEventService = {
    initWebSocketServer,
    broadcastToSession,
    startHeartbeatForSession,
    stopHeartbeatForSession,
    isParticipantConnected,
    getConnectedParticipants,
    cleanupSession
};
