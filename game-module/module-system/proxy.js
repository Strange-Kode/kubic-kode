import registry from './registry.js';

/**
 * The proxy allows you to access modules directly:
 * 
 * Example:
 * modules.auth.login()
 */
export const modules = new Proxy({}, {
  get(target, prop) {
    const mod = registry.getModule(prop);
    if (!mod) {
      throw new Error(`Module '${prop}' not found.`);
    }
    return mod;
  }
});
