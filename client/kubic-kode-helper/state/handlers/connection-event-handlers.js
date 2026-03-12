/**
 * Connection lifecycle WebSocket event handlers
 * Handles: participantDisconnected, participantRemoved, participantReconnected, connectionConfirmed (reconnect sync)
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

    /**
     * Handle connectionConfirmed WebSocket event after a reconnect
     * Re-syncs participants and game state so the client is up to date
     */
    handleConnectionConfirmed: async () => {
      // Only sync on reconnect, not initial connect
      if (!helper._hasConnectedBefore) {
        return;
      }

      // Must have an active session to sync
      if (!helper.sessionId || !helper.participantId) {
        return;
      }

      try {
        // Re-fetch participant list
        const participantsResult = await helper.getParticipants();
        if (participantsResult.success) {
          const participants = Array.isArray(participantsResult.data)
            ? participantsResult.data
            : participantsResult.data.participants;
          helper.session.updateParticipants(participants);
        }

        // Re-fetch game state if a game is active
        if (helper.game.started || helper.game.active) {
          const [tilemapResult, currentPlayerResult] = await Promise.all([
            helper.route.game("get-tilemap"),
            helper.route.game("get-current-player"),
          ]);

          if (tilemapResult.success) {
            helper.game.updateTilemap(tilemapResult.data.tiles);
          }

          if (currentPlayerResult.success) {
            const currentPlayerId =
              currentPlayerResult.data.current_player_id ||
              (currentPlayerResult.data.current_player_ids &&
              currentPlayerResult.data.current_player_ids.length > 0
                ? currentPlayerResult.data.current_player_ids[0]
                : null);
            helper.game.updateGame({ currentPlayerId });
          }
        }

        // Notify consuming app that state was refreshed after reconnect
        helper.events.emit("reconnectSynced", {
          sessionId: helper.sessionId,
          participantId: helper.participantId,
          gameActive: helper.game.active,
        });
      } catch (error) {
        console.error(
          "[KubicKode.flow] Error syncing state after reconnect:",
          error
        );
        helper.events.emit("reconnectSyncFailed", { error: "Failed to sync after reconnect" });
      }
    },
  };
}
