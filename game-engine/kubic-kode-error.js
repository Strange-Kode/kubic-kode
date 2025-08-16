import { kubicLog } from "../kubic-log.js";

/**
 * Base class for all KubicKode errors
 * Provides standardized error handling with error codes, context, and logging
 */
export class KubicKodeError extends Error {
  constructor(message, options = {}) {
    super(message);
    
    // Ensure proper inheritance
    this.name = this.constructor.name;
    
    // Error metadata
    this.code = options.code || "UNKNOWN_ERROR";
    this.context = options.context || {};
    this.timestamp = new Date().toISOString();
    this.severity = options.severity || "error"; // error, warn, info
    
    // Stack trace handling
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // Log the error
    this._logError();
  }

  /**
   * Get a standardized error response object
   * @returns {Object} Error response suitable for API responses
   */
  toResponse() {
    return {
      error: true,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      context: this.context
    };
  }

  /**
   * Get error details for debugging
   * @returns {Object} Detailed error information
   */
  toDetails() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      stack: this.stack,
      context: this.context,
      timestamp: this.timestamp,
      severity: this.severity
    };
  }

  /**
   * Log the error using kubicLog
   * @private
   */
  _logError() {
    const logMessage = `[${this.code}] ${this.message}`;
    
    switch (this.severity) {
      case "warn":
        kubicLog.warn(logMessage, this.context);
        break;
      case "info":
        kubicLog.info(logMessage, this.context);
        break;
      default:
        kubicLog.error(logMessage, this.context);
    }
  }

  /**
   * Create a KubicKodeError from a standard Error
   * @param {Error} error - The original error
   * @param {Object} options - Error options
   * @returns {KubicKodeError} New KubicKodeError instance
   */
  static fromError(error, options = {}) {
    return new KubicKodeError(error.message, {
      code: options.code || "CONVERTED_ERROR",
      context: { originalError: error.name, ...options.context },
      severity: options.severity || "error"
    });
  }
}

/**
 * Validation errors for invalid input data
 */
export class KubicValidationError extends KubicKodeError {
  constructor(message, field = null, value = null, options = {}) {
    super(message, {
      code: "VALIDATION_ERROR",
      context: { field, value, ...options.context },
      severity: "warn",
      ...options
    });
  }
}

/**
 * Configuration errors for invalid settings or options
 */
export class KubicConfigurationError extends KubicKodeError {
  constructor(message, option = null, value = null, options = {}) {
    super(message, {
      code: "CONFIGURATION_ERROR",
      context: { option, value, ...options.context },
      severity: "error",
      ...options
    });
  }
}

/**
 * Session-related errors
 */
export class KubicSessionError extends KubicKodeError {
  constructor(message, sessionId = null, options = {}) {
    super(message, {
      code: "SESSION_ERROR",
      context: { sessionId, ...options.context },
      severity: "error",
      ...options
    });
  }
}

/**
 * Game-related errors
 */
export class KubicGameError extends KubicKodeError {
  constructor(message, gameId = null, playerId = null, options = {}) {
    super(message, {
      code: "GAME_ERROR",
      context: { gameId, playerId, ...options.context },
      severity: "error",
      ...options
    });
  }
}

/**
 * Participant-related errors
 */
export class KubicParticipantError extends KubicKodeError {
  constructor(message, participantId = null, participantName = null, options = {}) {
    super(message, {
      code: "PARTICIPANT_ERROR",
      context: { participantId, participantName, ...options.context },
      severity: "error",
      ...options
    });
  }
}

/**
 * Authentication and authorization errors
 */
export class KubicAuthenticationError extends KubicKodeError {
  constructor(message, token = null, options = {}) {
    super(message, {
      code: "AUTHENTICATION_ERROR",
      context: { token: token ? "***" : null, ...options.context },
      severity: "error",
      ...options
    });
  }
}

/**
 * Network and communication errors
 */
export class KubicNetworkError extends KubicKodeError {
  constructor(message, url = null, status = null, options = {}) {
    super(message, {
      code: "NETWORK_ERROR",
      context: { url, status, ...options.context },
      severity: "error",
      ...options
    });
  }
}

/**
 * State machine errors
 */
export class KubicStateError extends KubicKodeError {
  constructor(message, currentState = null, targetState = null, options = {}) {
    super(message, {
      code: "STATE_ERROR",
      context: { currentState, targetState, ...options.context },
      severity: "error",
      ...options
    });
  }
}

/**
 * Resource not found errors
 */
