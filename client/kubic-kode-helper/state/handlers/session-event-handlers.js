/**
 * Session lifecycle WebSocket event handlers
 * Handles: sessionParticipantJoined, sessionParticipantLeft, sessionSpectatorJoined, sessionEnded
 */
export function createSessionEventHandlers(helper) {
  return {
    /**
     * Handle sessionParticipantJoined WebSocket event
     * @param {Object} payload - Event payload
     */
    handleSessionParticipantJoined: () => {
      // Refresh participants list
      helper.getParticipants()
        .then((result) => {
          if (result.success) {
            // Update session participants from the API response
            const participants = Array.isArray(result.data)
              ? result.data
              : result.data.participants;
            helper.session.updateParticipants(participants);

            // Update maxPlayers if provided
            if (result.data.maxPlayers) {
              helper.session.updateSession({
                maxPlayers: result.data.maxPlayers,
              });
            }
          }

          // Check if we should auto-start the game (now with updated participants)
          helper.flow.checkAndAutoStart();
        })
        .catch((err) => {
          console.error(
            "[KubicKode.flow] Error refreshing participants:",
            err
          );
        });
    },

    /**
     * Handle sessionParticipantLeft WebSocket event
     * @param {Object} payload - Event payload
     */
    handleSessionParticipantLeft: () => {
      // Refresh participants list and update session state
      helper.getParticipants()
        .then((result) => {
          if (result.success) {
            // Update session participants from the API response
            const participants = Array.isArray(result.data)
              ? result.data
              : result.data.participants;
            helper.session.updateParticipants(participants);

            // Update maxPlayers if provided
            if (result.data.maxPlayers) {
              helper.session.updateSession({
                maxPlayers: result.data.maxPlayers,
              });
            }

            // Check if there are enough playable participants for the game to continue
            const playableParticipants = participants.filter(
              (p) => p.type === "user" || p.type === "computer"
            );
            const maxPlayers = result.data.maxPlayers || helper.session.maxPlayers;

            // If not enough players remain, clear the inactivity timer
            if (maxPlayers && playableParticipants.length < maxPlayers) {
              helper.inactivity.clearTimer();
            }
          }
        })
        .catch((err) => {
          console.error("[KubicKode.flow] Error refreshing participants:", err);
        });
    },

    /**
     * Handle sessionSpectatorJoined WebSocket event
     * @param {Object} payload - Event payload
     */
    handleSessionSpectatorJoined: () => {
      // Refresh participants list
      helper.getParticipants()
        .then((result) => {
          if (result.success) {
            // Update session participants from the API response
            const participants = Array.isArray(result.data)
              ? result.data
              : result.data.participants;
            helper.session.updateParticipants(participants);

            // Update maxPlayers if provided
            if (result.data.maxPlayers) {
              helper.session.updateSession({
                maxPlayers: result.data.maxPlayers,
              });
            }
          }
        })
        .catch((err) => {
          console.error(
            "[KubicKode.flow] Error refreshing participants:",
            err
          );
        });
    },

    /**
     * Handle sessionEnded WebSocket event
     * @param {Object} payload - Event payload with reason
     */
    handleSessionEnded: (payload) => {
      helper.flow.gamePhase = "session-ended";
      helper.stopHeartbeat();

      // Clear inactivity timer since session has ended
      helper.inactivity.clearTimer();

      // Emit high-level event for UI
      helper.events.emit("sessionTerminated", {
        reason: payload.reason || "Unknown reason",
        details: payload.details || {},
      });
    },
  };
}
