import fs from "fs";
import path from "path";
import chokidar from "chokidar";
import { run as runHooks } from "./hooks.js";
import { kubicLog } from "../../kubic-log.js";

const modules = {};
const moduleStates = {}; // Track module states: "loading", "loaded", "error"
const moduleErrors = {}; // Store error information for failed modules
const watchers = {};
let moduleBasePath = "";

// Module state constants
export const ModuleState = {
  LOADING: "loading",
  LOADED: "loaded",
  ERROR: "error"
};

/**
 * Convert kebab-case to camelCase
 * @param {string} str - String in kebab-case
 * @returns {string} String in camelCase
 */
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Convert a module file name to its camelCase module name
 * Strips "-module" suffix and converts kebab-case to camelCase
 * @param {string} fileName - File name (without .js extension)
 * @returns {string} Module name in camelCase
 */
function fileNameToModuleName(fileName) {
  // Strip "-module" suffix if present
  let modName = fileName.endsWith("-module") ? fileName.slice(0, -7) : fileName;
  // Convert kebab-case to camelCase
  return kebabToCamel(modName);
}

export async function initRegistry(basePath, { watch = true } = {}) {
  moduleBasePath = basePath;
  const files = fs.readdirSync(basePath);

  for (const file of files) {
    if (file.endsWith(".js")) {
      const fileName = path.basename(file, ".js");
      try {
        await loadModule(fileName, { lockOnReload: false });
      } catch (error) {
        // Log error but continue loading other modules
        kubicLog.error(`[module-system] Failed to load module "${fileName}" during initialization:`, error.message);
      }
    }
  }

  if (watch) {
    chokidar.watch(basePath).on("change", async filePath => {
      const fileName = path.basename(filePath, ".js");
      try {
        await reloadModule(fileName);
      } catch (error) {
        // Error already logged in reloadModule, just catch to prevent crash
        kubicLog.debug(`[module-system] Reload failed for "${fileName}", previous version kept`);
      }
    });
  }
}

export async function loadModule(fileName, { lockOnReload = false } = {}) {
  const filePath = path.join(moduleBasePath, `${fileName}.js`);
  
  // Convert file name to camelCase module name
  // e.g., "auth-module" => "auth", "tilemap-noise-module" => "tilemapNoise"
  const modName = fileNameToModuleName(fileName);

  // Set state to loading
  moduleStates[modName] = ModuleState.LOADING;
  delete moduleErrors[modName];

  try {
    await runHooks("before:load", modName);

    const mod = await import(filePath + `?t=${Date.now()}`);
    const instance = mod.default || mod;

    if (typeof instance.validate === "function") {
      await instance.validate();
    }

    if (typeof instance.init === "function") {
      await instance.init();
    }

    modules[modName] = instance;
    moduleStates[modName] = ModuleState.LOADED;

    await runHooks("after:load", modName);
    kubicLog.info(`[module-system] Module "${modName}" loaded successfully`);
    return instance;
  } catch (error) {
    // Set error state and store error information
    moduleStates[modName] = ModuleState.ERROR;
    moduleErrors[modName] = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    // Don't overwrite existing module if this is a reload failure
    if (!modules[modName]) {
      delete modules[modName];
    }

    kubicLog.error(`[module-system] Failed to load module "${modName}":`, error.message);
    if (error.stack) {
      kubicLog.debug(`[module-system] Error stack for "${modName}":`, error.stack);
    }

    throw error;
  }
}

