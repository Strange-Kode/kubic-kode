import * as hooks from "./hooks.js";
import * as registry from "./registry.js";
import { modules } from "./proxy.js";
import { createRequire } from "module";
import path from "path";

export async function initModuleSystem(basePath) {
  await registry.initRegistry(basePath, { watch: true });
}

/**
 * Get the default modules path for kubic-kode package.
 * This resolves to the package's game-module/modules directory,
 * useful when using npm link or when importing from external projects.
 * 
 * This function resolves the kubic-kode package location from the caller's
 * module resolution context, so it works correctly with npm link.
 * 
 * @returns {string} Absolute path to kubic-kode's modules directory
 */
export function getKubicKodeModulesPath() {
  // Use createRequire with a file URL to create a require function
  // that can resolve modules. We use a dummy file path to ensure
  // it resolves from the current working directory context.
  try {
    // Try to resolve from the current working directory (caller's project)
    const require = createRequire(process.cwd() + "/package.json");
    const packagePath = require.resolve("kubic-kode/package.json");
    return path.resolve(path.dirname(packagePath), "game-module", "modules");
  } catch (error) {
    // Fallback: resolve from this file's location (when called from within kubic-kode)
    const require = createRequire(import.meta.url);
    const packagePath = require.resolve("./../../package.json");
    return path.resolve(path.dirname(packagePath), "game-module", "modules");
  }
}

export { hooks, registry, modules };

// Re-export registerModule and unregisterModule for convenience
export { 
  registerModule, 
  unregisterModule,
  loadModulesFromDirectory,
  getModuleState,
  getModuleError,
  isModuleInError,
  ModuleState
} from "./registry.js";