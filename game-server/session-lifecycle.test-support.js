import http from "node:http";
import { once } from "node:events";
import WebSocket from "ws";

/* The timings are read when game-event-service.js loads, so a test file sets
   them before its first import of this module */
export async function startLifecycleServer() {
  const { GameEventService } = await import("./game-event-service.js");
  const { gameTokenService } = await import("./game-token-service.js");
  const { GameSession } = await import("./session/game-session.js");
  const hooks = await import("../game-module/module-system/hooks.js");

  const sessions = new Map();
  const endedSessions = [];
  hooks.register("session:ended", (session, details) => {
    endedSessions.push({ sessionId: session.getSessionId(), reason: details?.reason });
  });

  const sessionManager = {
    getSession: (id) => sessions.get(id) ?? null,
    removeSession(id) {
      GameEventService.cleanupSession(id);
      return sessions.delete(id);
    },
  };

  const server = http.createServer();
  GameEventService.setSessionManager(sessionManager);
  GameEventService.initWebSocketServer(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();

  let sessionCount = 0;
  const openSockets = new Set();

  /* Only what the service and GameSession read from a game */
  function createGameInstanceDouble(isGameActive) {
    return {
      requiredPlayers: () => 2,
      isGameActive: () => isGameActive,
      getPlayerMappings: () => ({}),
      getGameEngine: () => ({ getTurnNumber: () => 0 }),
    };
  }

  function createSession({ humanCount, computerCount, spectatorCount = 0, isStarted = true, isGameActive = true }) {
    sessionCount += 1;
    const sessionId = `session-${sessionCount}`;
    const session = new GameSession(sessionId, humanCount + computerCount);
    session.setGameInstance(createGameInstanceDouble(isGameActive));
    const humanIds = [];
    for (let index = 0; index < humanCount; index++) {
      humanIds.push(session.addParticipant(`Human ${index + 1}`, "user"));
    }
    for (let index = 0; index < computerCount; index++) {
      session.addParticipant(`Computer ${index + 1}`, "computer");
    }
    const spectatorIds = [];
    for (let index = 0; index < spectatorCount; index++) {
      spectatorIds.push(session.addParticipant(`Spectator ${index + 1}`, "spectator"));
    }
    if (isStarted) session.markStarted();
    sessions.set(sessionId, session);
    return { sessionId, session, humanIds, spectatorIds };
  }

  async function connectSeat(sessionId, participantId) {
    const token = gameTokenService.instance.generateToken(sessionId, participantId);
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/?sessionId=${sessionId}&participantId=${participantId}&gameToken=${encodeURIComponent(token)}`,
    );
    openSockets.add(socket);
    socket.on("close", () => openSockets.delete(socket));
    const messages = [];
    socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
    await once(socket, "open");
    await waitFor(() => messages.some((message) => message.type === "kubic::connectionConfirmed"));
    return { socket, messages };
  }

  /* Resolves with the close code when the server refuses the seat */
  async function connectSeatExpectingRefusal(sessionId, participantId) {
    const token = gameTokenService.instance.generateToken(sessionId, participantId);
    const socket = new WebSocket(
      `ws://127.0.0.1:${port}/?sessionId=${sessionId}&participantId=${participantId}&gameToken=${encodeURIComponent(token)}`,
    );
    const [code, reason] = await once(socket, "close");
    return { code, reason: reason.toString() };
  }

  /* terminate() drops the TCP connection without a close frame, like a phone
     that locks its screen or changes network */
  async function dropSocket(socket) {
    socket.terminate();
    await once(socket, "close");
  }

  async function stop() {
    for (const sessionId of sessions.keys()) GameEventService.cleanupSession(sessionId);
    sessions.clear();
    hooks.clear();
    for (const socket of openSockets) socket.terminate();
    server.closeAllConnections();
    server.close();
    await once(server, "close");
  }

  return { createSession, connectSeat, connectSeatExpectingRefusal, dropSocket, sessionManager, endedSessions, stop };
}

export function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function waitFor(isDone, timeoutMilliseconds = 2000) {
  const startedAt = Date.now();
  while (!isDone()) {
    if (Date.now() - startedAt > timeoutMilliseconds) throw new Error("Timed out waiting for condition");
    await wait(10);
  }
}
