/**
 * KubicKode Helper - UMD Wrapper
 * Provides universal module compatibility for browser and Node.js environments
 *
 * Available as:
 * - ES6 module: import { KubicKode, KubicKodeHelper } from "./kubic-kode-helper/index.js"
 * - CommonJS: const { KubicKode, KubicKodeHelper } = require("./kubic-kode-helper/index.js")
 * - Browser global: window.KubicKode, window.KubicKodeHelper
 */

import { KubicKodeHelper } from './core/KubicKodeHelper.js';
import { KubicClientError } from './core/errors.js';

// Create the singleton instance
const KubicKode = new KubicKodeHelper();

// ES6 module exports (for modern environments)
export { KubicKode, KubicKodeHelper, KubicClientError };

// UMD pattern for legacy compatibility (CommonJS, AMD, browser globals)
(function (global, factory) {
  if (typeof module === "object" && typeof module.exports === "object") {
    // CommonJS
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    // AMD
    define(factory);
  } else if (typeof window !== "undefined") {
    // Browser global
    const result = factory();
    global.KubicKode = result.KubicKode;
    global.KubicKodeHelper = result.KubicKodeHelper;
    global.KubicClientError = result.KubicClientError;
  }
})(typeof window !== "undefined" ? window : this, function () {
  return {
    KubicKode: KubicKode,
    KubicKodeHelper: KubicKodeHelper,
    KubicClientError: KubicClientError,
  };
});
