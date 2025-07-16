import { WebSocketServer } from 'ws';

const connectionsBySession = new Map();
let wss = null;

function initWebSocketServer(server) {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        const params = new URLSearchParams(req.url.split('?')[1]);
        const sessionId = params.get('sessionId');

        if (!connectionsBySession.has(sessionId)) {
            connectionsBySession.set(sessionId, []);
        }
        connectionsBySession.get(sessionId).push(ws);

        ws.on('close', () => {
            const conns = connectionsBySession.get(sessionId) || [];
            connectionsBySession.set(sessionId, conns.filter(conn => conn !== ws));
        });
    });
}

function broadcastToSession(sessionId, messageObj) {
    const conns = connectionsBySession.get(sessionId) || [];
    const message = JSON.stringify(messageObj);

    conns.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
            ws.send(message);
        }
    });
}

export const GameEventService = {
    initWebSocketServer,
    broadcastToSession
};
