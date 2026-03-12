import { HEARTBEAT_INTERVAL } from '../core/constants.js';

/**
 * WebSocket Client factory function
 * Creates a WebSocket client for real-time communication
 *
 * @param {Object} helper - Reference to the main KubicKodeHelper instance
 * @returns {Object} WebSocket client with connection management methods
 */
export function createWebSocketClient(helper) {
  return {
    /**
     * Initialize WebSocket connection for real-time events
     * @returns {Object} Helper reference for chaining
     */
    connect() {
      if (!helper.sessionId) {
        return helper;
      }

      if (helper.websocket) {
        helper.websocket.close();
      }

      // Construct WebSocket URL with participant ID for connection tracking
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";

      const hostIP = window.location.hostname;
      const hostPort = helper.config.websocketPort ?? "3000";
      const portSegment = hostPort ? `:${hostPort}` : "";
      const wsPath = helper.config.websocketPath || "/";

      let wsUrl = `${protocol}://${hostIP}${portSegment}${wsPath}?sessionId=${helper.sessionId}`;
      if (helper.participantId) {
        wsUrl += `&participantId=${helper.participantId}`;
      }

      helper.websocket = new WebSocket(wsUrl);

      // Send participant name when WebSocket opens
      helper.websocket.onopen = () => {
        const isReconnect = helper._hasConnectedBefore === true;
        helper._hasConnectedBefore = true;

        helper.events.emit("websocketConnected", { isReconnect });

        // Start heartbeat if we have participant ID
        if (helper.participantId) {
          this.startHeartbeat();
        }
      };

      helper.websocket.onmessage = (event) => {
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

      helper.websocket.onclose = (event) => {
        helper.events.emit("websocketDisconnected", event);

        // Stop heartbeat on disconnect
        this.stopHeartbeat();

        // Only reconnect if autoReconnect is enabled and it's not a manual close
        if (helper.config.autoReconnect && event.code !== 1000) {
          setTimeout(() => this.connect(), 1000);
        }
      };

      helper.websocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        helper.events.emit("websocketError", error);
      };

      return helper;
    },

    /**
     * Start heartbeat to keep connection alive
     */
    startHeartbeat() {
      if (helper.heartbeatInterval) {
        this.stopHeartbeat();
      }

      helper.heartbeatInterval = setInterval(() => {
        this.sendHeartbeat();
      }, HEARTBEAT_INTERVAL);
    },

    /**
     * Stop heartbeat
     */
    stopHeartbeat() {
      if (helper.heartbeatInterval) {
        clearInterval(helper.heartbeatInterval);
        helper.heartbeatInterval = null;
      }
    },

    /**
     * Send heartbeat to server
     */
    sendHeartbeat() {
      if (helper.websocket && helper.websocket.readyState === WebSocket.OPEN) {
        helper.websocket.send(
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
      if (helper.websocket && helper.websocket.readyState === WebSocket.OPEN) {
        helper.websocket.send(
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
     * Disconnect WebSocket connection
     * @returns {Object} Helper reference for chaining
     */
    disconnect() {
      if (helper.websocket) {
        helper.config.autoReconnect = false; // Prevent auto-reconnection
        helper.websocket.close(1000, "Manual disconnect");
        helper.websocket = null;
      }
      return helper;
    }
  };
}
