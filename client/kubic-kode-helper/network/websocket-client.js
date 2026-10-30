import {
  HEARTBEAT_INTERVAL,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_JITTER_MS,
  RECONNECT_MAX_DELAY_MS,
  WS_CLOSE_NORMAL,
  WS_CLOSE_UNAUTHORIZED,
} from '../core/constants.js';

/**
 * WebSocket Client factory function
 * Creates a WebSocket client for real-time communication
 *
 * Lifecycle: at most one live socket, owned here. `release()` is the only way
 * a socket stops being ours; it detaches the handlers before closing, so
 * nothing a released socket does afterwards (a late close event, a queued
 * message) reaches the helper or schedules a reconnect. `helper.websocket`
 * mirrors the live socket for readers outside this module: a socket that is
 * connecting, open or closing, or null - including while a reconnect is
 * pending.
 *
 * @param {Object} helper - Reference to the main KubicKodeHelper instance
 * @returns {Object} WebSocket client with connection management methods
 */
export function createWebSocketClient(helper) {
  let socket = null;
  let heartbeatTimer = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let hasConnectedBefore = false;

  const setSocket = (next) => {
    socket = next;
    helper.websocket = next;
  };

  const clearHeartbeatTimer = () => {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  };

  const cancelReconnect = () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  };

  const release = (code, reason) => {
    cancelReconnect();
    clearHeartbeatTimer();
    if (!socket) return;
    const released = socket;
    setSocket(null);
    released.onopen = null;
    released.onmessage = null;
    released.onclose = null;
    released.onerror = null;
    released.close(code, reason);
  };

  const buildUrl = () => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostPort = helper.config.websocketPort ?? "3000";
    const portSegment = hostPort ? `:${hostPort}` : "";
    const wsPath = helper.config.websocketPath || "/";
    const url = new URL(`${protocol}//${window.location.hostname}${portSegment}${wsPath}`);
    url.searchParams.set("sessionId", helper.sessionId);
    if (helper.participantId) {
      url.searchParams.set("participantId", helper.participantId);
      if (helper.gameToken) {
        url.searchParams.set("gameToken", helper.gameToken);
      }
    }
    return url.toString();
  };

  /* Exponential backoff with jitter: a server that is down or restarting must
     not see every open tab retry in lockstep once per second */
  const nextReconnectDelay = () => {
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts, RECONNECT_MAX_DELAY_MS);
    reconnectAttempts += 1;
    return delay + Math.floor(Math.random() * RECONNECT_JITTER_MS);
  };

  return {
    /**
     * Initialize WebSocket connection for real-time events. Replaces a live
     * socket cleanly; the replaced socket never emits websocketDisconnected.
     * @returns {Object} Helper reference for chaining
     */
    connect() {
      if (!helper.sessionId) {
        return helper;
      }

      release(WS_CLOSE_NORMAL, "Replaced");

      const next = new WebSocket(buildUrl());
      setSocket(next);

      next.onopen = () => {
        const isReconnect = hasConnectedBefore;
        hasConnectedBefore = true;
        helper._hasConnectedBefore = true;
        reconnectAttempts = 0;

        helper.events.emit("websocketConnected", { isReconnect });

        // Start heartbeat if we have participant ID
        if (helper.participantId) {
          this.startHeartbeat();
        }
      };

      next.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle heartbeat responses (support both old and new namespaces for backwards compatibility)
          if (data.type === "heartbeat" || data.type === "kubic::heartbeat") {
            this.handleHeartbeat(data);
          } else if (data.type === "heartbeatResponse" || data.type === "kubic::heartbeatResponse") {
            this.handleHeartbeatResponse(data);
          } else if (data.type === "kubic::sessionEnded") {
            // Special handling for session ended - stop heartbeat
            helper.events.emit(data.type, data.payload);
            this.stopHeartbeat();
          } else {
            // Emit all other events with their full type name (preserves kubic:: prefix)
            helper.events.emit(data.type, data.payload);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      // Only a live socket still has this handler: release() detaches it first
      next.onclose = (event) => {
        setSocket(null);
        clearHeartbeatTimer();

        // Armed before the event goes out, so a listener that reconnects
        // synchronously cancels this timer instead of racing it
        const isRetryable = event.code !== WS_CLOSE_NORMAL && event.code !== WS_CLOSE_UNAUTHORIZED;
        if (helper.config.autoReconnect && isRetryable) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            this.connect();
          }, nextReconnectDelay());
        }

        helper.events.emit("websocketDisconnected", event);
      };

      next.onerror = (error) => {
        console.error("WebSocket error:", error);
        helper.events.emit("websocketError", error);
      };

      return helper;
    },

    /**
     * Whether a socket is connecting, open or closing. False while a reconnect
     * is pending, so a caller that wants a connection now can call connect().
     * @returns {boolean}
     */
    hasLiveSocket() {
      return socket !== null;
    },

    /**
     * Start heartbeat to keep connection alive
     */
    startHeartbeat() {
      clearHeartbeatTimer();
      heartbeatTimer = setInterval(() => {
        this.sendHeartbeat();
      }, HEARTBEAT_INTERVAL);
    },

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
      clearHeartbeatTimer();
    },

    /**
     * Send heartbeat to server
     */
    sendHeartbeat() {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "heartbeat",
            payload: { timestamp: Date.now() },
          })
        );
      }
    },

    /**
     * Handle incoming heartbeat from server
     * @param {Object} data - The heartbeat data
     */
    handleHeartbeat(data) {
      // Respond to server heartbeat
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "heartbeat",
            payload: { timestamp: Date.now() },
          })
        );
      }
    },

    /**
     * Handle heartbeat response from server
     * @param {Object} data - The heartbeat response data
     */
    handleHeartbeatResponse(data) {
      // Server confirmed our heartbeat
    },

    /**
     * Send REST heartbeat to server
     */
    async sendRestHeartbeat() {
      if (!helper.sessionId || !helper.participantId) {
        return;
      }

      try {
        const response = await helper.http.makeRequest(
          "POST",
          `/session/${helper.sessionId}/heartbeat`,
          {
            participantId: helper.participantId,
          }
        );
      } catch (error) {
        console.error("💓 REST heartbeat failed:", error);
      }
    },

    /**
     * Disconnect WebSocket connection. Closes cleanly, cancels a pending
     * reconnect, and leaves config untouched so the next session reconnects
     * normally. The next connect() reports isReconnect: false.
     * @returns {Object} Helper reference for chaining
     */
    disconnect() {
      release(WS_CLOSE_NORMAL, "Manual disconnect");
      hasConnectedBefore = false;
      helper._hasConnectedBefore = false;
      reconnectAttempts = 0;
      return helper;
    }
  };
}
