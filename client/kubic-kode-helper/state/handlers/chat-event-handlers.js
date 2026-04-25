/**
 * Chat WebSocket event handlers
 * Handles: kubic::lobbyChatMessage
 *
 * Note: lobbyChatMessage is also broadcast for system messages from
 * participant-module (kick, host-transfer, leave) and lobby-module. The
 * `type` field on the message ("user" / "host" / "system") tells consumers
 * which kind of message they got.
 */
export function createChatEventHandlers(helper) {
  return {
    /**
     * Handle kubic::lobbyChatMessage WebSocket event
     * @param {Object} payload - Event payload with { message: <chatMessage> }
     *   chatMessage shape: { id, participantId, participantName, message, timestamp, type }
     */
    handleLobbyChatMessage: (payload) => {
      // Guard against malformed payloads so consumers never receive a
      // { message: undefined } event by accident.
      if (!payload || !payload.message) return;

      // Re-emit a high-level event for consumer apps. We don't cache messages
      // on the helper - consumers maintain their own list (call getChatHistory()
      // for backfill on join).
      helper.events.emit("lobbyChatMessage", {
        message: payload.message,
      });
    },
  };
}
