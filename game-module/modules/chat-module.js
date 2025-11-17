import { GameEventService } from "../../game-server/game-event-service.js";
import { kubicLog } from "../../kubic-log.js";

export default {
  async init() {
    kubicLog.info('[chat] Module initialized');
  },

  /**
   * Send a chat message
   * @param {Object} gameSession - The game session
   * @param {Object} participant - The participant object
   * @param {string} participantId - ID of the participant
   * @param {string} message - The message to send
   * @returns {Object} Chat message result
   */
  sendChatMessage(gameSession, participant, participantId, message) {
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      throw new Error("message is required and must be a non-empty string.");
    }

    if (message.trim().length > 500) {
      throw new Error("Message cannot exceed 500 characters.");
    }

    // Determine message type based on participant
    const messageType = gameSession.getParticipantManager().isHost(participantId) ? "host" : "user";
    const chatMessage = gameSession.getChatManager().addChatMessage(participantId, message, messageType);

    const result = {
      success: true,
      message: chatMessage
    };

    // Broadcast chat message
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::lobbyChatMessage",
        payload: { message: chatMessage }
      });
    } catch (broadcastError) {
      kubicLog.error("[chat] Message broadcast error (non-blocking):", broadcastError);
    }

    return result;
  },

  /**
   * Get chat messages
   * @param {Object} gameSession - The game session
   * @param {number} limit - Maximum number of messages to retrieve
   * @returns {Object} Chat messages result
   */
  getChatMessages(gameSession, limit = 50) {
    const messages = gameSession.getChatManager().getChatMessages(parseInt(limit, 10));
    
    return {
      success: true,
      session_id: gameSession.getSessionId(),
      total_messages: messages.length,
      messages: messages
    };
  }
};

