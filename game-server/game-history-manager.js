import { GameHistory } from "./game-history.js";
import { GameEventService } from "./game-event-service.js";

import { kubicLog } from "../kubic-log.js";
import { 
  KubicSystemError, 
  KubicValidationError, 
  ErrorFactory,
  ErrorCodes 
} from "../game-engine/kubic-kode-error.js";

/**
 * GameHistoryManager is a singleton that manages game history subscriptions
 * and provides a proxy to GameHistory instances that automatically handles
 * broadcasting based on subscriptions.
 */
class GameHistoryManager {
  constructor() {
    this._subscriptions = new Map(); // sessionId -> Set of event types
    this._gameHistories = new Map(); // sessionId -> GameHistory instance
  }

  get subscriptions() {
    throw ErrorFactory.system(
      "Attempting to access subscriptions property on GameHistoryManager. Not allowed, subscriptions is a protected property.",
      "GameHistoryManager",
      { context: { suggestion: "Use getSubscriptions(sessionId) method instead", property: "subscriptions" } }
    );
  }

  get gameHistories() {
    throw ErrorFactory.system(
      "Attempting to access gameHistories property on GameHistoryManager. Not allowed, gameHistories is a protected property.",
      "GameHistoryManager",
      { context: { suggestion: "Use getGameHistory(sessionId) method instead", property: "gameHistories" } }
    );
  }

  /**
   * Subscribe a session to specific game history event types
   * @param {string} sessionId - The session ID to subscribe
   * @param {Array<string>} eventTypes - Array of game history event types to subscribe to
   */
  subscribe(sessionId, eventTypes) {
    if (!Array.isArray(eventTypes)) {
      throw ErrorFactory.validation(
        "eventTypes must be an array",
        "eventTypes",
        eventTypes,
        { context: { method: "GameHistoryManager.subscribe", expectedType: "array" } }
      );
    }

    if (!this._subscriptions.has(sessionId)) {
      this._subscriptions.set(sessionId, new Set());
    }

    const sessionSubscriptions = this._subscriptions.get(sessionId);
    const validEventTypes = eventTypes.filter(type => GameHistory.isValidEventType(type));
    const invalidEventTypes = eventTypes.filter(type => !GameHistory.isValidEventType(type));

    if (invalidEventTypes.length > 0) {
      kubicLog.warn(`[GameHistoryManager]::subscribe: Cannot subscribe to non-game-history events: ${invalidEventTypes.join(", ")}`);
    }

    validEventTypes.forEach(eventType => {
      sessionSubscriptions.add(eventType);
    });

    kubicLog.debug(`[GameHistoryManager]::subscribe: Session ${sessionId} subscribed to game history event types: ${Array.from(sessionSubscriptions).join(", ")}`);
  }

  /**
   * Unsubscribe a session from specific game history event types
   * @param {string} sessionId - The session ID to unsubscribe
   * @param {Array<string>} eventTypes - Array of game history event types to unsubscribe from
   */
  unsubscribe(sessionId, eventTypes) {
    if (!Array.isArray(eventTypes)) {
      throw ErrorFactory.validation(
        "eventTypes must be an array",
        "eventTypes",
        eventTypes,
        { context: { method: "GameHistoryManager.unsubscribe", expectedType: "array" } }
      );
    }

    if (!this._subscriptions.has(sessionId)) {
      kubicLog.warn(`[GameHistoryManager]::unsubscribe: Session ${sessionId} has no subscriptions to unsubscribe from`);
      return;
    }

    const sessionSubscriptions = this._subscriptions.get(sessionId);
    const validEventTypes = eventTypes.filter(type => GameHistory.isValidEventType(type));
    const invalidEventTypes = eventTypes.filter(type => !GameHistory.isValidEventType(type));

    if (invalidEventTypes.length > 0) {
      kubicLog.warn(`[GameHistoryManager]::unsubscribe: Warning - Cannot unsubscribe from non-game-history events: ${invalidEventTypes.join(", ")}`);
    }

    validEventTypes.forEach(eventType => {
      sessionSubscriptions.delete(eventType);
    });

    kubicLog.debug(`[GameHistoryManager]::unsubscribe: Session ${sessionId} unsubscribed from game history event types: ${validEventTypes.join(", ")}`);
    kubicLog.debug(`[GameHistoryManager]::unsubscribe: Session ${sessionId} remaining subscriptions: ${Array.from(sessionSubscriptions).join(", ")}`);
  }

