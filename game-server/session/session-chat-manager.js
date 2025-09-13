import { 
  KubicSystemError, 
  KubicValidationError, 
  ErrorFactory,
  ErrorCodes 
} from "../../game-engine/kubic-kode-error.js";

import { kubicLog } from "../../kubic-log.js";

export class SessionChatManager {
  constructor(participantManager) {
    this._participantManager = participantManager;
    this._chatMessages = []; // { id, participantId, participantName, message, timestamp, type }
  }

  // Chat Functionality
  // ------------------

  /**
   * Add a chat message from a participant
   * @param {number} participantId - The participant ID
   * @param {string} message - The message content
   * @param {string} messageType - The message type ("user", "system", "host")
   * @returns {Object} The created chat message object
   */
  addChatMessage(participantId, message, messageType = "user") {
    const participant = this._participantManager.getParticipantById(participantId);
    if (!participant) {
      throw ErrorFactory.validation(
        "Participant not found",
        "participantId",
        participantId,
        { context: { method: "SessionChatManager.addChatMessage", suggestion: "Check if the participant ID is correct and the participant exists" } }
      );
    }

    const chatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      participantId: participantId,
      participantName: participant.name,
      message: message.trim(),
      timestamp: new Date().toISOString(),
      type: messageType // "user", "system", "host"
    };

    this._chatMessages.push(chatMessage);
    
    // Keep only last 100 messages to prevent memory bloat
    if (this._chatMessages.length > 100) {
      this._chatMessages = this._chatMessages.slice(-100);
    }

    return chatMessage;
  }

  /**
   * Get chat messages with optional limit
   * @param {number} limit - Maximum number of messages to return (default: 50)
   * @returns {Array<Object>} Array of chat message objects
   */
  getChatMessages(limit = 50) {
    return this._chatMessages.slice(-limit);
  }

  /**
   * Get recent chat messages
   * @param {number} limit - Maximum number of messages to return
   * @returns {Array<Object>} Array of recent chat message objects
   */
  getRecentChat(limit = 10) {
    return this.getChatMessages(limit);
  }

  /**
   * Add a system message
   * @param {string} message - The system message content
   * @returns {Object} The created system message object
   */
  addSystemMessage(message) {
    const systemMessage = {
      id: `sys-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      participantId: null,
      participantName: "System",
      message: message.trim(),
      timestamp: new Date().toISOString(),
      type: "system"
    };

    this._chatMessages.push(systemMessage);
    
    // Keep only last 100 messages to prevent memory bloat
    if (this._chatMessages.length > 100) {
      this._chatMessages = this._chatMessages.slice(-100);
    }

    return systemMessage;
  }

  /**
   * Get all chat messages
   * @returns {Array<Object>} Array of all chat message objects
   */
  getAllChatMessages() {
    return [...this._chatMessages];
  }

  /**
   * Clear all chat messages
   */
  clearChatMessages() {
    this._chatMessages = [];
  }

  /**
   * Get chat message by ID
   * @param {string} messageId - The message ID to find
   * @returns {Object|null} The chat message object or null if not found
   */
  getChatMessageById(messageId) {
    return this._chatMessages.find(msg => msg.id === messageId) || null;
  }

  /**
   * Get chat messages by participant
   * @param {number} participantId - The participant ID
   * @param {number} limit - Maximum number of messages to return
   * @returns {Array<Object>} Array of chat message objects from the participant
   */
  getChatMessagesByParticipant(participantId, limit = 50) {
    const participantMessages = this._chatMessages.filter(msg => msg.participantId === participantId);
    return participantMessages.slice(-limit);
  }

  /**
   * Get chat messages by type
   * @param {string} messageType - The message type to filter by
   * @param {number} limit - Maximum number of messages to return
   * @returns {Array<Object>} Array of chat message objects of the specified type
   */
  getChatMessagesByType(messageType, limit = 50) {
    const typeMessages = this._chatMessages.filter(msg => msg.type === messageType);
    return typeMessages.slice(-limit);
  }

  /**
   * Get chat statistics
   * @returns {Object} Object containing chat statistics
   */
  getChatStats() {
    const totalMessages = this._chatMessages.length;
    const userMessages = this._chatMessages.filter(msg => msg.type === "user").length;
    const systemMessages = this._chatMessages.filter(msg => msg.type === "system").length;
    const hostMessages = this._chatMessages.filter(msg => msg.type === "host").length;

    return {
      total: totalMessages,
      user: userMessages,
      system: systemMessages,
      host: hostMessages
    };
  }
}
