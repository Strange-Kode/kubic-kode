import { test, describe } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";

process.env.KUBIC_GAME_TOKEN_SECRET_KEY ??= "test-secret-key-at-least-32-characters-long";

const { gameTokenService } = await import("./game-token-service.js");
const { resolveSeat } = await import("./game-token-middleware.js");

const SESSION_ID = "session-1";
const SEAT = 1;

const sessionManagerDouble = {
  getSession(id) {
    if (id !== SESSION_ID) return null;
    return { getParticipantById: (participantId) => (Number(participantId) === SEAT ? { id: SEAT } : null) };
  },
};

const tokenService = gameTokenService.instance;

describe("game token round trip", () => {
  test("a generated token validates to the session and seat it was issued for", () => {
    const token = tokenService.generateToken(SESSION_ID, SEAT);

    const tokenData = tokenService.validateToken(token);

    assert.strictEqual(tokenData.sessionId, SESSION_ID);
    assert.strictEqual(tokenData.participantId, SEAT);
  });

  test("two tokens for the same seat differ", () => {
    assert.notStrictEqual(tokenService.generateToken(SESSION_ID, SEAT), tokenService.generateToken(SESSION_ID, SEAT));
  });

  test("a token with any byte altered is rejected", () => {
    const token = tokenService.generateToken(SESSION_ID, SEAT);
    const tokenBytes = Buffer.from(token, "base64");

    for (let byteIndex = 0; byteIndex < tokenBytes.length; byteIndex++) {
      const tamperedBytes = Buffer.from(tokenBytes);
      tamperedBytes[byteIndex] ^= 0x01;
      assert.strictEqual(
        tokenService.validateToken(tamperedBytes.toString("base64")),
        null,
        `byte ${byteIndex} was altered but the token still validated`
      );
    }
  });

  test("a truncated token is rejected", () => {
    const token = tokenService.generateToken(SESSION_ID, SEAT);
    const tokenBytes = Buffer.from(token, "base64");

    assert.strictEqual(tokenService.validateToken(tokenBytes.subarray(0, tokenBytes.length - 1).toString("base64")), null);
    assert.strictEqual(tokenService.validateToken(tokenBytes.subarray(0, 10).toString("base64")), null);
    assert.strictEqual(tokenService.validateToken(""), null);
  });
});

describe("resolveSeat", () => {
  test("accepts the token for the seat it was issued for", () => {
    const token = tokenService.generateToken(SESSION_ID, SEAT);

    const seat = resolveSeat(sessionManagerDouble, SESSION_ID, SEAT, token);

    assert.strictEqual(seat.refusal, undefined);
    assert.strictEqual(seat.tokenData.participantId, SEAT);
  });

  test("refuses a token issued for another session", () => {
    const tokenForOtherSession = tokenService.generateToken("session-2", SEAT);

    const seat = resolveSeat(sessionManagerDouble, SESSION_ID, SEAT, tokenForOtherSession);

    assert.strictEqual(seat.refusal.status, 403);
    assert.strictEqual(seat.refusal.code, "TOKEN_SESSION_MISMATCH");
  });

  test("refuses a token issued for another seat", () => {
    const tokenForOtherSeat = tokenService.generateToken(SESSION_ID, 2);

    const seat = resolveSeat(sessionManagerDouble, SESSION_ID, SEAT, tokenForOtherSeat);

    assert.strictEqual(seat.refusal.status, 403);
    assert.strictEqual(seat.refusal.code, "TOKEN_PARTICIPANT_MISMATCH");
  });
});

describe("junk tokens", () => {
  const JUNK_TOKEN_COUNT = 2000;
  const BUDGET_MS = 1000;

  const cpuMilliseconds = () => {
    const { user, system } = process.cpuUsage();
    return (user + system) / 1000;
  };

  /* Validation runs on the event loop for every request, so junk long enough
     to reach the cipher must be rejected without per-token key derivation.
     Budgeted in CPU time so a loaded machine cannot flake it, and the loop
     stops at the budget so a slow implementation fails fast instead of
     hanging the suite. */
  test(`${JUNK_TOKEN_COUNT} long junk tokens are rejected within ${BUDGET_MS}ms of CPU`, () => {
    const junkTokens = Array.from({ length: JUNK_TOKEN_COUNT }, () => crypto.randomBytes(200).toString("base64"));
    const startedAt = cpuMilliseconds();

    let rejectedCount = 0;
    for (const junkToken of junkTokens) {
      assert.strictEqual(tokenService.validateToken(junkToken), null);
      rejectedCount++;
      if (cpuMilliseconds() - startedAt > BUDGET_MS) break;
    }

    assert.strictEqual(
      rejectedCount,
      JUNK_TOKEN_COUNT,
      `only ${rejectedCount} of ${JUNK_TOKEN_COUNT} junk tokens were rejected within ${BUDGET_MS}ms of CPU`
    );
  });

  test("a multi-megabyte junk token is rejected without decoding it", () => {
    const oversizedToken = crypto.randomBytes(6 * 1024 * 1024).toString("base64");
    const startedAt = cpuMilliseconds();

    assert.strictEqual(tokenService.validateToken(oversizedToken), null);

    const elapsedMilliseconds = cpuMilliseconds() - startedAt;
    assert.ok(elapsedMilliseconds < 20, `took ${elapsedMilliseconds}ms of CPU`);
  });

  test("a token that is not a string is rejected", () => {
    for (const notAString of [null, 42, ["token"], { token: "x" }]) {
      assert.strictEqual(tokenService.validateToken(notAString), null);
    }
  });
});
