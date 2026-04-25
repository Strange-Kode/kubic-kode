/**
 * Session lifecycle WebSocket event handlers
 * Handles: sessionParticipantJoined, sessionParticipantLeft, sessionSpectatorJoined, sessionEnded,
 *          participantKicked, hostTransferred
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

    /**
     * Handle participantKicked WebSocket event
     * @param {Object} payload - Event payload with { hostId, hostName, kickedParticipant: { id, name } }
     */
    handleParticipantKicked: (payload) => {
      const kickedId = payload.kickedParticipant?.id;
      const isSelf = kickedId !== undefined && kickedId === helper.participantId;

      if (isSelf) {
        // We were kicked. Mirror handleSessionEnded so we don't keep pinging
        // a session we no longer belong to: stop heartbeat, clear timer, and
        // mark gamePhase so flow checks short-circuit. The BE will also close
        // the WS shortly; connection handlers handle the rest.
        helper.flow.gamePhase = "session-ended";
        helper.stopHeartbeat();
        helper.inactivity.clearTimer();
      } else {
        // Refresh participants list so UI reflects the kick. Mirrors
        // handleSessionParticipantLeft - includes maxPlayers update and
        // inactivity check since a kick reduces playable count the same way.
        helper.getParticipants()
          .then((result) => {
            if (result.success) {
              const participants = Array.isArray(result.data)
                ? result.data
                : result.data.participants;
              helper.session.updateParticipants(participants);

              if (result.data.maxPlayers) {
                helper.session.updateSession({
                  maxPlayers: result.data.maxPlayers,
                });
              }

              const playableParticipants = participants.filter(
                (p) => p.type === "user" || p.type === "computer"
              );
              const maxPlayers = result.data.maxPlayers || helper.session.maxPlayers;

              if (maxPlayers && playableParticipants.length < maxPlayers) {
                helper.inactivity.clearTimer();
              }
            }
          })
          .catch((err) => {
            console.error(
              "[KubicKode.flow] Error refreshing participants after kick:",
              err
            );
          });
      }

      // Emit high-level event for UI (consumer apps decide how to display
      // "you were kicked" vs "X was kicked")
      helper.events.emit("participantKicked", {
        hostId: payload.hostId,
        hostName: payload.hostName,
        kickedParticipant: payload.kickedParticipant,
        isSelf,
      });
    },

    /**
     * Handle hostTransferred WebSocket event
     * Fires for active handoffs (POST /transfer-host) and auto-transfers when
     * the host leaves. The BE distinguishes via payload.reason
     * ("host-handoff" vs "host-left") so consumer UI can render different copy.
     * @param {Object} payload - Event payload with { oldHost, newHost, reason }
     */
    handleHostTransferred: (payload) => {
      const newHostId = payload.newHost?.id;
      const isHostNow = newHostId !== undefined && newHostId === helper.participantId;

      // Sync session-state's isHost flag with the new reality
      helper.session.updateSession({ isHost: isHostNow });

      // Emit high-level event for UI
      helper.events.emit("hostTransferred", {
        oldHost: payload.oldHost,
        newHost: payload.newHost,
        reason: payload.reason || "unknown",
        isHostNow,
      });
    },
  };
}
