import { GameHistory } from "../../game-server/game-history.js";
import { kubicLog } from "../../kubic-log.js";

export default {
  async init() {
    kubicLog.info('[subscription] Module initialized');
  },

  /**
   * Subscribe to game history event types
   * @param {Object} gameSession - The game session
   * @param {Array<string>} eventTypes - Array of event types to subscribe to
   * @returns {Object} Subscription result
   */
  subscribeToEvents(gameSession, eventTypes) {
    if (!eventTypes || !Array.isArray(eventTypes) || eventTypes.length === 0) {
      throw new Error("eventTypes must be a non-empty array of game history event type strings.");
    }

    // Validate that all requested event types are game history events
    const validGameHistoryEventTypes = GameHistory.getValidEventTypes();

    const invalidTypes = eventTypes.filter(
      (type) => !validGameHistoryEventTypes.includes(type)
    );
    if (invalidTypes.length > 0) {
      const error = new Error(
        `Cannot subscribe to non-game-history events: ${invalidTypes.join(", ")}. Only game history events can be subscribed to.`
      );
      error.invalidTypes = invalidTypes;
      error.validGameHistoryEventTypes = validGameHistoryEventTypes;
      throw error;
    }

    gameSession.getHistoryManager().subscribeToGameHistoryEvents(eventTypes);

    return {
      success: true,
      sessionId: gameSession.getSessionId(),
      subscribedEventTypes: eventTypes,
      message: `Successfully subscribed to game history event types: ${eventTypes.join(", ")}`
    };
  },

  /**
   * Unsubscribe from game history event types
   * @param {Object} gameSession - The game session
   * @param {Array<string>} eventTypes - Array of event types to unsubscribe from
   * @returns {Object} Unsubscription result
   */
  unsubscribeFromEvents(gameSession, eventTypes) {
    if (!eventTypes || !Array.isArray(eventTypes)) {
      throw new Error("eventTypes must be an array of game history event type strings.");
    }

    // Validate that all requested event types are game history events
    const validGameHistoryEventTypes = GameHistory.getValidEventTypes();

    const invalidTypes = eventTypes.filter(
      (type) => !validGameHistoryEventTypes.includes(type)
    );
    if (invalidTypes.length > 0) {
      const error = new Error(
        `Cannot unsubscribe from non-game-history events: ${invalidTypes.join(", ")}. Only game history events can be unsubscribed from.`
      );
      error.invalidTypes = invalidTypes;
      error.validGameHistoryEventTypes = validGameHistoryEventTypes;
      throw error;
    }

    gameSession.getHistoryManager().unsubscribeFromGameHistoryEvents(eventTypes);

    return {
      success: true,
      sessionId: gameSession.getSessionId(),
      unsubscribedEventTypes: eventTypes,
      message: `Successfully unsubscribed from game history event types: ${eventTypes.join(", ")}`
    };
  }
};

