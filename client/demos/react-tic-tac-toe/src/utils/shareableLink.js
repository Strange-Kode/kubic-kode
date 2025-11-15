/**
 * Shareable Link Utility
 * Handles KubicKode configuration and shareable session link generation
 */

/**
 * Get shareable session link from KubicKode
 * Ensures KubicKode is configured with frontend URL before generating link
 * @returns {Object} Result object with success status and link data
 * @throws {Error} If KubicKode is not initialized
 */
export function getShareableLink() {
  if (!window.KubicKode) {
    throw new Error("KubicKode not initialized");
  }

  // Ensure frontendUrl is configured
  if (!window.KubicKode.config.frontendUrl) {
    window.KubicKode.configure({
      frontendUrl: import.meta.env.VITE_FRONTEND_URL || window.location.origin,
    });
  }

  // Get shareable link from KubicKode SDK
  return window.KubicKode.getShareableSessionLink();
}
