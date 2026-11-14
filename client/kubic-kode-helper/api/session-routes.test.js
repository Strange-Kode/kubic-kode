import { test, describe } from "node:test";
import assert from "node:assert";

import { createSessionRoutes } from "./session-routes.js";

const SESSION_ID = "session-1";
const OWN_SEAT = "1";
const AI_SEAT = "2";

const createHelper = ({ storedTokens = {}, gameToken = "fallback-token" } = {}) => {
  const requests = [];
  return {
    sessionId: SESSION_ID,
    participantId: OWN_SEAT,
    gameToken,
    requests,
    _makeRequest: async (method, endpoint, body) => {
      requests.push({ method, endpoint, body });
      return { success: true, data: {} };
    },
    _getGameToken: (sessionId, seatId) => storedTokens[sessionId]?.[seatId] ?? null,
    _clearGameToken: () => {},
  };
};

const storedTokens = { [SESSION_ID]: { [OWN_SEAT]: "token-for-own-seat", [AI_SEAT]: "token-for-ai-seat" } };

const actingAsOwnSeat = [
  { action: "set-config", data: { config: { gridSize: 4 } }, method: "POST", endpoint: `/session/${SESSION_ID}/config` },
  { action: "delete-config", data: { configKey: "gridSize" }, method: "DELETE", endpoint: `/session/${SESSION_ID}/config/gridSize` },
  { action: "kick", data: { participantIdToKick: AI_SEAT }, method: "POST", endpoint: `/session/${SESSION_ID}/kick` },
  { action: "transfer-host", data: { newHostId: AI_SEAT }, method: "POST", endpoint: `/session/${SESSION_ID}/transfer-host` },
  { action: "send-chat", data: { message: "hi" }, method: "POST", endpoint: `/session/${SESSION_ID}/chat` },
  { action: "restart-vote", data: {}, method: "POST", endpoint: `/session/${SESSION_ID}/request-restart-vote` },
  { action: "subscribe", data: { eventTypes: ["turnPlayed"] }, method: "POST", endpoint: `/session/${SESSION_ID}/subscribe` },
  { action: "unsubscribe", data: { eventTypes: ["turnPlayed"] }, method: "POST", endpoint: `/session/${SESSION_ID}/unsubscribe` },
];

const actingAsNamedSeat = [
  { action: "leave", endpoint: `/session/${SESSION_ID}/leave`, data: (seatId) => ({ participantId: seatId }) },
  { action: "submit-vote", endpoint: `/session/${SESSION_ID}/submit-restart-vote`, data: (seatId) => ({ participantId: seatId, voteYes: true }) },
];

describe("session routes attach the seat's game token", () => {
  for (const { action, data, method, endpoint } of actingAsOwnSeat) {
    test(`${action} sends the token stored for the helper's seat`, async () => {
      const helper = createHelper({ storedTokens });

      await createSessionRoutes(helper)(action, data);

      assert.strictEqual(helper.requests.length, 1);
      assert.strictEqual(helper.requests[0].method, method);
      assert.strictEqual(helper.requests[0].endpoint, endpoint);
      assert.strictEqual(helper.requests[0].body.gameToken, "token-for-own-seat");
    });

    test(`${action} falls back to the current token when none is stored for the seat`, async () => {
      const helper = createHelper();

      await createSessionRoutes(helper)(action, data);

      assert.strictEqual(helper.requests[0].body.gameToken, "fallback-token");
    });
  }

  for (const { action, endpoint, data } of actingAsNamedSeat) {
    test(`${action} sends the token stored for the seat the body names, not the helper's`, async () => {
      const helper = createHelper({ storedTokens });

      await createSessionRoutes(helper)(action, data(AI_SEAT));

      assert.strictEqual(helper.requests[0].endpoint, endpoint);
      assert.strictEqual(helper.requests[0].body.participantId, AI_SEAT);
      assert.strictEqual(helper.requests[0].body.gameToken, "token-for-ai-seat");
    });

    test(`${action} falls back to the current token when none is stored for the seat`, async () => {
      const helper = createHelper();

      await createSessionRoutes(helper)(action, data(OWN_SEAT));

      assert.strictEqual(helper.requests[0].body.gameToken, "fallback-token");
    });
  }

  test("kick and transfer-host name the helper's seat as the acting seat", async () => {
    const helper = createHelper({ storedTokens });
    const routes = createSessionRoutes(helper);

    await routes("kick", { participantIdToKick: AI_SEAT });
    await routes("transfer-host", { newHostId: AI_SEAT });

    assert.strictEqual(helper.requests[0].body.hostId, OWN_SEAT);
    assert.strictEqual(helper.requests[1].body.currentHostId, OWN_SEAT);
  });
});
