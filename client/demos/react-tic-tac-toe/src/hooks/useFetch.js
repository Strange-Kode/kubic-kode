import { useState, useCallback } from "react";

/**
 * Custom hook for centralized API fetching with consistent error handling and logging
 * Provides loading states and standardized error formatting
 */
export function useFetch() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Core fetch logic with error handling and logging
  const fetchData = useCallback(async (url, options = {}) => {
    const method = options.method || "GET";

    // console.log(`[useFetch] ${method} ${url} - Starting request`);

    setIsLoading(true);
    setError(null);

    try {
      // Perform the fetch with JSON headers by default
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      // Handle non-2xx responses as errors
      if (!response.ok) {
        const errorData = await response.text();
        const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        console.error(
          `[useFetch] ${method} ${url} → ${response.status}`,
          errorData
        );
        throw new Error(errorMessage);
      }

      // Parse JSON response
      const data = await response.json();
      // console.log(`[useFetch] ${method} ${url} → ${response.status}`);

      setIsLoading(false);
      return { data, success: true };
    } catch (err) {
      // Log and store error
      console.error(`[useFetch] ${method} ${url} → ERROR:`, err.message);

      setError(err.message);
      setIsLoading(false);
      return { error: err.message, success: false };
    }
  }, []);

  // Shorthand for GET requests
  const get = useCallback((url) => fetchData(url), [fetchData]);

  // Shorthand for POST requests with JSON body
  const post = useCallback(
    (url, body) =>
      fetchData(url, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    [fetchData]
  );

  // Shorthand for PUT requests with JSON body
  const put = useCallback(
    (url, body) =>
      fetchData(url, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    [fetchData]
  );

  // Shorthand for DELETE requests
  const del = useCallback(
    (url) =>
      fetchData(url, {
        method: "DELETE",
      }),
    [fetchData]
  );

  // Expose helpers and state
  return {
    isLoading,
    error,
    get,
    post,
    put,
    delete: del,
    fetchData,
  };
}
