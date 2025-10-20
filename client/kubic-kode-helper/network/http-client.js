import { KubicClientError } from "../core/errors.js";

/**
 * HTTP Client factory function
 * Creates an HTTP client with retry logic for making API requests
 *
 * @param {Object} helper - Reference to the main KubicKodeHelper instance
 * @returns {Object} HTTP client with makeRequest method
 */
export function createHttpClient(helper) {
  return {
    /**
     * Make HTTP request with retry logic
     * @param {string} method - The HTTP method (GET, POST, etc.)
     * @param {string} endpoint - The API endpoint
     * @param {Object} data - The request data (for non-GET requests)
     * @returns {Promise<Object>} The response object
     * @throws {Error} If all retry attempts fail
     */
    async makeRequest(method, endpoint, data = null) {
      const url = `${helper.config.apiPrefix}${endpoint}`;
      const options = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (data && method !== "GET") {
        options.body = JSON.stringify(data);
      }

      let lastError;

      for (let attempt = 1; attempt <= helper.config.retryAttempts; attempt++) {
        try {
          const response = await fetch(url, options);

          if (!response.ok) {
            throw new KubicClientError(
              `HTTP ${response.status}: ${response.statusText}`,
              "HTTP_ERROR",
              {
                status: response.status,
                statusText: response.statusText,
                url,
                method,
              }
            );
          }

          const result = await response.json();

          // Auto-set sessionId from init response
          if (endpoint.includes("/session/init/") && result.session_id) {
            helper.sessionId = result.session_id;
            helper.events.emit("sessionInitialized", {
              sessionId: helper.sessionId,
            });
          }

          return {
            success: true,
            data: result,
          };
        } catch (error) {
          lastError = error;
          console.warn(`Request attempt ${attempt} failed:`, error.message);

          if (attempt < helper.config.retryAttempts) {
            await new Promise((resolve) =>
              setTimeout(resolve, helper.config.retryDelay)
            );
          }
        }
      }

      throw lastError;
    },
  };
}