export async function reloadModule(fileName) {
  // Convert file name to camelCase module name for lookup
  const modName = fileNameToModuleName(fileName);
  
  if (!modules[modName]) {
    kubicLog.warn(`[module-system] Cannot reload module "${modName}": module not found`);
    return;
  }

  const oldInstance = modules[modName];

  try {
    await runHooks("before:reload", modName);

    // Call teardown if it exists before reloading
    if (typeof oldInstance.teardown === "function") {
      try {
        await oldInstance.teardown();
        kubicLog.debug(`[module-system] Teardown completed for module "${modName}"`);
      } catch (teardownError) {
        kubicLog.warn(`[module-system] Error during teardown of module "${modName}":`, teardownError.message);
        // Continue with reload even if teardown fails
      }
    }

    await loadModule(fileName);
    await runHooks("after:reload", modName);
    kubicLog.info(`[module-system] Module "${modName}" reloaded successfully`);
  } catch (error) {
    // On reload failure, keep the old module instance
    kubicLog.error(`[module-system] Failed to reload module "${modName}", keeping previous version:`, error.message);
    // Restore state to loaded if we had a previous instance
    if (oldInstance) {
      modules[modName] = oldInstance;
      moduleStates[modName] = ModuleState.LOADED;
    }
    throw error;
  }
}

export function getModule(modName) {
  return modules[modName];
}

/**
 * Get the state of a module
 * @param {string} modName - The module name
 * @returns {string|null} Module state ("loading", "loaded", "error") or null if module doesn't exist
 */
export function getModuleState(modName) {
  return moduleStates[modName] || null;
}

/**
 * Get error information for a module
 * @param {string} modName - The module name
 * @returns {Object|null} Error information or null if no error
 */
export function getModuleError(modName) {
  return moduleErrors[modName] || null;
}

/**
 * Check if a module is in an error state
 * @param {string} modName - The module name
 * @returns {boolean} True if module is in error state
 */
export function isModuleInError(modName) {
  return moduleStates[modName] === ModuleState.ERROR;
}

/**
 * Register a module programmatically (useful for client extensions)
 * @param {string} moduleName - The name of the module (e.g., "myCustom")
 * @param {Object} moduleInstance - The module instance object
 * @param {Object} options - Options for registration
 * @param {boolean} options.skipValidation - Skip validation step (default: false)
 * @param {boolean} options.skipInit - Skip init step (default: false)
 * @returns {Promise<Object>} The registered module instance
 */
export async function registerModule(moduleName, moduleInstance, options = {}) {
  const { skipValidation = false, skipInit = false } = options;
  
  // Check if module already exists
  if (modules[moduleName]) {
    throw new Error(`Module "${moduleName}" is already registered. Use reloadModule or unregisterModule first.`);
  }
  
  // Set state to loading
  moduleStates[moduleName] = ModuleState.LOADING;
  delete moduleErrors[moduleName];

  try {
    await runHooks("before:load", moduleName);
    
    // Validate if not skipped
    if (!skipValidation && typeof moduleInstance.validate === "function") {
      await moduleInstance.validate();
    }
    
    // Initialize if not skipped
    if (!skipInit && typeof moduleInstance.init === "function") {
      await moduleInstance.init();
    }
    
    modules[moduleName] = moduleInstance;
    moduleStates[moduleName] = ModuleState.LOADED;
    
    await runHooks("after:load", moduleName);
    kubicLog.info(`[module-system] Module "${moduleName}" registered successfully`);
    return moduleInstance;
  } catch (error) {
    // Set error state
    moduleStates[moduleName] = ModuleState.ERROR;
    moduleErrors[moduleName] = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    kubicLog.error(`[module-system] Failed to register module "${moduleName}":`, error.message);
    throw error;
  }
}

/**
 * Unregister a module programmatically
 * @param {string} moduleName - The name of the module to unregister
 * @returns {boolean} True if module was unregistered, false if it didn't exist
 */
