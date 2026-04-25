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
          // Only update helper.gameToken for human participants, not AI/computer
          // AI tokens should be stored in localStorage but not overwrite the current user's token
          if (data.participantType !== "computer") {
            helper.gameToken = joinResult.data.game_token;
          }
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

      case "list-all":
        // GET /sessions/list
        // Returns: { success, sessions, total_sessions }
        return await helper._makeRequest("GET", "/sessions/list");

      case "list-joinable":
        // GET /sessions/list?onlyJoinable=true
        // Returns only joinable sessions (filters private games, spectators can join full games)
        // Returns: { success, sessions, total_sessions, only_joinable }
        return await helper._makeRequest("GET", "/sessions/list?onlyJoinable=true");

      case "list-by-game":
        // GET /sessions/game/:gameId?onlyJoinable=true
        // Requires: data.gameId
        // Optional: data.onlyJoinable (default: true)
        // Returns: { success, sessions, total_sessions, game_variant_id, only_joinable }
        const onlyJoinable = data.onlyJoinable !== false;
        const queryParams = onlyJoinable ? "?onlyJoinable=true" : "";
        return await helper._makeRequest(
          "GET",
          `/sessions/game/${data.gameId}${queryParams}`
        );

      case "auto-join":
        // POST /sessions/auto-join/:gameId
        // Requires: data.gameId, data.participantName
        // Optional: data.participantType, data.createIfNone
        // Returns: { success, session_id, participant_id, session_created, lobby_status, game_token }
        const autoJoinResult = await helper._makeRequest(
          "POST",
          `/sessions/auto-join/${data.gameId}`,
          {
            participantName: data.participantName,
            participantType: data.participantType || "user",
            createIfNone: data.createIfNone !== false,
          }
        );
        // Store game token if provided
        if (autoJoinResult.success && autoJoinResult.data.game_token) {
          helper.gameToken = autoJoinResult.data.game_token;
          helper._storeGameToken(
            autoJoinResult.data.session_id,
            autoJoinResult.data.participant_id,
            autoJoinResult.data.game_token
          );
        }
        return autoJoinResult;

      case "lobby-status":
        // GET /session/lobby/:sessionId
        // Requires: data.sessionId (or uses helper.sessionId)
        // Returns: { success, lobby }
        const sessionIdForLobby = data.sessionId || helper.sessionId;
        return await helper._makeRequest(
          "GET",
          `/session/lobby/${sessionIdForLobby}`
        );

      case "set-config":
        // POST /session/:sessionId/config
        // Requires: { config } (participantId automatically added)
        // Returns: { success, applied_config, changes, full_config }
        if (!helper.sessionId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No active session",
            "NO_ACTIVE_SESSION",
            { suggestion: "Initialize and join a session first" }
          );
        }
        if (!helper.participantId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No participant ID",
            "NO_PARTICIPANT_ID",
            { suggestion: "Join a session first" }
          );
        }
        return await helper._makeRequest(
          "POST",
          `/session/${helper.sessionId}/config`,
          {
            participantId: helper.participantId,
            config: data.config,
          }
        );

      case "get-config":
        // GET /session/:sessionId/config
        // Returns: { success, session_id, config, host }
        if (!helper.sessionId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No active session",
            "NO_ACTIVE_SESSION",
            { suggestion: "Initialize a session first" }
          );
        }
        return await helper._makeRequest(
          "GET",
          `/session/${helper.sessionId}/config`
        );

      case "delete-config":
        // DELETE /session/:sessionId/config/:configKey
        // Requires: { configKey }
        // Returns: { success, deleted_key, old_value, remaining_config }
        if (!helper.sessionId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No active session",
            "NO_ACTIVE_SESSION",
            { suggestion: "Initialize a session first" }
          );
        }
        if (!helper.participantId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No participant ID",
            "NO_PARTICIPANT_ID",
            { suggestion: "Join a session first" }
          );
        }
        if (!data.configKey) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "configKey is required",
            "CONFIG_KEY_REQUIRED",
            { suggestion: "Provide a config key to delete" }
          );
        }
        return await helper._makeRequest(
          "DELETE",
          `/session/${helper.sessionId}/config/${data.configKey}`,
          {
            participantId: helper.participantId,
          }
        );

      case "subscribe":
        // POST /session/:sessionId/subscribe
        // Requires: { eventTypes: string[] } - game history event types to subscribe to
        // Returns: { success, subscribed, current_subscriptions }
        // Note: server silently drops unrecognised event-type strings (only logs a warning),
        // so we validate entries are strings here to surface caller mistakes early.
        if (!helper.sessionId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No active session",
            "NO_ACTIVE_SESSION",
            { suggestion: "Initialize a session first" }
          );
        }
        if (!Array.isArray(data.eventTypes) || data.eventTypes.length === 0) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "eventTypes must be a non-empty array",
            "EVENT_TYPES_REQUIRED",
            { suggestion: "Provide an array of event type strings to subscribe to" }
          );
        }
        if (!data.eventTypes.every((t) => typeof t === "string" && t.length > 0)) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "eventTypes entries must be non-empty strings",
            "EVENT_TYPES_INVALID",
            { suggestion: "Each entry in eventTypes must be a non-empty string" }
          );
        }
        return await helper._makeRequest(
          "POST",
          `/session/${helper.sessionId}/subscribe`,
          { eventTypes: data.eventTypes }
        );

      case "unsubscribe":
        // POST /session/:sessionId/unsubscribe
        // Requires: { eventTypes: string[] } - game history event types to unsubscribe from
        // Returns: { success, unsubscribed, current_subscriptions }
        if (!helper.sessionId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No active session",
            "NO_ACTIVE_SESSION",
            { suggestion: "Initialize a session first" }
          );
        }
        if (!Array.isArray(data.eventTypes) || data.eventTypes.length === 0) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "eventTypes must be a non-empty array",
            "EVENT_TYPES_REQUIRED",
            { suggestion: "Provide an array of event type strings to unsubscribe from" }
          );
        }
        if (!data.eventTypes.every((t) => typeof t === "string" && t.length > 0)) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "eventTypes entries must be non-empty strings",
            "EVENT_TYPES_INVALID",
            { suggestion: "Each entry in eventTypes must be a non-empty string" }
          );
        }
        return await helper._makeRequest(
          "POST",
          `/session/${helper.sessionId}/unsubscribe`,
          { eventTypes: data.eventTypes }
        );

      case "subscriptions":
        // GET /session/:sessionId/subscriptions
        // Returns: { success, subscriptions }
        if (!helper.sessionId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No active session",
            "NO_ACTIVE_SESSION",
            { suggestion: "Initialize a session first" }
          );
        }
        return await helper._makeRequest(
          "GET",
          `/session/${helper.sessionId}/subscriptions`
        );

      case "kick":
        // POST /session/:sessionId/kick
        // Requires: { participantIdToKick } (hostId is taken from helper.participantId)
        // Returns: { success, kicked_participant, remaining_participants }
        if (!helper.sessionId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No active session",
            "NO_ACTIVE_SESSION",
            { suggestion: "Initialize a session first" }
          );
        }
        if (!helper.participantId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No participant ID",
            "NO_PARTICIPANT_ID",
            { suggestion: "Join a session first" }
          );
        }
        if (!data.participantIdToKick) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "participantIdToKick is required",
            "PARTICIPANT_ID_REQUIRED",
            { suggestion: "Provide the participant ID to kick" }
          );
        }
        return await helper._makeRequest(
          "POST",
          `/session/${helper.sessionId}/kick`,
          {
            hostId: helper.participantId,
            participantIdToKick: data.participantIdToKick,
          }
        );

      case "send-chat":
        // POST /session/:sessionId/chat
        // Requires: { message } (participantId is taken from helper.participantId)
        // Returns: { success, message: <chatMessage> }
        if (!helper.sessionId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No active session",
            "NO_ACTIVE_SESSION",
            { suggestion: "Initialize a session first" }
          );
        }
        if (!helper.participantId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No participant ID",
            "NO_PARTICIPANT_ID",
            { suggestion: "Join a session first" }
          );
        }
        if (typeof data.message !== "string" || data.message.trim().length === 0) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "message is required and must be a non-empty string",
            "MESSAGE_REQUIRED",
            { suggestion: "Provide a non-empty message string to send" }
          );
        }
        if (data.message.trim().length > 500) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "message cannot exceed 500 characters",
            "MESSAGE_TOO_LONG",
            { suggestion: "Keep the message under 500 characters" }
          );
        }
        return await helper._makeRequest(
          "POST",
          `/session/${helper.sessionId}/chat`,
          {
            participantId: helper.participantId,
            message: data.message,
          }
        );

      case "get-chat": {
        // GET /session/:sessionId/chat?limit=N
        // Optional: data.limit (default: 50, BE caps at 100 message history)
        // Returns: { success, session_id, total_messages, messages }
        if (!helper.sessionId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No active session",
            "NO_ACTIVE_SESSION",
            { suggestion: "Initialize a session first" }
          );
        }
        const chatLimit =
          Number.isInteger(data.limit) && data.limit > 0 ? data.limit : 50;
        return await helper._makeRequest(
          "GET",
          `/session/${helper.sessionId}/chat?limit=${chatLimit}`
        );
      }

      case "transfer-host":
        // POST /session/:sessionId/transfer-host
        // Requires: { newHostId } (currentHostId is taken from helper.participantId)
        // Returns: { success, old_host, new_host }
        if (!helper.sessionId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No active session",
            "NO_ACTIVE_SESSION",
            { suggestion: "Initialize a session first" }
          );
        }
        if (!helper.participantId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "No participant ID",
            "NO_PARTICIPANT_ID",
            { suggestion: "Join a session first" }
          );
        }
        if (!data.newHostId) {
          const KubicClientError = helper.KubicClientError || Error;
          throw new KubicClientError(
            "newHostId is required",
            "NEW_HOST_ID_REQUIRED",
            { suggestion: "Provide the participant ID of the new host" }
          );
        }
        return await helper._makeRequest(
          "POST",
          `/session/${helper.sessionId}/transfer-host`,
          {
            currentHostId: helper.participantId,
            newHostId: data.newHostId,
          }
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
              "list-all",
              "list-joinable",
              "list-by-game",
              "auto-join",
              "lobby-status",
              "set-config",
              "get-config",
              "delete-config",
              "subscribe",
              "unsubscribe",
              "subscriptions",
              "kick",
              "transfer-host",
              "send-chat",
              "get-chat",
            ],
          }
        );
    }
  };
}