export class KubicNotFoundError extends KubicKodeError {
  constructor(message, resourceType = null, resourceId = null, options = {}) {
    super(message, {
      code: "NOT_FOUND_ERROR",
      context: { resourceType, resourceId, ...options.context },
      severity: "warn",
      ...options
    });
  }
}

/**
 * Resource already exists errors
 */
export class KubicConflictError extends KubicKodeError {
  constructor(message, resourceType = null, resourceId = null, options = {}) {
    super(message, {
      code: "CONFLICT_ERROR",
      context: { resourceType, resourceId, ...options.context },
      severity: "warn",
      ...options
    });
  }
}

/**
 * Permission and access control errors
 */
export class KubicPermissionError extends KubicKodeError {
  constructor(message, action = null, resource = null, options = {}) {
    super(message, {
      code: "PERMISSION_ERROR",
      context: { action, resource, ...options.context },
      severity: "error",
      ...options
    });
  }
}

/**
 * System and internal errors
 */
export class KubicSystemError extends KubicKodeError {
  constructor(message, component = null, options = {}) {
    super(message, {
      code: "SYSTEM_ERROR",
      context: { component, ...options.context },
      severity: "error",
      ...options
    });
  }
}

/**
 * WebSocket and real-time communication errors
 */
export class KubicWebSocketError extends KubicKodeError {
  constructor(message, event = null, connectionId = null, options = {}) {
    super(message, {
      code: "WEBSOCKET_ERROR",
      context: { event, connectionId, ...options.context },
      severity: "error",
      ...options
    });
  }
}

/**
 * Game options and configuration errors
 */
export class KubicGameOptionsError extends KubicKodeError {
  constructor(message, option = null, namespace = null, value = null, options = {}) {
    super(message, {
      code: "GAME_OPTIONS_ERROR",
      context: { option, namespace, value, ...options.context },
      severity: "warn",
      ...options
    });
  }
}

/**
 * Contract compliance errors for game interface validation
 */
export class KubicContractError extends KubicKodeError {
  constructor(message, component = null, className = null, options = {}) {
    super(message, {
      code: "CONTRACT_ERROR",
      context: { component, className, ...options.context },
      severity: "error",
      ...options
    });
  }
}

/**
 * Error factory for creating specific error types
 */
export class ErrorFactory {
  /**
   * Create a validation error
   */
  static validation(message, field = null, value = null, context = {}) {
    return new KubicValidationError(message, field, value, { context });
  }

  /**
   * Create a session error
   */
  static session(message, sessionId = null, context = {}) {
    return new KubicSessionError(message, sessionId, { context });
  }

  /**
   * Create a game error
   */
  static game(message, gameId = null, playerId = null, context = {}) {
    return new KubicGameError(message, gameId, playerId, { context });
  }

  /**
   * Create a participant error
   */
  static participant(message, participantId = null, participantName = null, context = {}) {
    return new KubicParticipantError(message, participantId, participantName, { context });
  }

  /**
   * Create an authentication error
   */
  static authentication(message, token = null, context = {}) {
    return new KubicAuthenticationError(message, token, { context });
  }

  /**
   * Create a network error
   */
  static network(message, url = null, status = null, context = {}) {
    return new KubicNetworkError(message, url, status, { context });
  }

  /**
   * Create a not found error
   */
  static notFound(message, resourceType = null, resourceId = null, context = {}) {
    return new KubicNotFoundError(message, resourceType, resourceId, { context });
  }

  /**
   * Create a conflict error
   */
  static conflict(message, resourceType = null, resourceId = null, context = {}) {
    return new KubicConflictError(message, resourceType, resourceId, { context });
  }

  /**
   * Create a permission error
   */
  static permission(message, action = null, resource = null, context = {}) {
    return new KubicPermissionError(message, action, resource, { context });
  }

  /**
   * Create a system error
   */
  static system(message, component = null, context = {}) {
    return new KubicSystemError(message, component, { context });
  }

  /**
   * Create a WebSocket error
   */
  static websocket(message, event = null, connectionId = null, context = {}) {
    return new KubicWebSocketError(message, event, connectionId, { context });
  }

  /**
   * Create a game options error
   */
  static gameOptions(message, option = null, namespace = null, value = null, context = {}) {
    return new KubicGameOptionsError(message, option, namespace, value, { context });
  }

  /**
   * Create a contract error
   */
  static contract(message, component = null, className = null, context = {}) {
    return new KubicContractError(message, component, className, { context });
  }
}

