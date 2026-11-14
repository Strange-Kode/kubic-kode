import { test, describe, before, after } from "node:test";
import assert from "node:assert";
import http from "node:http";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

import express from "express";

process.env.KUBIC_GAME_TOKEN_SECRET_KEY ??= "test-secret-key-at-least-32-characters-long";

const { default: sessionRouter } = await import("./session-routes.js");
const { gameRegistry } = await import("../game-registry.js");
const { registry } = await import("../../game-module/module-system/index.js");
const { TicTacToeGame } = await import("../../client/demos/backend-tic-tac-toe/tic-tac-toe.js");

const GAME_ID = "session-routes-test-game";
const MODULES_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../game-module/modules");

let server;
let baseUrl;

before(async () => {
  gameRegistry.register(GAME_ID, () => new TicTacToeGame());
  await registry.initRegistry(MODULES_PATH, { watch: false });

  const app = express();
  app.use(express.json());
  app.use("/api", sessionRouter);
  server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await once(server, "close");
});

const call = async (method, route, body) => {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsedBody = null;
  try {
    parsedBody = JSON.parse(text);
  } catch {
    parsedBody = text;
  }
  return { status: response.status, body: parsedBody };
};

const joinSeat = async (sessionId, participantName, route = "join") => {
  const { body } = await call("POST", `/api/session/${sessionId}/${route}`, { participantName });
  return { id: body.participant_id, token: body.game_token };
};

/* The first joiner is the host */
const createLobby = async () => {
  const { body } = await call("POST", `/api/session/init/${GAME_ID}`, { forceNew: true });
  const sessionId = body.session_id;
  const host = await joinSeat(sessionId, "Alice");
  const guest = await joinSeat(sessionId, "Bob");
  return { sessionId, host, guest };
};

const snapshot = async ({ sessionId }) => {
  const participants = await call("GET", `/api/session/${sessionId}/participants/list`);
  const lobby = await call("GET", `/api/session/${sessionId}/lobby`);
  const chat = await call("GET", `/api/session/${sessionId}/chat`);
  const config = await call("GET", `/api/session/${sessionId}/config`);
  return {
    participantIds: participants.body.map((participant) => participant.id),
    hostId: lobby.body.lobby.host.id,
    chatMessageCount: chat.body.total_messages,
    config: config.body.config,
  };
};

/* One entry per route that acts as a seat. `seatField` is the body field that
   names the acting seat, `requestBody(lobby, seat)` builds the body with that
   seat named, and `actor` is who legitimately makes the call. */
