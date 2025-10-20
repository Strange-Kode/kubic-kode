/**
 * Connection lifecycle WebSocket event handlers
 * Handles: participantDisconnected, participantRemoved, participantReconnected
 */
export function createConnectionEventHandlers(helper) {
  return {
    /**
     * Handle participantDisconnected WebSocket event
     * @param {Object} payload - Event payload
     */
    handleParticipantDisconnected: (payload) => {
      // Don't show notification for own disconnection
      if (payload.participantId === helper.participantId) {
        return;
      }

      // Emit UI notification event
      helper.events.emit("participantConnectionChanged", {
        type: "disconnected",
        participantId: payload.participantId,
        participantName: payload.participantName || "Unknown participant",
        participantType: payload.participantType,
      });

      // Refresh participants list
      helper.getParticipants().catch((err) => {
        console.error("[KubicKode.flow] Error refreshing participants:", err);
      });
    },

    /**
     * Handle participantRemoved WebSocket event
     * @param {Object} payload - Event payload
     */
    handleParticipantRemoved: (payload) => {
      // Don't show notification for own removal
      if (payload.participantId === helper.participantId) {
        return;
      }

      // Emit UI notification event
      helper.events.emit("participantConnectionChanged", {
        type: "removed",
        participantId: payload.participantId,
        participantName: payload.participantName || "Unknown participant",
        reason: payload.reason || "timeout",
      });

      // Refresh participants list
      helper.getParticipants().catch((err) => {
        console.error("[KubicKode.flow] Error refreshing participants:", err);
      });
    },

    /**
     * Handle participantReconnected WebSocket event
     * @param {Object} payload - Event payload
     */
    handleParticipantReconnected: (payload) => {
      // Emit UI notification event
      helper.events.emit("participantConnectionChanged", {
        type: "reconnected",
        participantId: payload.participantId,
        participantName: payload.participantName || "Unknown participant",
      });
    },
  };
}
