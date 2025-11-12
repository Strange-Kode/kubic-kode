/**
 * Config WebSocket event handlers
 * Handles: kubic::lobbyConfigUpdated, kubic::lobbyConfigDeleted
 */
export function createConfigEventHandlers(helper) {
  return {
    /**
     * Handle kubic::lobbyConfigUpdated WebSocket event
     * @param {Object} payload - Event payload with { hostId, hostName, changes, fullConfig }
     */
    handleLobbyConfigUpdated: (payload) => {
      // Update config state with the full config from backend
      if (payload.fullConfig) {
        helper.config.setConfig(payload.fullConfig);
      }

      // Emit high-level event for UI
      helper.events.emit("lobbyConfigUpdated", {
        hostId: payload.hostId,
        hostName: payload.hostName,
        changes: payload.changes,
        fullConfig: payload.fullConfig,
      });
    },

    /**
     * Handle kubic::lobbyConfigDeleted WebSocket event
     * @param {Object} payload - Event payload with { hostId, hostName, deletedKey, oldValue, remainingConfig }
     */
    handleLobbyConfigDeleted: (payload) => {
      // Delete the key from local state
      if (payload.deletedKey) {
        helper.config.deleteConfigKey(payload.deletedKey);
      }

      // Update with remaining config to ensure sync
      if (payload.remainingConfig) {
        helper.config.setConfig(payload.remainingConfig);
      }

      // Emit high-level event for UI
      helper.events.emit("lobbyConfigDeleted", {
        hostId: payload.hostId,
        hostName: payload.hostName,
        deletedKey: payload.deletedKey,
        oldValue: payload.oldValue,
        remainingConfig: payload.remainingConfig,
      });
    },
  };
}