const seatRoutes = [
  {
    name: "leave",
    method: "POST",
    route: (lobby) => `/api/session/${lobby.sessionId}/leave`,
    seatField: "participantId",
    actor: "guest",
    requestBody: (lobby, seat) => ({ participantId: seat.id }),
    async assertEffect(lobby) {
      const state = await snapshot(lobby);
      assert.deepStrictEqual(state.participantIds, [lobby.host.id]);
    },
  },
  {
    name: "kick",
    method: "POST",
    route: (lobby) => `/api/session/${lobby.sessionId}/kick`,
    seatField: "hostId",
    actor: "host",
    requestBody: (lobby, seat) => ({ hostId: seat.id, participantIdToKick: lobby.guest.id }),
    async assertEffect(lobby) {
      const state = await snapshot(lobby);
      assert.deepStrictEqual(state.participantIds, [lobby.host.id]);
    },
  },
  {
    name: "transfer-host",
    method: "POST",
    route: (lobby) => `/api/session/${lobby.sessionId}/transfer-host`,
    seatField: "currentHostId",
    actor: "host",
    requestBody: (lobby, seat) => ({ currentHostId: seat.id, newHostId: lobby.guest.id }),
    async assertEffect(lobby) {
      const state = await snapshot(lobby);
      assert.strictEqual(state.hostId, lobby.guest.id);
    },
  },
  {
    name: "chat",
    method: "POST",
    route: (lobby) => `/api/session/${lobby.sessionId}/chat`,
    seatField: "participantId",
    actor: "guest",
    requestBody: (lobby, seat) => ({ participantId: seat.id, message: "hello there" }),
    async assertEffect(lobby, response) {
      assert.strictEqual(response.body.success, true);
      const chat = await call("GET", `/api/session/${lobby.sessionId}/chat`);
      assert.ok(chat.body.messages.some((message) => message.message === "hello there"));
    },
  },
  {
    name: "set config",
    method: "POST",
    route: (lobby) => `/api/session/${lobby.sessionId}/config`,
    seatField: "participantId",
    actor: "host",
    requestBody: (lobby, seat) => ({ participantId: seat.id, config: { customRule: "fast" } }),
    async assertEffect(lobby) {
      const state = await snapshot(lobby);
      assert.strictEqual(state.config.customRule, "fast");
    },
  },
  {
    name: "delete config",
    method: "DELETE",
    route: (lobby) => `/api/session/${lobby.sessionId}/config/customRule`,
    seatField: "participantId",
    actor: "host",
    async prepare(lobby) {
      await call("POST", `/api/session/${lobby.sessionId}/config`, {
        participantId: lobby.host.id,
        gameToken: lobby.host.token,
        config: { customRule: "fast" },
      });
    },
    requestBody: (lobby, seat) => ({ participantId: seat.id }),
    async assertEffect(lobby) {
      const state = await snapshot(lobby);
      assert.strictEqual(state.config.customRule, undefined);
    },
  },
  {
    name: "submit-restart-vote",
    method: "POST",
    route: (lobby) => `/api/session/${lobby.sessionId}/submit-restart-vote`,
    seatField: "participantId",
    actor: "guest",
    async prepare(lobby) {
      await call("POST", `/api/session/${lobby.sessionId}/request-restart-vote`, {
        participantId: lobby.host.id,
        gameToken: lobby.host.token,
      });
    },
    requestBody: (lobby, seat) => ({ participantId: seat.id, voteYes: true }),
    async assertEffect(lobby, response) {
      assert.deepStrictEqual(response.body, { success: true });
    },
  },
  {
    name: "request-restart-vote",
    method: "POST",
    route: (lobby) => `/api/session/${lobby.sessionId}/request-restart-vote`,
    seatField: "participantId",
    actor: "guest",
    requestBody: (lobby, seat) => ({ participantId: seat.id }),
    async assertEffect(lobby, response) {
      assert.deepStrictEqual(response.body, { vote_inited: true });
    },
  },
  {
    name: "heartbeat",
    method: "POST",
    route: (lobby) => `/api/session/${lobby.sessionId}/heartbeat`,
    seatField: "participantId",
    actor: "guest",
    requestBody: (lobby, seat) => ({ participantId: seat.id }),
    async assertEffect(lobby, response, actor) {
      assert.strictEqual(response.body.success, true);
      assert.strictEqual(response.body.participant_id, actor.id);
    },
  },
];

describe("routes that act as a seat", () => {
  for (const seatRoute of seatRoutes) {
    describe(seatRoute.name, () => {
      test("the seat's own token is accepted", async () => {
        const lobby = await createLobby();
        await seatRoute.prepare?.(lobby);
        const actor = lobby[seatRoute.actor];

        const response = await call(seatRoute.method, seatRoute.route(lobby), {
          ...seatRoute.requestBody(lobby, actor),
          gameToken: actor.token,
        });

        assert.strictEqual(response.status, 200, JSON.stringify(response.body));
        await seatRoute.assertEffect(lobby, response, actor);
      });

      test("another seat's token naming the actor is refused", async () => {
        const lobby = await createLobby();
        await seatRoute.prepare?.(lobby);
        const victim = lobby[seatRoute.actor];
        const attacker = seatRoute.actor === "host" ? lobby.guest : lobby.host;

        const response = await call(seatRoute.method, seatRoute.route(lobby), {
          ...seatRoute.requestBody(lobby, victim),
          gameToken: attacker.token,
        });

        assert.strictEqual(response.status, 403, JSON.stringify(response.body));
        assert.strictEqual(response.body.code, "TOKEN_PARTICIPANT_MISMATCH");
      });

      test("a body without a token is refused with 401", async () => {
        const lobby = await createLobby();
        await seatRoute.prepare?.(lobby);

        const response = await call(
          seatRoute.method,
          seatRoute.route(lobby),
          seatRoute.requestBody(lobby, lobby[seatRoute.actor])
        );

        assert.strictEqual(response.status, 401, JSON.stringify(response.body));
        assert.strictEqual(response.body.code, "MISSING_GAME_TOKEN");
      });

      test("a junk token is refused with 401", async () => {
        const lobby = await createLobby();
        await seatRoute.prepare?.(lobby);

        const response = await call(seatRoute.method, seatRoute.route(lobby), {
          ...seatRoute.requestBody(lobby, lobby[seatRoute.actor]),
          gameToken: "not-a-game-token",
        });

        assert.strictEqual(response.status, 401, JSON.stringify(response.body));
        assert.strictEqual(response.body.code, "INVALID_GAME_TOKEN");
      });

      test("a token from another session is refused", async () => {
        const lobby = await createLobby();
        const otherLobby = await createLobby();
        await seatRoute.prepare?.(lobby);

        const response = await call(seatRoute.method, seatRoute.route(lobby), {
          ...seatRoute.requestBody(lobby, lobby[seatRoute.actor]),
          gameToken: otherLobby[seatRoute.actor].token,
        });

        assert.strictEqual(response.status, 403, JSON.stringify(response.body));
        assert.strictEqual(response.body.code, "TOKEN_SESSION_MISMATCH");
      });

      test(`a body without ${seatRoute.seatField} is refused with 400`, async () => {
        const lobby = await createLobby();
        await seatRoute.prepare?.(lobby);
        const actor = lobby[seatRoute.actor];
        const bodyWithoutSeat = seatRoute.requestBody(lobby, actor);
        delete bodyWithoutSeat[seatRoute.seatField];

        const response = await call(seatRoute.method, seatRoute.route(lobby), {
          ...bodyWithoutSeat,
          gameToken: actor.token,
        });

        assert.strictEqual(response.status, 400, JSON.stringify(response.body));
        assert.strictEqual(response.body.code, "MISSING_PARTICIPANT_ID");
        assert.ok(response.body.message.includes(seatRoute.seatField));
      });
    });
  }

  test("forged requests as another seat change nothing", async () => {
    const lobby = await createLobby();
    await call("POST", `/api/session/${lobby.sessionId}/request-restart-vote`, {
      participantId: lobby.host.id,
      gameToken: lobby.host.token,
    });
    const before = await snapshot(lobby);

    for (const seatRoute of seatRoutes) {
      const victim = lobby[seatRoute.actor];
      const attacker = seatRoute.actor === "host" ? lobby.guest : lobby.host;
      await call(seatRoute.method, seatRoute.route(lobby), {
        ...seatRoute.requestBody(lobby, victim),
        gameToken: attacker.token,
      });
    }

    assert.deepStrictEqual(await snapshot(lobby), before);
  });
});

