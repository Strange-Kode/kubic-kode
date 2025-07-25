import { WebSocketServer } from 'ws';

const connectionsBySession = new Map();
let wss = null;

function initWebSocketServer(server) {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        const params = new URLSearchParams(req.url.split('?')[1]);
        const sessionId = params.get('sessionId');

        console.log(`[GameEventService] New WebSocket connection for session: ${sessionId}`);

        if (!connectionsBySession.has(sessionId)) {
            connectionsBySession.set(sessionId, []);
        }
        connectionsBySession.get(sessionId).push(ws);

        console.log(`[GameEventService] Total connections for session ${sessionId}: ${connectionsBySession.get(sessionId).length}`);

        ws.on('close', () => {
            const conns = connectionsBySession.get(sessionId) || [];
            connectionsBySession.set(sessionId, conns.filter(conn => conn !== ws));
            console.log(`[GameEventService] WebSocket closed for session ${sessionId}, remaining connections: ${connectionsBySession.get(sessionId).length}`);
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

    console.log(`[GameEventService] Broadcasting ${messageObj.type} to session ${sessionId} with ${conns.length} connections`);
    console.log(`[GameEventService] Message:`, finalMessageObj);

    conns.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
            ws.send(message);
        } else {
            console.log(`[GameEventService] Skipping closed WebSocket connection`);
        }
    });
}

export const GameEventService = {
    initWebSocketServer,
    broadcastToSession
};