/**
 * Error codes enumeration for consistent error handling
 */
export const ErrorCodes = {
  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",
  
  // Configuration errors
  CONFIGURATION_ERROR: "CONFIGURATION_ERROR",
  INVALID_OPTION: "INVALID_OPTION",
  MISSING_CONFIGURATION: "MISSING_CONFIGURATION",
  
  // Session errors
  SESSION_ERROR: "SESSION_ERROR",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_FULL: "SESSION_FULL",
  SESSION_ALREADY_STARTED: "SESSION_ALREADY_STARTED",
  SESSION_NOT_STARTED: "SESSION_NOT_STARTED",
  
  // Game errors
  GAME_ERROR: "GAME_ERROR",
  GAME_NOT_FOUND: "GAME_NOT_FOUND",
  GAME_ALREADY_STARTED: "GAME_ALREADY_STARTED",
  GAME_NOT_STARTED: "GAME_NOT_STARTED",
  INVALID_MOVE: "INVALID_MOVE",
  NOT_PLAYER_TURN: "NOT_PLAYER_TURN",
  
  // Participant errors
  PARTICIPANT_ERROR: "PARTICIPANT_ERROR",
  PARTICIPANT_NOT_FOUND: "PARTICIPANT_NOT_FOUND",
  PARTICIPANT_NAME_EXISTS: "PARTICIPANT_NAME_EXISTS",
  PARTICIPANT_ALREADY_JOINED: "PARTICIPANT_ALREADY_JOINED",
  PARTICIPANT_NOT_PLAYABLE: "PARTICIPANT_NOT_PLAYABLE",
  
  // Authentication errors
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  INVALID_TOKEN: "INVALID_TOKEN",
  MISSING_TOKEN: "MISSING_TOKEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_MISMATCH: "TOKEN_MISMATCH",
  
  // Network errors
  NETWORK_ERROR: "NETWORK_ERROR",
  CONNECTION_FAILED: "CONNECTION_FAILED",
  TIMEOUT: "TIMEOUT",
  HTTP_ERROR: "HTTP_ERROR",
  
  // State errors
  STATE_ERROR: "STATE_ERROR",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  STATE_NOT_FOUND: "STATE_NOT_FOUND",
  
  // Resource errors
  NOT_FOUND_ERROR: "NOT_FOUND_ERROR",
  CONFLICT_ERROR: "CONFLICT_ERROR",
  RESOURCE_EXISTS: "RESOURCE_EXISTS",
  
  // Permission errors
  PERMISSION_ERROR: "PERMISSION_ERROR",
  ACCESS_DENIED: "ACCESS_DENIED",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  
  // System errors
  SYSTEM_ERROR: "SYSTEM_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  
  // WebSocket errors
  WEBSOCKET_ERROR: "WEBSOCKET_ERROR",
  WEBSOCKET_CONNECTION_FAILED: "WEBSOCKET_CONNECTION_FAILED",
  WEBSOCKET_MESSAGE_ERROR: "WEBSOCKET_MESSAGE_ERROR",
  
  // Game options errors
  GAME_OPTIONS_ERROR: "GAME_OPTIONS_ERROR",
  OPTION_NOT_FOUND: "OPTION_NOT_FOUND",
  OPTION_LOCKED: "OPTION_LOCKED",
  INVALID_OPTION_VALUE: "INVALID_OPTION_VALUE",
  
  // Contract errors
  CONTRACT_ERROR: "CONTRACT_ERROR",
  MISSING_REQUIRED_METHOD: "MISSING_REQUIRED_METHOD",
  INVALID_INTERFACE: "INVALID_INTERFACE"
};

/**
 * Utility function to wrap async functions with error handling
 * @param {Function} fn - The async function to wrap
 * @param {string} context - Context for error messages
 * @returns {Function} Wrapped function with error handling
 */
export function withErrorHandling(fn, context = "Unknown") {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof KubicKodeError) {
        throw error;
      }
      
      throw KubicKodeError.fromError(error, {
        code: ErrorCodes.INTERNAL_ERROR,
        context: { functionContext: context, args: args.length }
      });
    }
  };
}

/**
 * Utility function to create error responses for API endpoints
 * @param {Error} error - The error to convert
 * @returns {Object} Standardized error response
 */
export function createErrorResponse(error) {
  if (error instanceof KubicKodeError) {
    return error.toResponse();
  }
  
  // Convert standard errors to KubicKodeError format
  const kubicError = KubicKodeError.fromError(error);
  return kubicError.toResponse();
}
