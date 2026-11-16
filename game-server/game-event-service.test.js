import { test, describe, before, after, mock } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { once } from "node:events";
import WebSocket from "ws";

process.env.KUBIC_GAME_TOKEN_SECRET_KEY ??= "test-secret-key-at-least-32-characters-long";

const { GameEventService } = await import("./game-event-service.js");
const { gameTokenService } = await import("./game-token-service.js");

const SESSION_ID = "session-1";
const SEAT = 1;
const SPECTATOR_SEAT = 2;

const removedSessionIds = [];

/* A live session with no participants and no game: what the broadcast
   cleanup removes once nobody is seated */
const sessionManagerDouble = {
  getSession(id) {
    if (id !== SESSION_ID) return null;
    return {
      getParticipantById: (participantId) =>
        [SEAT, SPECTATOR_SEAT].includes(Number(participantId)) ? { id: Number(participantId) } : null,
      getParticipants: () => [],
      getGameInstance: () => null,
    };
  },
  removeSession(id) {
    removedSessionIds.push(id);
    return true;
  },
};

let server;
let port;

/* A ping is only answered by a socket the server kept: the handshake handler
   runs before any frame is read, and a closing socket sends no pong */
const connect = (query) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/?${query}`);
    const messages = [];
    socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
    socket.on("close", (code, reason) => resolve({ outcome: "closed", code, reason: reason.toString(), messages }));
    socket.on("error", reject);
    socket.on("open", () => socket.ping());
    socket.on("pong", () => {
      socket.removeAllListeners("close");
      socket.close(1000);
      resolve({ outcome: "open", messages });
    });
  });

/* Resolves once the server has kept the socket, which stays open for the caller */
const openSocket = (query) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/?${query}`);
    socket.on("error", reject);
    socket.on("open", () => socket.ping());
    socket.on("pong", () => resolve(socket));
  });

/* The client's close event can fire before the server's close handler runs;
   the deadline keeps a server that never drops the entry from hanging the run */
