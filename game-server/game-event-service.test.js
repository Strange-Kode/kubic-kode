import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import http from "node:http";
import { once } from "node:events";
import WebSocket from "ws";

process.env.KUBIC_GAME_TOKEN_SECRET_KEY ??= "test-secret-key-at-least-32-characters-long";

const { GameEventService } = await import("./game-event-service.js");
const { gameTokenService } = await import("./game-token-service.js");

const SESSION_ID = "session-1";
const SEAT = 1;

/* The service only asks the session manager for session and participant
   existence, so a two-method double is enough */
const sessionManagerDouble = {
  getSession(id) {
    if (id !== SESSION_ID) return null;
    return { getParticipantById: (participantId) => (Number(participantId) === SEAT ? { id: SEAT } : null) };
  },
  removeSession() { return true; },
};

let server;
let port;

const connect = (query) =>
  new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/?${query}`);
    const messages = [];
    socket.on("message", (data) => messages.push(JSON.parse(data.toString())));
    socket.on("close", (code, reason) => resolve({ outcome: "closed", code, reason: reason.toString(), messages }));
    socket.on("error", reject);
    socket.on("open", () => {
      /* Give the server a tick to either confirm the seat or refuse it */
      setTimeout(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000);
          resolve({ outcome: "open", messages });
        }
      }, 50);
    });
  });

describe("initWebSocketServer seat binding", () => {
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
});

describe("a refused socket", () => {
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
