import { WebSocketServer } from 'ws';
import { kubicLog } from '../kubic-log.js';

const connectionsBySession = new Map();
let wss = null;

function initWebSocketServer(server) {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        const params = new URLSearchParams(req.url.split('?')[1]);
        const sessionId = params.get('sessionId');

        kubicLog.info(`[GameEventService] New WebSocket connection for session: ${sessionId}`);

        if (!connectionsBySession.has(sessionId)) {
            connectionsBySession.set(sessionId, []);
        }
        connectionsBySession.get(sessionId).push(ws);

        kubicLog.debug(`[GameEventService] Total connections for session ${sessionId}: ${connectionsBySession.get(sessionId).length}`);

        ws.on('close', () => {
            const conns = connectionsBySession.get(sessionId) || [];
            connectionsBySession.set(sessionId, conns.filter(conn => conn !== ws));
            kubicLog.debug(`[GameEventService] WebSocket closed for session ${sessionId}, remaining connections: ${connectionsBySession.get(sessionId).length}`);
        });
    });
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

    kubicLog.debug(`[GameEventService] Broadcasting ${messageObj.type} to session ${sessionId} with ${conns.length} connections`);
    kubicLog.trace(`[GameEventService] Message:`, finalMessageObj);

    conns.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
            ws.send(message);
        } else {
            kubicLog.debug(`[GameEventService] Skipping closed WebSocket connection`);
        }
    });
}

export const GameEventService = {
    initWebSocketServer,
    broadcastToSession
};
