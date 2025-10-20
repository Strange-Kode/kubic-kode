/**
 * Inactivity timer management factory
 * Tracks and interpolates inactivity timer from backend
 */
export function createInactivityState(helper) {
  return {
    // Inactivity state
    timerSeconds: null,
    lastUpdate: null,
    initialTimer: null, // Store the initial/max timer value for resets

    /**
     * Get live interpolated timer value
     * @returns {number|null} Seconds remaining, or null if no timer active
     */
    getLiveTimer() {
      if (
        this.timerSeconds === null ||
        this.lastUpdate === null
      ) {
        return null;
      }

      // Calculate elapsed time since last backend update
      const elapsedMs = Date.now() - this.lastUpdate;
      const elapsedSeconds = Math.floor(elapsedMs / 1000);

      // Start from backend's authoritative time and subtract local elapsed time
      const liveTimer = Math.max(
        0,
        this.timerSeconds - elapsedSeconds
      );

      return liveTimer;
    },

    /**
     * Update timer from backend (authoritative source)
     * @param {number} seconds - Seconds left from backend
     */
    updateTimer(seconds) {
      this.timerSeconds = seconds;
      this.lastUpdate = Date.now();
      helper.events.emit("inactivityTimerUpdated", {
        seconds,
        timestamp: this.lastUpdate,
      });
    },

    /**
     * Clear inactivity timer
     */
    clearTimer() {
      this.timerSeconds = null;
      this.lastUpdate = null;
      helper.events.emit("inactivityTimerCleared");
    },

    /**
     * Get current inactivity state
     * @returns {Object} Current inactivity state
     */
    getState() {
      return {
        timerSeconds: this.timerSeconds,
        lastUpdate: this.lastUpdate,
        liveTimer: this.getLiveTimer(),
      };
    },
  };
}
