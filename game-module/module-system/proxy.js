import registry from './registry.js';
import { ModuleState } from './registry.js';

/**
 * The proxy allows you to access modules directly:
 * 
 * Example:
 * modules.auth.login()
 */
export const modules = new Proxy({}, {
  get(target, prop) {
    // Check if module is in error state first
    const state = registry.getModuleState(prop);
    if (state === ModuleState.ERROR) {
      const errorInfo = registry.getModuleError(prop);
      const errorMessage = errorInfo 
        ? `Module '${prop}' is in error state: ${errorInfo.message}`
        : `Module '${prop}' is in error state`;
      const error = new Error(errorMessage);
      if (errorInfo) {
        error.stack = errorInfo.stack;
        error.timestamp = errorInfo.timestamp;
      }
      throw error;
    }

    const mod = registry.getModule(prop);
    if (!mod) {
      // Check if it's loading
      if (state === ModuleState.LOADING) {
        throw new Error(`Module '${prop}' is currently loading. Please wait.`);
      }
      throw new Error(`Module '${prop}' not found.`);
    }
    return mod;
  }
});