describe("subscribe and unsubscribe", () => {
  for (const action of ["subscribe", "unsubscribe"]) {
    describe(action, () => {
      test("any seat's token for the session is accepted without naming a seat", async () => {
        const lobby = await createLobby();

        const response = await call("POST", `/api/session/${lobby.sessionId}/${action}`, {
          gameToken: lobby.guest.token,
          eventTypes: ["turnPlayed"],
        });

        assert.strictEqual(response.status, 200, JSON.stringify(response.body));
        assert.strictEqual(response.body.success, true);
      });

      test("a spectator's token is accepted", async () => {
        const lobby = await createLobby();
        const spectator = await joinSeat(lobby.sessionId, "Watcher", "spectate");

        const response = await call("POST", `/api/session/${lobby.sessionId}/${action}`, {
          gameToken: spectator.token,
          eventTypes: ["turnPlayed"],
        });

        assert.strictEqual(response.status, 200, JSON.stringify(response.body));
      });

      test("a body without a token is refused with 401", async () => {
        const lobby = await createLobby();

        const response = await call("POST", `/api/session/${lobby.sessionId}/${action}`, {
          eventTypes: ["turnPlayed"],
        });

        assert.strictEqual(response.status, 401, JSON.stringify(response.body));
        assert.strictEqual(response.body.code, "MISSING_GAME_TOKEN");
      });

      test("a token from another session is refused", async () => {
        const lobby = await createLobby();
        const otherLobby = await createLobby();

        const response = await call("POST", `/api/session/${lobby.sessionId}/${action}`, {
          gameToken: otherLobby.guest.token,
          eventTypes: ["turnPlayed"],
        });

        assert.strictEqual(response.status, 403, JSON.stringify(response.body));
        assert.strictEqual(response.body.code, "TOKEN_SESSION_MISMATCH");
      });
    });
  }
});

describe("routes the client never calls", () => {
  for (const removedRoute of ["disconnect", "sync/start", "ready"]) {
    test(`POST /session/:id/${removedRoute} does not exist`, async () => {
      const lobby = await createLobby();

      const response = await call("POST", `/api/session/${lobby.sessionId}/${removedRoute}`, {
        participantId: lobby.host.id,
        gameToken: lobby.host.token,
        ready: true,
      });

      assert.strictEqual(response.status, 404);
    });
  }

  test("GET /session/:id/request-restart-vote no longer starts a vote", async () => {
    const lobby = await createLobby();

    const response = await call("GET", `/api/session/${lobby.sessionId}/request-restart-vote`);

    assert.strictEqual(response.status, 404);
  });

  test("GET /session/:id/ready still answers", async () => {
    const lobby = await createLobby();

    const response = await call("GET", `/api/session/${lobby.sessionId}/ready`);

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
  });
});
