const hooks = new Map();

/**
 * Registers a hook callback under a specific name.
 * 
 * Example:
 * hooks.register('before:auth.login', fn);
 */
export function register(name, callback) {
  if (!hooks.has(name)) {
    hooks.set(name, new Set());
  }
  hooks.get(name).add(callback);
}

/**
 * Executes all hook callbacks for a given name.
 */
export async function run(name, ...args) {
  const fns = hooks.get(name);
  if (!fns) return;

  for (const fn of fns) {
    await fn(...args);
  }
}

/**
 * Removes a hook callback.
 */
export function unregister(name, callback) {
  const fns = hooks.get(name);
  if (fns) fns.delete(callback);
}

/**
 * Clears all hooks.
 */
export function clear() {
  hooks.clear();
}

export default { register, run, unregister, clear };
