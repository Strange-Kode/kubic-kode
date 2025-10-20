/**
 * Game API routes factory
 * Handles all game-related HTTP endpoints
 *
 * Backend validation status: ✅ All routes validated against game-server/route/game-routes.js
 * Note: All game routes use POST method with game token validation
 */
export function createGameRoutes(helper) {
  return async (action, data = {}) => {
    if (!helper.sessionId) {
      const KubicClientError = helper.KubicClientError || Error;
      throw new KubicClientError(
        "No active session. Call session.init() first.",
        "NO_ACTIVE_SESSION",
        { suggestion: "Call KubicKode.session.init() to create a session" }
      );
    }

    // Always refresh game token from localStorage to ensure it's current
    helper.gameToken = helper._getGameToken(
      helper.sessionId,
      helper.participantId
    );
    if (!helper.gameToken) {
      const KubicClientError = helper.KubicClientError || Error;
      throw new KubicClientError(
        "No game token available. Join or spectate session first.",
        "NO_GAME_TOKEN",
        {
          sessionId: helper.sessionId,
          participantId: helper.participantId,
          suggestion:
            "Call KubicKode.session.join() or KubicKode.session.spectate() first",
        }
      );
    }

    switch (action) {
      case "start":
        // POST /game/:sessionId/start
        // Requires: { participantId, gameToken, ...options }
        // Returns: { game_started, current_player_id(s), status, ... }
        return await helper._makeRequest(
          "POST",
          `/game/${helper.sessionId}/start`,
          {
            ...data,
            participantId: helper.participantId,
            gameToken: helper.gameToken,
          }
        );

      case "stop":
        // POST /game/:sessionId/stop
        // Requires: { participantId, gameToken }
        // Returns: { game_stopped }
        return await helper._makeRequest(
          "POST",
          `/game/${helper.sessionId}/stop`,
          {
            participantId: helper.participantId,
            gameToken: helper.gameToken,
          }
        );

      case "get-current-player":
        // POST /game/:sessionId/get-current-player
        // Requires: { gameToken }
        // Returns: { current_player_id } or { current_player_ids }
        return await helper._makeRequest(
          "POST",
          `/game/${helper.sessionId}/get-current-player`,
          {
            gameToken: helper.gameToken,
          }
        );

      case "is-active":
        // POST /game/:sessionId/is-active
        // Requires: { gameToken }
        // Returns: { is_active }
        return await helper._makeRequest(
          "POST",
          `/game/${helper.sessionId}/is-active`,
          {
            gameToken: helper.gameToken,
          }
        );

      case "get-tilemap":
        // POST /game/:sessionId/get-tilemap
        // Requires: { gameToken }
        // Returns: Serialized tilemap object
        return await helper._makeRequest(
          "POST",
          `/game/${helper.sessionId}/get-tilemap`,
          {
            gameToken: helper.gameToken,
          }
        );

      case "options":
        // POST /game/:sessionId/options
        // Requires: { gameToken }
        // Returns: { available, options, metadata, lifecycle, modifiable, game_state, debug }
        return await helper._makeRequest(
          "POST",
          `/game/${helper.sessionId}/options`,
          {
            gameToken: helper.gameToken,
          }
        );

      case "get-player-mappings":
        // POST /game/:sessionId/get-player-mappings
        // Requires: { gameToken }
        // Returns: { player_mappings } - participantId -> playerId mapping
        return await helper._makeRequest(
          "POST",
          `/game/${helper.sessionId}/get-player-mappings`,
          {
            gameToken: helper.gameToken,
          }
        );

      case "play-turn":
        // POST /game/:sessionId/play-turn
        // Requires: { participantId, gameToken, ...moveData }
        // moveData typically includes: { xPos, yPos, action?, ... }
        // Returns: PlayStatus object with game state
        return await helper._makeRequest(
          "POST",
          `/game/${helper.sessionId}/play-turn`,
          {
            participantId: helper.participantId,
            gameToken: helper.gameToken,
            ...data,
          }
        );

      default:
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          `Unknown game action: ${action}`,
          "UNKNOWN_GAME_ACTION",
          {
            action,
            availableActions: [
              "start",
              "stop",
              "get-current-player",
              "is-active",
              "get-tilemap",
              "options",
              "get-player-mappings",
              "play-turn",
            ],
          }
        );
    }
  };
}
