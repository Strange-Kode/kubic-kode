import { gameTokenService } from "./game-token-service.js";
import { kubicLog } from "../kubic-log.js";

/**
 * Middleware to validate game tokens
 * Ensures that game tokens are only passed via POST requests and are valid
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

    const { gameToken } = req.body;
    const { sessionId } = req.params;

    // Check if game token is provided
    if (!gameToken) {
      return res.status(401).json({
        error: true,
        message: "Game token is required",
        code: "MISSING_GAME_TOKEN"
      });
    }

    // Validate the game token
    const tokenData = gameTokenService.instance.validateToken(gameToken);
    if (!tokenData) {
      return res.status(401).json({
        error: true,
        message: "Invalid or expired game token",
        code: "INVALID_GAME_TOKEN"
      });
    }

    // Check if token is for the correct session
    if (tokenData.sessionId !== sessionId) {
      return res.status(403).json({
        error: true,
        message: "Game token is not valid for this session",
        code: "TOKEN_SESSION_MISMATCH",
        tokenSessionId: tokenData.sessionId,
        requestSessionId: sessionId
      });
    }

    // Verify that the session exists
    const gameSession = sessionManager.getSession(sessionId);
    if (!gameSession) {
      return res.status(404).json({
        error: true,
        message: "Game session not found",
        sessionId: sessionId
      });
    }

    // Attach token data and session to request for use in route handlers
    req.gameTokenData = tokenData;
    req.gameSession = gameSession;

    kubicLog.debug(`[GameTokenMiddleware] Validated game token for session: ${sessionId}, participant: ${tokenData.participantId || "none"}`);
    next();
  };
}

/**
 * Middleware to validate game tokens with participant-specific validation
 * Ensures that the token is valid for a specific participant
 * @param {Object} sessionManager - The session manager instance
 * @returns {Function} Express middleware function
 */
export function validateGameTokenWithParticipant(sessionManager) {
  return (req, res, next) => {
    // First validate the basic game token
    const basicValidation = validateGameToken(sessionManager);
    
    basicValidation(req, res, (err) => {
      if (err) {
        return next(err);
      }

      const { participantId } = req.body;
      const { gameTokenData } = req;

      // If participantId is provided in the request, validate it matches the token
      if (participantId && gameTokenData.participantId && gameTokenData.participantId !== participantId) {
        return res.status(403).json({
          error: true,
          message: "Game token is not valid for this participant",
          code: "TOKEN_PARTICIPANT_MISMATCH",
          tokenParticipantId: gameTokenData.participantId,
          requestParticipantId: participantId
        });
      }

      // If token has a participantId, validate that the participant exists and is playable
      if (gameTokenData.participantId) {
        const participant = req.gameSession.getParticipantById(gameTokenData.participantId);
        if (!participant) {
          return res.status(404).json({
            error: true,
            message: "Participant not found",
            participantId: gameTokenData.participantId
          });
        }

        if (!req.gameSession.isParticipantPlayable(participant)) {
          return res.status(403).json({
            error: true,
            message: "This participant cannot perform game actions",
            participantId: gameTokenData.participantId
          });
        }
      }

      kubicLog.debug(`[GameTokenMiddleware] Validated participant-specific game token for session: ${req.params.sessionId}, participant: ${gameTokenData.participantId}`);
      next();
    });
  };
}

/**
 * Middleware to validate game tokens with participant-specific validation for read-only endpoints
 * Allows spectators to access read-only game information
 * @param {Object} sessionManager - The session manager instance
 * @returns {Function} Express middleware function
 */
export function validateGameTokenWithParticipantReadOnly(sessionManager) {
  return (req, res, next) => {
    // First validate the basic game token
    const basicValidation = validateGameToken(sessionManager);
    
    basicValidation(req, res, (err) => {
      if (err) {
        return next(err);
      }

      const { participantId } = req.body;
      const { gameTokenData } = req;

      // If participantId is provided in the request, validate it matches the token
      if (participantId && gameTokenData.participantId && gameTokenData.participantId !== participantId) {
        return res.status(403).json({
          error: true,
          message: "Game token is not valid for this participant",
          code: "TOKEN_PARTICIPANT_MISMATCH",
          tokenParticipantId: gameTokenData.participantId,
          requestParticipantId: participantId
        });
      }

      // If token has a participantId, validate that the participant exists (but don't check if playable)
      if (gameTokenData.participantId) {
        const participant = req.gameSession.getParticipantById(gameTokenData.participantId);
        if (!participant) {
          return res.status(404).json({
            error: true,
            message: "Participant not found",
            participantId: gameTokenData.participantId
          });
        }
      }

      kubicLog.debug(`[GameTokenMiddleware] Validated read-only game token for session: ${req.params.sessionId}, participant: ${gameTokenData.participantId}`);
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
