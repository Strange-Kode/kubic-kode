import { test, describe, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";

import { createWebSocketClient } from "./websocket-client.js";

/* A WebSocket double with browser semantics: starts CONNECTING, open() flips
   it to OPEN and fires onopen, close() moves to CLOSING. Close events are
   never fired by the double itself; tests deliver them explicitly, the way a
   browser dispatches them from a later task. */
class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.CONNECTING;
    this.closeCalls = [];
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    FakeWebSocket.instances.push(this);
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  close(code, reason) {
    this.closeCalls.push({ code, reason });
    this.readyState = FakeWebSocket.CLOSING;
  }

  send(data) {
    this.sent.push(data);
  }
}

function createHelper() {
  const emitted = [];
  return {
    sessionId: "session-1",
    participantId: "p1",
    config: { websocketPort: "", websocketPath: "/", autoReconnect: true },
    events: { emit(type, payload) { emitted.push({ type, payload }); } },
    emitted,
    websocket: null,
  };
}

const socketAt = (index) => FakeWebSocket.instances[index];
const countEmitted = (helper, type) => helper.emitted.filter((entry) => entry.type === type).length;

describe("websocket-client lifecycle", () => {
  let originalWebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    FakeWebSocket.instances = [];
    globalThis.WebSocket = FakeWebSocket;
    globalThis.window = { location: { protocol: "http:", hostname: "localhost" } };
    mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
    mock.method(Math, "random", () => 0);
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    globalThis.WebSocket = originalWebSocket;
    delete globalThis.window;
  });

  test("a replaced socket is closed with 1000, silenced, and never reconnects or reports a disconnect", () => {
    const helper = createHelper();
    const client = createWebSocketClient(helper);

    client.connect();
    const first = socketAt(0);
    first.open();
    client.connect();
    const second = socketAt(1);

    assert.strictEqual(helper.websocket, second);
    assert.deepStrictEqual(first.closeCalls, [{ code: 1000, reason: "Replaced" }]);
    assert.strictEqual(first.onclose, null);
    mock.timers.tick(60000);
    assert.strictEqual(FakeWebSocket.instances.length, 2);
    assert.strictEqual(second.closeCalls.length, 0);
    assert.strictEqual(countEmitted(helper, "websocketDisconnected"), 0);
  });

  test("an unexpected close reports one disconnect and reconnects once", () => {
    const helper = createHelper();
    const client = createWebSocketClient(helper);

    client.connect();
    socketAt(0).open();
    socketAt(0).onclose({ code: 1006 });

    assert.strictEqual(helper.websocket, null);
    assert.strictEqual(client.hasLiveSocket(), false);
    assert.strictEqual(countEmitted(helper, "websocketDisconnected"), 1);
    mock.timers.tick(1000);
    assert.strictEqual(FakeWebSocket.instances.length, 2);
    assert.strictEqual(helper.websocket, socketAt(1));
    mock.timers.tick(60000);
    assert.strictEqual(FakeWebSocket.instances.length, 2);
  });

  test("reconnect delay backs off while the server stays down and resets on open", () => {
    const helper = createHelper();
    const client = createWebSocketClient(helper);

    client.connect();
    socketAt(0).onclose({ code: 1006 });
    mock.timers.tick(999);
    assert.strictEqual(FakeWebSocket.instances.length, 1, "first retry waits the base delay");
    mock.timers.tick(1);
    assert.strictEqual(FakeWebSocket.instances.length, 2);

    socketAt(1).onclose({ code: 1006 });
    mock.timers.tick(1999);
    assert.strictEqual(FakeWebSocket.instances.length, 2, "second retry waits twice as long");
    mock.timers.tick(1);
    assert.strictEqual(FakeWebSocket.instances.length, 3);

    socketAt(2).open();
    socketAt(2).onclose({ code: 1006 });
    mock.timers.tick(1000);
    assert.strictEqual(FakeWebSocket.instances.length, 4, "a successful open resets the backoff");
  });

  test("connect() while a reconnect is pending cancels the timer, leaving one socket", () => {
    const helper = createHelper();
    const client = createWebSocketClient(helper);

    client.connect();
    socketAt(0).onclose({ code: 1006 });
    client.connect();
    assert.strictEqual(FakeWebSocket.instances.length, 2);
    mock.timers.tick(60000);
    assert.strictEqual(FakeWebSocket.instances.length, 2);
    assert.strictEqual(helper.websocket, socketAt(1));
  });

  test("the heartbeat follows the live socket: stops on replacement, restarts on open, stops on close", () => {
    const helper = createHelper();
    const client = createWebSocketClient(helper);

    client.connect();
    socketAt(0).open();
    mock.timers.tick(25000);
    assert.strictEqual(socketAt(0).sent.length, 1, "heartbeat ticks on the open socket");

    client.connect();
    mock.timers.tick(25000);
    assert.strictEqual(socketAt(0).sent.length, 1, "the replaced socket receives nothing more");
    assert.strictEqual(socketAt(1).sent.length, 0, "no heartbeat before the new socket opens");

    socketAt(1).open();
    mock.timers.tick(25000);
    assert.strictEqual(socketAt(1).sent.length, 1);

    socketAt(1).onclose({ code: 1006 });
    mock.timers.tick(25000);
    assert.strictEqual(socketAt(1).sent.length, 1, "no heartbeat after close");
  });

  test("disconnect closes with 1000, emits nothing, keeps autoReconnect, and the next session opens fresh", () => {
    const helper = createHelper();
    const client = createWebSocketClient(helper);

    client.connect();
    socketAt(0).open();
    client.disconnect();

    assert.strictEqual(helper.websocket, null);
    assert.strictEqual(helper.config.autoReconnect, true);
    assert.deepStrictEqual(socketAt(0).closeCalls, [{ code: 1000, reason: "Manual disconnect" }]);
    assert.strictEqual(countEmitted(helper, "websocketDisconnected"), 0);

    helper.sessionId = "session-2";
    client.connect();
    socketAt(1).open();
    const connectedEvents = helper.emitted.filter((entry) => entry.type === "websocketConnected");
    assert.deepStrictEqual(connectedEvents.at(-1).payload, { isReconnect: false });

    socketAt(1).onclose({ code: 1006 });
    mock.timers.tick(1000);
    assert.strictEqual(FakeWebSocket.instances.length, 3, "the new session still auto-reconnects");
  });

  test("disconnect cancels a pending reconnect", () => {
    const helper = createHelper();
    const client = createWebSocketClient(helper);

    client.connect();
    socketAt(0).onclose({ code: 1006 });
    client.disconnect();
    mock.timers.tick(60000);
    assert.strictEqual(FakeWebSocket.instances.length, 1);
  });

  test("the game token rides on the URL only when a participant is set", () => {
    const helper = createHelper();
    helper.gameToken = "tok=en&x";
    const client = createWebSocketClient(helper);

    client.connect();
    assert.strictEqual(new URL(socketAt(0).url).searchParams.get("gameToken"), "tok=en&x");

    helper.participantId = null;
    client.connect();
    assert.strictEqual(new URL(socketAt(1).url).searchParams.get("gameToken"), null);
  });

  test("a seat refused with 4401 reports a refusal, not a disconnect, and never reconnects", () => {
    const helper = createHelper();
    const client = createWebSocketClient(helper);

    client.connect();
    socketAt(0).onclose({ code: 4401, reason: "Game token is required" });

    assert.strictEqual(countEmitted(helper, "websocketRefused"), 1);
    assert.strictEqual(countEmitted(helper, "websocketDisconnected"), 0);
    mock.timers.tick(60000);
    assert.strictEqual(FakeWebSocket.instances.length, 1);
    assert.strictEqual(client.hasLiveSocket(), false);
  });

  test("session and participant ids are URL-encoded", () => {
    const helper = createHelper();
    helper.sessionId = "s&participantId=other";
    const client = createWebSocketClient(helper);

    client.connect();
    const url = new URL(socketAt(0).url);
    assert.strictEqual(url.searchParams.get("sessionId"), "s&participantId=other");
    assert.strictEqual(url.searchParams.get("participantId"), "p1");
  });
});
