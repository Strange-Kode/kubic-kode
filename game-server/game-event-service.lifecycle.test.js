import { test, describe, before, after } from "node:test";
import assert from "node:assert";

process.env.KUBIC_GAME_TOKEN_SECRET_KEY ??= "test-secret-key-at-least-32-characters-long";
process.env.KUBIC_HEARTBEAT_TIMEOUT = "60";
process.env.KUBIC_RECONNECTION_WINDOW = "150";
delete process.env.KUBIC_HOLD_SOLO_SESSIONS;

const { startLifecycleServer, wait, waitFor } = await import("./session-lifecycle.test-support.js");

let lifecycle;

before(async () => {
  lifecycle = await startLifecycleServer();
});

after(async () => {
  await lifecycle.stop();
});

describe("with KUBIC_HOLD_SOLO_SESSIONS off", () => {
  test("a human alone against computers is not held: the session ends as orphaned", async () => {
    const { sessionId, humanIds } = lifecycle.createSession({ humanCount: 1, computerCount: 1 });
    const { socket } = await lifecycle.connectSeat(sessionId, humanIds[0]);
    await lifecycle.dropSocket(socket);

    await waitFor(() => lifecycle.endedSessions.some((ended) => ended.sessionId === sessionId), 400);

    assert.strictEqual(lifecycle.endedSessions.find((ended) => ended.sessionId === sessionId).reason, "orphaned");
  });

  test("a socket reconnect clears disconnected and broadcasts kubic::participantReconnected", async () => {
    // The computer keeps two playable seats connected, so the session survives the drop
    const { sessionId, session, humanIds } = lifecycle.createSession({ humanCount: 2, computerCount: 1 });
    const stayingHuman = await lifecycle.connectSeat(sessionId, humanIds[1]);
    const leavingHuman = await lifecycle.connectSeat(sessionId, humanIds[0]);
    await lifecycle.dropSocket(leavingHuman.socket);
    await waitFor(() => session.getParticipantById(humanIds[0]).disconnected);

    await lifecycle.connectSeat(sessionId, humanIds[0]);
    await waitFor(() => stayingHuman.messages.some((message) => message.type === "kubic::participantReconnected"));

    assert.strictEqual(session.getParticipantById(humanIds[0]).disconnected, false);
    assert.strictEqual(session.getParticipantById(humanIds[0]).disconnectedAt, null);
  });

  test("a late close of a seat's older socket leaves the newer socket registered and starts no timers", async () => {
    const { sessionId, session, humanIds } = lifecycle.createSession({ humanCount: 2, computerCount: 0 });
    const otherHuman = await lifecycle.connectSeat(sessionId, humanIds[1]);
    const olderSocket = await lifecycle.connectSeat(sessionId, humanIds[0]);
    const newerSocket = await lifecycle.connectSeat(sessionId, humanIds[0]);

    await lifecycle.dropSocket(olderSocket.socket);
    await wait(250);

    assert.strictEqual(session.getParticipantById(humanIds[0]).disconnected, false);
    assert.ok(lifecycle.sessionManager.getSession(sessionId), "session should still exist");
    assert.ok(
      !otherHuman.messages.some((message) => message.type === "kubic::participantDisconnected"),
      "no disconnect should be announced for a seat that still has a socket",
    );
    newerSocket.socket.close(1000);
  });

  test("a seat open in two tabs is still timed out when the older tab keeps heartbeating, then closes", async () => {
    const { sessionId, humanIds } = lifecycle.createSession({ humanCount: 2, computerCount: 0 });
    const otherHuman = await lifecycle.connectSeat(sessionId, humanIds[1]);
    const olderTab = await lifecycle.connectSeat(sessionId, humanIds[0]);
    const newerTab = await lifecycle.connectSeat(sessionId, humanIds[0]);

    await lifecycle.dropSocket(newerTab.socket);
    olderTab.socket.send(JSON.stringify({ type: "heartbeat" }));
    await lifecycle.dropSocket(olderTab.socket);

    await waitFor(() => otherHuman.messages.some((message) => message.type === "kubic::participantDisconnected"), 400);
  });

  test("the reconnection window removes the participant instead of throwing on the string id", async () => {
    const { sessionId, session, humanIds } = lifecycle.createSession({ humanCount: 2, computerCount: 1 });
    const stayingHuman = await lifecycle.connectSeat(sessionId, humanIds[1]);
    const leavingHuman = await lifecycle.connectSeat(sessionId, humanIds[0]);
    await lifecycle.dropSocket(leavingHuman.socket);

    await waitFor(() => stayingHuman.messages.some((message) => message.type === "kubic::participantRemoved"));

    assert.strictEqual(session.getParticipantById(humanIds[0]), null);
  });
});
