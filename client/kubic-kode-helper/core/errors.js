/**
 * Custom error class for KubicKode client-side errors
 */
export class KubicClientError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = "KubicClientError";
    this.code = code;
    this.context = context;
    this.timestamp = new Date().toISOString();
  }
}
