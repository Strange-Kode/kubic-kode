import registry from "./registry.js";
import { ModuleState } from "./registry.js";

/**
 * Convert kebab-case to camelCase
 * @param {string} str - String in kebab-case
 * @returns {string} String in camelCase
 */
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * The proxy allows you to access modules directly:
 * 
 * Example:
 * modules.auth.login()
 * modules.tilemapNoise.doSomething() // from tilemap-noise-module.js
 */
export const modules = new Proxy({}, {
  get(target, prop) {
    // If property contains dashes, convert to camelCase and check if that exists
    if (typeof prop === 'string' && prop.includes('-')) {
      const camelCaseName = kebabToCamel(prop);
      const camelCaseMod = registry.getModule(camelCaseName);
      
      if (camelCaseMod) {
        // Module exists with camelCase name - provide helpful error
        throw new Error(
          `Module "${prop}" not found. Did you mean to use modules.${camelCaseName}? ` +
          `(Module names are automatically converted from kebab-case to camelCase)`
        );
      }
    }

    // Check if module is in error state first
    const state = registry.getModuleState(prop);
    if (state === ModuleState.ERROR) {
      const errorInfo = registry.getModuleError(prop);
      const errorMessage = errorInfo 
        ? `Module "${prop}" is in error state: ${errorInfo.message}`
        : `Module "${prop}" is in error state`;
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
        throw new Error(`Module "${prop}" is currently loading. Please wait.`);
      }
      throw new Error(`Module "${prop}" not found.`);
    }
    return mod;
  }
});
