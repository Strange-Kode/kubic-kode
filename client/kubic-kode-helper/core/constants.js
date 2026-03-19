/**
 * Default configuration for KubicKode client
 */
export const DEFAULT_CONFIG = {
  apiPrefix: "/api",
  websocketPort: "3000", // Backend WebSocket server port (should match KUBIC_PORT in backend .env)
  websocketPath: "/",    // WebSocket connection path (override for reverse-proxy setups)
  frontendUrl: null, // Frontend base URL for shareable links
  defaultGame: null,
  autoReconnect: true,
  retryAttempts: 3,
  retryDelay: 1000,
  /** When false, event handlers skip auto-fetching game state (tilemap, currentPlayer, etc.).
   *  Non-fetch side effects (state flags, inactivity timers, events) still run.
   *  Set to false when the host app manages its own state sync. */
  autoFetchOnEvents: true,
};

/**
 * Auto-start modes for game flow
 */
export const AUTO_START_MODES = {
  MANUAL: "manual", // Never auto-start - requires manual intervention
  IMMEDIATE: "immediate", // Start as soon as session has at least one participant
  ON_AI: "on-ai", // Auto-start only when an AI opponent joins
  ON_FULL: "on-full", // Auto-start when max players reached (default)
};

/**
 * WebSocket heartbeat interval in milliseconds
 */
export const HEARTBEAT_INTERVAL = 25000; // 25 seconds