export async function unregisterModule(moduleName) {
  if (!modules[moduleName]) {
    return false;
  }
  
  const instance = modules[moduleName];

  // Call teardown if it exists before unregistering
  if (typeof instance.teardown === "function") {
    try {
      await instance.teardown();
      kubicLog.debug(`[module-system] Teardown completed for module "${moduleName}"`);
    } catch (teardownError) {
      kubicLog.warn(`[module-system] Error during teardown of module "${moduleName}":`, teardownError.message);
      // Continue with unregistration even if teardown fails
    }
  }
  
  delete modules[moduleName];
  delete moduleStates[moduleName];
  delete moduleErrors[moduleName];
  
  kubicLog.info(`[module-system] Module "${moduleName}" unregistered`);
  return true;
}

/**
 * Load modules from an additional directory (useful for user-defined modules)
 * This can be called after initModuleSystem to load modules from a different directory
 * @param {string} directoryPath - Path to directory containing module files
 * @param {Object} options - Options for loading
 * @param {boolean} options.watch - Enable file watching for hot reload (default: false)
 * @returns {Promise<void>}
 */
export async function loadModulesFromDirectory(directoryPath, { watch = false } = {}) {
  if (!fs.existsSync(directoryPath)) {
    kubicLog.info(`[module-system] Directory "${directoryPath}" does not exist, skipping`);
    return;
  }

  const files = fs.readdirSync(directoryPath);
  
  for (const file of files) {
    if (file.endsWith('.js')) {
      const fileName = path.basename(file, '.js');
      const filePath = path.join(directoryPath, file);
      
      try {
        await runHooks('before:load', fileName);
        
        // Import the module
        const mod = await import(filePath + `?t=${Date.now()}`);
        const instance = mod.default || mod;
        
        // Convert file name to camelCase module name
        const modName = fileNameToModuleName(fileName);
        
        // Check if module already exists
        if (modules[modName]) {
          kubicLog.warn(`[module-system] Module "${modName}" already exists, skipping "${fileName}"`);
          continue;
        }
        
        // Validate if present
        if (typeof instance.validate === 'function') {
          await instance.validate();
        }
        
        // Initialize if present
        if (typeof instance.init === 'function') {
          await instance.init();
        }
        
        // Register the module
        modules[modName] = instance;
        moduleStates[modName] = ModuleState.LOADED;
        
        await runHooks('after:load', modName);
        kubicLog.info(`[module-system] Module "${modName}" loaded from "${directoryPath}"`);
      } catch (error) {
        const modName = fileNameToModuleName(fileName);
        
        moduleStates[modName] = ModuleState.ERROR;
        moduleErrors[modName] = {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        };
        
        kubicLog.error(`[module-system] Failed to load module "${fileName}" from "${directoryPath}":`, error.message);
        // Continue loading other modules even if one fails
      }
    }
  }
  
  // Set up file watching if requested
  if (watch) {
    if (watchers[directoryPath]) {
      await watchers[directoryPath].close();
    }
    
    watchers[directoryPath] = chokidar.watch(directoryPath).on('change', async filePath => {
      const fileName = path.basename(filePath, '.js');
      try {
        // Reload the module
        const mod = await import(filePath + `?t=${Date.now()}`);
        const instance = mod.default || mod;
        const modName = fileNameToModuleName(fileName);
        
        // Unregister old module if it exists
        if (modules[modName]) {
          delete modules[modName];
          delete moduleStates[modName];
          delete moduleErrors[modName];
        }
        
        // Re-register
        if (typeof instance.validate === 'function') {
          await instance.validate();
        }
        if (typeof instance.init === 'function') {
          await instance.init();
        }
        
        modules[modName] = instance;
        moduleStates[modName] = ModuleState.LOADED;
        kubicLog.info(`[module-system] Module "${modName}" reloaded from "${directoryPath}"`);
      } catch (error) {
        kubicLog.error(`[module-system] Failed to reload module "${fileName}":`, error.message);
      }
    });
  }
}

export default { 
  initRegistry, 
  loadModule, 
  reloadModule, 
  getModule, 
  registerModule, 
  unregisterModule,
  loadModulesFromDirectory,
  getModuleState,
  getModuleError,
  isModuleInError,
  ModuleState
};
