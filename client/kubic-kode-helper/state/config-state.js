/**
 * Config State factory function
 * Manages lobby configuration state
 *
 * @param {Object} helper - Reference to the main KubicKodeHelper instance
 * @returns {Object} Config state manager with state and methods
 */
export function createConfigState(helper) {
  return {
    // Config state
    config: {},
    isLoading: false,
    error: null,

    // Update config data
    updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      helper.events.emit("configUpdated", this.getState());
    },

    // Set entire config (replaces all)
    setConfig(fullConfig) {
      this.config = fullConfig || {};
      helper.events.emit("configUpdated", this.getState());
    },

    // Delete a config key
    deleteConfigKey(key) {
      if (key in this.config) {
        delete this.config[key];
        helper.events.emit("configKeyDeleted", { key, remainingConfig: this.getState() });
      }
    },

    // Get a specific config value
    getConfigValue(key) {
      return this.config[key];
    },

    // Set loading state
    setLoading(isLoading) {
      this.isLoading = isLoading;
      helper.events.emit("configLoadingChanged", isLoading);
    },

    // Set error state
    setError(error) {
      this.error = error;
      helper.events.emit("configErrorChanged", error);
    },

    // Get current config state
    getState() {
      return {
        config: { ...this.config },
        isLoading: this.isLoading,
        error: this.error,
      };
    },

    // Reset config state
    reset() {
      this.config = {};
      this.isLoading = false;
      this.error = null;
      helper.events.emit("configReset");
    },
  };
}
