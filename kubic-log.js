// Debug configuration for the server-side application
class KubicLogConfig {
  constructor() {
    // Check KUBIC_DEBUG_MODE first (preferred), fallback to DEBUG_MODE for backwards compatibility
    const debugModeValue = process.env.KUBIC_DEBUG_MODE || process.env.DEBUG_MODE;
    this._debugMode = debugModeValue === "true" || debugModeValue === "1";
    // Check KUBIC_LOG_LEVEL or KUBIC_DEBUG_LEVEL first, fallback to DEBUG_LEVEL for backwards compatibility
    this._debugLevel = process.env.KUBIC_LOG_LEVEL || process.env.KUBIC_DEBUG_LEVEL || process.env.DEBUG_LEVEL || "info"; // "error", "warn", "info", "debug", "trace"
  }

  isDebugEnabled() {
    return this._debugMode;
  }

  getDebugLevel() {
    return this._debugLevel;
  }

  shouldLog(level) {
    if (!this._debugMode) return false;
    
    const levels = {
      "error": 0,
      "warn": 1, 
      "info": 2,
      "debug": 3,
      "trace": 4
    };
    
    const currentLevel = levels[this._debugLevel] || 2;
    const requestedLevel = levels[level] || 2;
    
    return requestedLevel <= currentLevel;
  }

  log(level, message, ...args) {
    if (this.shouldLog(level)) {
      const entry = {
        timestamp: new Date().toISOString(),
        level,
        message: typeof message === "string" ? message : String(message),
      };
      if (args.length > 0) {
        entry.data = args.length === 1 ? args[0] : args;
      }
      console.log(JSON.stringify(entry));
    }
  }

  error(message, ...args) {
    this.log("error", message, ...args);
  }

  warn(message, ...args) {
    this.log("warn", message, ...args);
  }

  info(message, ...args) {
    this.log("info", message, ...args);
  }

  debug(message, ...args) {
    this.log("debug", message, ...args);
  }

  trace(message, ...args) {
    this.log("trace", message, ...args);
  }

  // Method to update debug mode at runtime
  setDebugMode(enabled, level = "info") {
    this._debugMode = enabled;
    this._debugLevel = level;
    this.info(`Debug mode ${enabled ? "enabled" : "disabled"} with level: ${level}`);
  }
}

// Create a singleton instance
export const debugConfig = new KubicLogConfig();

// Export convenience functions
export const kubicLog = {
  error: (message, ...args) => debugConfig.error(message, ...args),
  warn: (message, ...args) => debugConfig.warn(message, ...args),
  info: (message, ...args) => debugConfig.info(message, ...args),
  debug: (message, ...args) => debugConfig.debug(message, ...args),
  trace: (message, ...args) => debugConfig.trace(message, ...args),
  isEnabled: () => debugConfig.isDebugEnabled(),
  setMode: (enabled, level) => debugConfig.setDebugMode(enabled, level)
};
