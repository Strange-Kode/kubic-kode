/**
 * Session API routes factory
 * Handles all session-related HTTP endpoints
 **/
export function createSessionRoutes(helper) {
  return async (action, data = {}) => {
    switch (action) {
      case "init":
        // GET /session/init/:gameId
        // Also supports: POST /session/init/:gameId with {forceNew, ...options}
        return await helper._makeRequest(
          "GET",
          `/session/init/${helper.currentGame}`
        );

      case "join":
        // POST /session/:sessionId/join
        // Requires: { participantName, participantType? }
        // Returns: { success, participant_id, game_token }
        const joinResult = await helper._makeRequest(
          "POST",
          `/session/${helper.sessionId}/join`,
          data
        );
        // Store game token in localStorage when joining
        if (joinResult.success && joinResult.data.game_token) {
          helper.gameToken = joinResult.data.game_token;
          helper._storeGameToken(
            helper.sessionId,
            joinResult.data.participant_id,
            joinResult.data.game_token
          );
        }
        return joinResult;

      case "spectate":
        // POST /session/:sessionId/spectate
        // Requires: { participantName }
        // Returns: { success, participant_id, game_token }
        const spectateResult = await helper._makeRequest(
          "POST",
          `/session/${helper.sessionId}/spectate`,
          data
        );
        // Store game token in localStorage when spectating
        if (spectateResult.success && spectateResult.data.game_token) {
          helper.gameToken = spectateResult.data.game_token;
          helper._storeGameToken(
            helper.sessionId,
            spectateResult.data.participant_id,
            spectateResult.data.game_token
          );
        }
        return spectateResult;

      case "leave":
        // POST /session/:sessionId/leave
        // Requires: { participantId }
        // Returns: { success }
        const leaveResult = await helper._makeRequest(
          "POST",
          `/session/${helper.sessionId}/leave`,
          data
        );
        // Clear game token from localStorage when leaving
        if (leaveResult.success) {
          helper._clearGameToken(helper.sessionId, helper.participantId);
          helper.gameToken = null;
        }
        return leaveResult;

      case "participants":
        // GET /session/:sessionId/participants/list
        // Returns: Array of participant objects
        return await helper._makeRequest(
          "GET",
          `/session/${helper.sessionId}/participants/list`
        );

      case "participant-stats":
        // GET /session/:sessionId/participants/stats
        // Returns: { sessionId, maxPlayers, total, players, spectators, canStart, started }
        return await helper._makeRequest(
          "GET",
          `/session/${helper.sessionId}/participants/stats`
        );

      case "restart-vote":
        // GET /session/:sessionId/request-restart-vote
        // Returns: { vote_inited }
        return await helper._makeRequest(
          "GET",
          `/session/${helper.sessionId}/request-restart-vote`
        );

      case "submit-vote":
        // POST /session/:sessionId/submit-restart-vote
        // Requires: { participantId, voteYes }
        // Returns: { success }
        return await helper._makeRequest(
          "POST",
          `/session/${helper.sessionId}/submit-restart-vote`,
          data
        );

      case "history":
        // POST /session/:sessionId/history
        // Accepts: { type?, startTime?, endTime?, ... } - optional filters
        // Returns: { success, sessionId, totalEvents, history }
        return await helper._makeRequest(
          "POST",
          `/session/${helper.sessionId}/history`,
          data
        );

      default:
        const KubicClientError = helper.KubicClientError || Error;
        throw new KubicClientError(
          `Unknown session action: ${action}`,
          "UNKNOWN_SESSION_ACTION",
          {
            action,
            availableActions: [
              "init",
              "join",
              "spectate",
              "leave",
              "participants",
              "participant-stats",
              "restart-vote",
              "submit-vote",
              "history",
            ],
          }
        );
    }
  };
}
