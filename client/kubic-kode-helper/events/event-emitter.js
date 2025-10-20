/**
 * Event Emitter factory function
 * Creates an event management system for handling custom events
 *
 * @param {Object} helper - Reference to the main KubicKodeHelper instance
 * @returns {Object} Event emitter with on/off/emit methods
 */
export function createEventEmitter(helper) {
  return {
    /**
     * Register an event listener
     * @param {string} eventType - The type of event to listen for
     * @param {Function} callback - The callback function to execute
     * @returns {Object} Helper reference for chaining
     */
    on(eventType, callback) {
      if (!helper.eventListeners.has(eventType)) {
        helper.eventListeners.set(eventType, []);
      }
      helper.eventListeners.get(eventType).push(callback);
      return helper;
    },

    /**
     * Remove an event listener
     * @param {string} eventType - The type of event
     * @param {Function} callback - The callback function to remove
     * @returns {Object} Helper reference for chaining
     */
    off(eventType, callback) {
      if (helper.eventListeners.has(eventType)) {
        const listeners = helper.eventListeners.get(eventType);
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
      return helper;
    },

    /**
     * Emit an event to all registered listeners
     * @param {string} eventType - The type of event to emit
     * @param {any} data - The data to pass to event listeners
     * @returns {Object} Helper reference for chaining
     */
    emit(eventType, data) {
      if (helper.eventListeners.has(eventType)) {
        helper.eventListeners.get(eventType).forEach((callback) => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in event listener for ${eventType}:`, error);
          }
        });
      }
      return helper;
    }
  };
}