  /**
   * Get all subscribed game history event types for a session
   * @param {string} sessionId - The session ID
   * @returns {Array<string>} Array of subscribed event types
   */
  getSubscriptions(sessionId) {
    if (!this._subscriptions.has(sessionId)) {
      return [];
    }
    return Array.from(this._subscriptions.get(sessionId));
  }

  /**
   * Check if a session is subscribed to a specific game history event type
   * @param {string} sessionId - The session ID
   * @param {string} eventType - The event type to check
   * @returns {boolean} True if subscribed, false otherwise
   */
  isSubscribed(sessionId, eventType) {
    if (!this._subscriptions.has(sessionId)) {
      return false;
    }
    return this._subscriptions.get(sessionId).has(eventType);
  }

  /**
   * Clear all subscriptions for a session
   * @param {string} sessionId - The session ID
   */
  clearSubscriptions(sessionId) {
    this._subscriptions.delete(sessionId);
    kubicLog.debug(`[GameHistoryManager]::clearSubscriptions: Cleared all subscriptions for session ${sessionId}`);
  }

  /**
   * Get a proxy to a GameHistory instance for a session
   * @param {string} sessionId - The session ID
   * @returns {Proxy} A proxy that delegates to GameHistory and handles broadcasting
   */
  getGameHistory(sessionId) {
    // Get or create the GameHistory instance
    if (!this._gameHistories.has(sessionId)) {
      this._gameHistories.set(sessionId, new GameHistory(sessionId));
    }

    const gameHistory = this._gameHistories.get(sessionId);

    // Create a proxy that intercepts method calls
    return new Proxy(gameHistory, {
      get: (target, prop) => {
        const method = target[prop];

        // If it's not a method or doesn't start with "add", just return it
        if (typeof method !== "function" || !prop.startsWith("add")) {
          return method;
        }

        // For "add" methods, wrap them to handle broadcasting
        return (...args) => {
          // Call the original method
          const result = method.apply(target, args);

          // Extract the event type from the result
          if (result && result.type && GameHistory.isValidEventType(result.type)) {
            // Broadcast if subscribed
            this._broadcast(sessionId, result);
          }

          return result;
        };
      }
    });
  }

  /**
   * Internal method to broadcast game history events based on subscriptions
   * @param {string} sessionId - The session ID
   * @param {Object} historyEvent - The game history event that was added
   */
  _broadcast(sessionId, historyEvent) {
    // Always broadcast critical game events regardless of subscription
    const criticalEvents = ["playerWon", "gameStarted", "gameEnded", "gameTied", "winCount", "turnPlayed"];
    const shouldAlwaysBroadcast = criticalEvents.includes(historyEvent.type);

    // Map event type to kubic:: namespace for broadcasting
    const broadcastEventType = `kubic::${historyEvent.type}`;

    if (!this.isSubscribed(sessionId, historyEvent.type) && !shouldAlwaysBroadcast) {
      kubicLog.warn(`[GameHistoryManager] Session ${sessionId} not subscribed to game history event type "${historyEvent.type}", skipping broadcast`);
      return;
    }

    if (shouldAlwaysBroadcast && !this.isSubscribed(sessionId, historyEvent.type)) {
      kubicLog.debug(`[GameHistoryManager] Broadcasting critical event "${historyEvent.type}" to session ${sessionId} (not subscribed but critical)`);
    }

    kubicLog.debug(`[GameHistoryManager] Broadcasting game history event "${historyEvent.type}" to session ${sessionId}`);

    // Create a session-like object for broadcasting
    const sessionLike = {
      getSessionId: () => sessionId,
      getGameInstance: () => null // Game history events don't need game instance
    };

    GameEventService.broadcastToSession(sessionLike, {
      type: broadcastEventType,
      payload: {
        ...historyEvent.payload,
        playerId: historyEvent.playerId,
        participantId: historyEvent.participantId,
        timestamp: historyEvent.timestamp,
        sessionId: historyEvent.sessionId
      }
    });
  }

  /**
   * Remove a session's game history and subscriptions
   * @param {string} sessionId - The session ID
   */
  removeSessionHistory(sessionId) {
    this.clearSubscriptions(sessionId);
    this._gameHistories.delete(sessionId);
    kubicLog.debug(`[GameHistoryManager]::removeSessionHistory: Removed session ${sessionId}`);
  }
}

// Export singleton instance
export const gameHistoryManager = new GameHistoryManager();