const closeAndSettle = async (socket) => {
  socket.close(1000);
  await once(socket, "close");
  const deadline = Date.now() + 1000;
  while (GameEventService.getSessionIdsWithConnections().includes(SESSION_ID) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

const seatQuery = (seat) =>
  `sessionId=${SESSION_ID}&participantId=${seat}&gameToken=${encodeURIComponent(gameTokenService.instance.generateToken(SESSION_ID, seat))}`;

const createSessionSpy = () => {
  const calls = { markEnded: 0 };
  const session = {
    getSessionId: () => SESSION_ID,
    getPlayableParticipants: () => [{ id: SEAT, disconnected: false }],
    getGameInstance: () => ({ requiredPlayers: () => 1, getGameEngine: () => ({ getTurnNumber: () => 0 }) }),
    markEnded: () => { calls.markEnded += 1; },
  };
  return { session, calls };
};

before(async () => {
  server = http.createServer();
  GameEventService.setSessionManager(sessionManagerDouble);
  GameEventService.initWebSocketServer(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  port = server.address().port;
});

after(async () => {
  GameEventService.cleanupSession(SESSION_ID);
  server.close();
  await once(server, "close");
});

describe("initWebSocketServer seat binding", () => {
  test("a seat without a token is refused with 4401 before any confirmation", async () => {
    const result = await connect(`sessionId=${SESSION_ID}&participantId=${SEAT}`);
    assert.strictEqual(result.outcome, "closed");
    assert.strictEqual(result.code, 4401);
    assert.strictEqual(result.reason, "Game token is required");
    assert.deepStrictEqual(result.messages, []);
  });

  test("a token for another seat is refused", async () => {
    const otherSeatToken = gameTokenService.instance.generateToken(SESSION_ID, 2);
    const result = await connect(`sessionId=${SESSION_ID}&participantId=${SEAT}&gameToken=${encodeURIComponent(otherSeatToken)}`);
    assert.strictEqual(result.code, 4401);
    assert.strictEqual(result.reason, "Game token is not valid for this participant");
  });

  test("a token for another session is refused", async () => {
    const otherSessionToken = gameTokenService.instance.generateToken("session-2", SEAT);
    const result = await connect(`sessionId=${SESSION_ID}&participantId=${SEAT}&gameToken=${encodeURIComponent(otherSessionToken)}`);
    assert.strictEqual(result.code, 4401);
    assert.strictEqual(result.reason, "Game token is not valid for this session");
  });

  test("garbage in place of a token is refused", async () => {
    const result = await connect(`sessionId=${SESSION_ID}&participantId=${SEAT}&gameToken=not-a-token`);
    assert.strictEqual(result.code, 4401);
    assert.strictEqual(result.reason, "Invalid or expired game token");
  });

  test("the seat's own token is confirmed", async () => {
    const token = gameTokenService.instance.generateToken(SESSION_ID, SEAT);
    const result = await connect(`sessionId=${SESSION_ID}&participantId=${SEAT}&gameToken=${encodeURIComponent(token)}`);
    assert.strictEqual(result.outcome, "open");
    assert.deepStrictEqual(result.messages[0], {
      type: "kubic::connectionConfirmed",
      payload: { sessionId: SESSION_ID, participantId: String(SEAT) },
    });
  });

  test("a session-only socket with no seat still connects", async () => {
    const result = await connect(`sessionId=${SESSION_ID}`);
    assert.strictEqual(result.outcome, "open");
  });

  test("a session-only socket for a session that does not exist is refused", async () => {
    const result = await connect("sessionId=no-such-session");
    assert.strictEqual(result.code, 4401);
    assert.strictEqual(result.reason, "Game session not found");
  });

  test("before the session manager is set, a socket is told to try again later", async () => {
    GameEventService.setSessionManager(null);
    try {
      const result = await connect(`sessionId=${SESSION_ID}&participantId=${SEAT}`);
      assert.strictEqual(result.code, 1013);
    } finally {
      GameEventService.setSessionManager(sessionManagerDouble);
    }
  });
});

describe("a refused socket", () => {
  test("survives a malformed frame from the peer without an uncaught error", async () => {
    const uncaught = [];
    const onUncaught = (error) => uncaught.push(error);
    process.on("uncaughtException", onUncaught);

    const socket = new WebSocket(`ws://127.0.0.1:${port}/?sessionId=${SESSION_ID}&participantId=${SEAT}`);
    await once(socket, "open");
    /* An unmasked text frame: clients must mask, so ws raises an error on it */
    socket._socket.write(Buffer.from([0x81, 0x01, 0x41]));
    await once(socket, "close");
    await new Promise((resolve) => setTimeout(resolve, 50));

    process.off("uncaughtException", onUncaught);
    assert.deepStrictEqual(uncaught, []);
  });
});

describe("connection bookkeeping", () => {
  test("a session's connection entry is gone once its last socket closes", async () => {
    const seatless = await openSocket(`sessionId=${SESSION_ID}`);
    assert.deepStrictEqual(GameEventService.getSessionIdsWithConnections(), [SESSION_ID]);
    await closeAndSettle(seatless);
    assert.deepStrictEqual(GameEventService.getSessionIdsWithConnections(), []);
  });
});

describe("what keeps a session alive", () => {
  test("a seatless socket alone does not keep a session alive", async () => {
    const seatless = await openSocket(`sessionId=${SESSION_ID}`);
    try {
      const { session, calls } = createSessionSpy();
      GameEventService.checkSessionViability(session);
      assert.strictEqual(calls.markEnded, 1);
    } finally {
      await closeAndSettle(seatless);
    }
  });

  test("a broadcast to a session with only a seatless socket still schedules its cleanup", async () => {
    const seatless = await openSocket(`sessionId=${SESSION_ID}`);
    removedSessionIds.length = 0;
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const { session } = createSessionSpy();
      GameEventService.broadcastToSession(session, { type: "kubic::heartbeat", payload: {} });
      mock.timers.tick(30000);
      assert.deepStrictEqual(removedSessionIds, [SESSION_ID]);
    } finally {
      mock.timers.reset();
      await closeAndSettle(seatless);
    }
  });

  test("a spectator's socket alone does not keep a session alive", async () => {
    const spectator = await openSocket(seatQuery(SPECTATOR_SEAT));
    try {
      const { session, calls } = createSessionSpy();
      GameEventService.checkSessionViability(session);
      assert.strictEqual(calls.markEnded, 1);
    } finally {
      await closeAndSettle(spectator);
    }
  });

  test("a player's socket keeps a session alive", async () => {
    const seated = await openSocket(seatQuery(SEAT));
    try {
      const { session, calls } = createSessionSpy();
      GameEventService.checkSessionViability(session);
      assert.strictEqual(calls.markEnded, 0);
    } finally {
      await closeAndSettle(seated);
    }
  });
});
