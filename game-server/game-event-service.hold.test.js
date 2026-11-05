import { test, describe, before, after } from "node:test";
import assert from "node:assert";

process.env.KUBIC_GAME_TOKEN_SECRET_KEY ??= "test-secret-key-at-least-32-characters-long";
process.env.KUBIC_HEARTBEAT_TIMEOUT = "60";
process.env.KUBIC_RECONNECTION_WINDOW = "150";
process.env.KUBIC_HOLD_SOLO_SESSIONS = "true";
process.env.KUBIC_SOLO_RECONNECTION_WINDOW = "500";

const { startLifecycleServer, wait, waitFor } = await import("./session-lifecycle.test-support.js");

let lifecycle;

before(async () => {
  lifecycle = await startLifecycleServer();
});

after(async () => {
  await lifecycle.stop();
});

describe("with KUBIC_HOLD_SOLO_SESSIONS on", () => {
  test("a human alone against computers is held past the normal reconnection window", async () => {
    const { sessionId, humanIds } = lifecycle.createSession({ humanCount: 1, computerCount: 1 });
    const { socket } = await lifecycle.connectSeat(sessionId, humanIds[0]);
    await lifecycle.dropSocket(socket);

    await wait(250);

    assert.ok(lifecycle.sessionManager.getSession(sessionId), "session should still exist");
    assert.deepStrictEqual(lifecycle.endedSessions.filter((ended) => ended.sessionId === sessionId), []);
  });

  test("the held human reconnects, is no longer disconnected, and the session announces it", async () => {
    const { sessionId, session, humanIds } = lifecycle.createSession({ humanCount: 1, computerCount: 3 });
    const { socket } = await lifecycle.connectSeat(sessionId, humanIds[0]);
    await lifecycle.dropSocket(socket);
    await waitFor(() => session.getParticipantById(humanIds[0]).disconnected);

    const { socket: returningSocket, messages } = await lifecycle.connectSeat(sessionId, humanIds[0]);
    await waitFor(() => messages.some((message) => message.type === "kubic::participantReconnected"));

    assert.strictEqual(session.getParticipantById(humanIds[0]).disconnected, false);
    await wait(600);
    assert.ok(lifecycle.sessionManager.getSession(sessionId), "session should outlive the hold once the human is back");
    returningSocket.close(1000);
  });

  test("a human who comes back before being marked disconnected releases a hold that already started", async () => {
    const { sessionId, humanIds, spectatorIds } = lifecycle.createSession({ humanCount: 1, computerCount: 1, spectatorCount: 1 });
    const human = await lifecycle.connectSeat(sessionId, humanIds[0]);
    const spectator = await lifecycle.connectSeat(sessionId, spectatorIds[0]);
    await lifecycle.dropSocket(spectator.socket);
    await wait(20);
    await lifecycle.dropSocket(human.socket);
    // The spectator's mark at ~60 ms starts the hold while the human is not yet marked
    await wait(50);
    const returningHuman = await lifecycle.connectSeat(sessionId, humanIds[0]);

    await wait(700);
    assert.ok(lifecycle.sessionManager.getSession(sessionId), "the returning human must release the hold");
    assert.deepStrictEqual(lifecycle.endedSessions.filter((ended) => ended.sessionId === sessionId), []);
    returningHuman.socket.close(1000);
  });

  test("the hold ends the session once the solo reconnection window runs out", async () => {
    const { sessionId, humanIds } = lifecycle.createSession({ humanCount: 1, computerCount: 1 });
    const { socket } = await lifecycle.connectSeat(sessionId, humanIds[0]);
    await lifecycle.dropSocket(socket);

    await waitFor(() => lifecycle.endedSessions.some((ended) => ended.sessionId === sessionId));

    assert.deepStrictEqual(lifecycle.endedSessions.find((ended) => ended.sessionId === sessionId), {
      sessionId,
      reason: "hold_expired",
    });
    await waitFor(() => !lifecycle.sessionManager.getSession(sessionId));
  });

  test("a game that ends during the hold reports one session:ended, with the game's own reason", async () => {
    const { sessionId, session, humanIds } = lifecycle.createSession({ humanCount: 1, computerCount: 1 });
    const { socket } = await lifecycle.connectSeat(sessionId, humanIds[0]);
    await lifecycle.dropSocket(socket);
    await wait(100);
    session.markEnded("game_won");

    await waitFor(() => !lifecycle.sessionManager.getSession(sessionId));

    assert.deepStrictEqual(lifecycle.endedSessions.filter((ended) => ended.sessionId === sessionId), [
      { sessionId, reason: "game_won" },
    ]);
  });

  test("a socket that arrives after the hold expired, before removal, is refused", async () => {
    const { sessionId, humanIds } = lifecycle.createSession({ humanCount: 1, computerCount: 1 });
    const { socket } = await lifecycle.connectSeat(sessionId, humanIds[0]);
    await lifecycle.dropSocket(socket);
    await waitFor(() => lifecycle.endedSessions.some((ended) => ended.sessionId === sessionId));

    const refusal = await lifecycle.connectSeatExpectingRefusal(sessionId, humanIds[0]);

    assert.deepStrictEqual(refusal, { code: 4401, reason: "Game session has ended" });
  });

  test("a session with two humans is not held", async () => {
    const { sessionId, humanIds } = lifecycle.createSession({ humanCount: 2, computerCount: 1 });
    const first = await lifecycle.connectSeat(sessionId, humanIds[0]);
    const second = await lifecycle.connectSeat(sessionId, humanIds[1]);
    await lifecycle.dropSocket(first.socket);
    await lifecycle.dropSocket(second.socket);

    await waitFor(() => lifecycle.endedSessions.some((ended) => ended.sessionId === sessionId), 400);

    assert.strictEqual(lifecycle.endedSessions.find((ended) => ended.sessionId === sessionId).reason, "orphaned");
  });

  test("a spectator's reconnection window running out does not cut the hold short", async () => {
    const { sessionId, humanIds, spectatorIds } = lifecycle.createSession({ humanCount: 1, computerCount: 1, spectatorCount: 1 });
    const human = await lifecycle.connectSeat(sessionId, humanIds[0]);
    const spectator = await lifecycle.connectSeat(sessionId, spectatorIds[0]);
    await lifecycle.dropSocket(spectator.socket);
    await wait(20);
    const humanDroppedAt = Date.now();
    await lifecycle.dropSocket(human.socket);

    await wait(300);
    assert.ok(lifecycle.sessionManager.getSession(sessionId), "the spectator's removal must not end the hold");

    await waitFor(() => lifecycle.endedSessions.some((ended) => ended.sessionId === sessionId));
    assert.strictEqual(lifecycle.endedSessions.find((ended) => ended.sessionId === sessionId).reason, "hold_expired");
    assert.ok(Date.now() - humanDroppedAt >= 500, "the hold should last the full solo window");
  });

  test("a session that becomes solo after a human is removed gets the full hold", async () => {
    const { sessionId, humanIds } = lifecycle.createSession({ humanCount: 2, computerCount: 1 });
    const leaving = await lifecycle.connectSeat(sessionId, humanIds[0]);
    const staying = await lifecycle.connectSeat(sessionId, humanIds[1]);
    await lifecycle.dropSocket(leaving.socket);
    await waitFor(() => staying.messages.some((message) => message.type === "kubic::participantRemoved"));

    const lastHumanDroppedAt = Date.now();
    await lifecycle.dropSocket(staying.socket);

    await waitFor(() => lifecycle.endedSessions.some((ended) => ended.sessionId === sessionId));
    assert.strictEqual(lifecycle.endedSessions.find((ended) => ended.sessionId === sessionId).reason, "hold_expired");
    assert.ok(Date.now() - lastHumanDroppedAt >= 500, "the hold should last the full solo window");
  });

  test("an expired hold tells the sockets still connected that the session ended", async () => {
    const { sessionId, humanIds, spectatorIds } = lifecycle.createSession({ humanCount: 1, computerCount: 1, spectatorCount: 1 });
    const human = await lifecycle.connectSeat(sessionId, humanIds[0]);
    const spectator = await lifecycle.connectSeat(sessionId, spectatorIds[0]);
    await lifecycle.dropSocket(human.socket);

    await waitFor(() => spectator.messages.some((message) => message.type === "kubic::sessionEnded"));

    assert.strictEqual(spectator.messages.find((message) => message.type === "kubic::sessionEnded").payload.reason, "hold_expired");
  });

  test("a finished game is not held", async () => {
    const { sessionId, humanIds } = lifecycle.createSession({ humanCount: 1, computerCount: 1, isGameActive: false });
    const { socket } = await lifecycle.connectSeat(sessionId, humanIds[0]);
    await lifecycle.dropSocket(socket);

    await waitFor(() => lifecycle.endedSessions.some((ended) => ended.sessionId === sessionId), 400);

    assert.strictEqual(lifecycle.endedSessions.find((ended) => ended.sessionId === sessionId).reason, "orphaned");
  });

  test("a session that has not started is not held", async () => {
    const { sessionId, humanIds } = lifecycle.createSession({ humanCount: 1, computerCount: 1, isStarted: false });
    const { socket } = await lifecycle.connectSeat(sessionId, humanIds[0]);
    await lifecycle.dropSocket(socket);

    await waitFor(() => lifecycle.endedSessions.some((ended) => ended.sessionId === sessionId), 400);

    assert.strictEqual(lifecycle.endedSessions.find((ended) => ended.sessionId === sessionId).reason, "orphaned");
  });
});
