import { gameTokenService } from "./game-token-service.js";
import { kubicLog } from "../kubic-log.js";

/**
 * The one answer to "may this token act as this seat in this session", shared
 * by the HTTP routes and the websocket handshake so both refuse the same
 * things for the same reasons. A seat claim (participantId given) is only
 * honoured by a token issued for that seat.
 * @param {Object} sessionManager
 * @param {string} sessionId
 * @param {string|number|null|undefined} participantId - The seat the caller claims, if any
 * @param {string|undefined} gameToken
 * @returns {{ status: number, message: string } | { tokenData: Object, gameSession: Object }}
 *   A refusal carrying the HTTP status and the response fields, or the resolved seat
 */
export function getSeatRefusal(sessionManager, sessionId, participantId, gameToken) {
  if (!gameToken) {
    return { status: 401, message: "Game token is required", code: "MISSING_GAME_TOKEN" };
  }

  const tokenData = gameTokenService.instance.validateToken(gameToken);
  if (!tokenData) {
    return { status: 401, message: "Invalid or expired game token", code: "INVALID_GAME_TOKEN" };
  }

  if (tokenData.sessionId !== sessionId) {
    return {
      status: 403,
      message: "Game token is not valid for this session",
      code: "TOKEN_SESSION_MISMATCH",
      tokenSessionId: tokenData.sessionId,
      requestSessionId: sessionId
    };
  }

  const gameSession = sessionManager.getSession(sessionId);
  if (!gameSession) {
    return { status: 404, message: "Game session not found", sessionId };
  }

  // URL params arrive as strings and JSON bodies as numbers
  const hasSeatClaim = participantId !== undefined && participantId !== null && participantId !== "";
  if (hasSeatClaim && String(tokenData.participantId) !== String(participantId)) {
    return {
      status: 403,
      message: "Game token is not valid for this participant",
      code: "TOKEN_PARTICIPANT_MISMATCH",
      tokenParticipantId: tokenData.participantId,
      requestParticipantId: participantId
    };
  }

  if (tokenData.participantId && !gameSession.getParticipantById(tokenData.participantId)) {
    return { status: 404, message: "Participant not found", participantId: tokenData.participantId };
  }

  return { tokenData, gameSession };
}

/**
 * Middleware to validate game tokens, with the seat check when the body names a participant.
 * Read-only game routes use this directly: a spectator's token passes.
 * @param {Object} sessionManager - The session manager instance
 * @returns {Function} Express middleware function
 */
export function validateGameToken(sessionManager) {
  return (req, res, next) => {
    // Only allow POST requests for game token validation
    if (req.method !== "POST") {
      return res.status(405).json({
        error: true,
        message: "Game token validation only allowed via POST requests",
        method: req.method
      });
    }

    const { gameToken, participantId } = req.body;
    const { sessionId } = req.params;

    const seat = getSeatRefusal(sessionManager, sessionId, participantId, gameToken);
    if (seat.status) {
      const { status, ...body } = seat;
      return res.status(status).json({ error: true, ...body });
    }

    // Attach token data and session to request for use in route handlers
    req.gameTokenData = seat.tokenData;
    req.gameSession = seat.gameSession;

    kubicLog.debug(`[GameTokenMiddleware] Validated game token for session: ${sessionId}, participant: ${seat.tokenData.participantId || "none"}`);
    next();
  };
}

export const validateGameTokenWithParticipantReadOnly = validateGameToken;

/**
 * Middleware for routes that change game state: the token's participant must also be playable.
 * @param {Object} sessionManager - The session manager instance
 * @returns {Function} Express middleware function
 */
export function validateGameTokenWithParticipant(sessionManager) {
  const basicValidation = validateGameToken(sessionManager);

  return (req, res, next) => {
    basicValidation(req, res, (err) => {
      if (err) {
        return next(err);
      }

      const { gameTokenData, gameSession } = req;
      if (gameTokenData.participantId) {
        const participant = gameSession.getParticipantById(gameTokenData.participantId);
        if (!gameSession.isParticipantPlayable(participant)) {
          return res.status(403).json({
            error: true,
            message: "This participant cannot perform game actions",
            participantId: gameTokenData.participantId
          });
        }
      }

      next();
    });
  };
}

/**
 * Middleware to ensure game tokens are only passed via POST requests
 * This is a lightweight check that can be used before other middleware
 * @returns {Function} Express middleware function
 */
export function requirePostForGameToken() {
  return (req, res, next) => {
    // Check if this route might contain game token validation
    const hasGameToken = req.body && req.body.gameToken;
    const isGameRoute = req.path.includes("/game/") || req.path.includes("/play-turn/");
    
    if (hasGameToken || isGameRoute) {
      if (req.method !== "POST") {
        return res.status(405).json({
          error: true,
          message: "Game token operations only allowed via POST requests",
          method: req.method,
          path: req.path
        });
      }
    }
    
    next();
  };
}
