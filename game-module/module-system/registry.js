import fs from 'fs';
import path from 'path';
import chokidar from 'chokidar';
import { run as runHooks } from './hooks.js';

const modules = {};
const watchers = {};
let moduleBasePath = '';

export async function initRegistry(basePath, { watch = true } = {}) {
  moduleBasePath = basePath;
  const files = fs.readdirSync(basePath);

  for (const file of files) {
    if (file.endsWith('.js')) {
      const fileName = path.basename(file, '.js');
      await loadModule(fileName, { lockOnReload: false });
    }
  }

  if (watch) {
    chokidar.watch(basePath).on('change', async filePath => {
      const fileName = path.basename(filePath, '.js');
      await reloadModule(fileName);
    });
  }
}

export async function loadModule(fileName, { lockOnReload = false } = {}) {
  const filePath = path.join(moduleBasePath, `${fileName}.js`);
  
  // Strip '-module' suffix from fileName to get the module name
  // e.g., 'auth-module' => 'auth', 'game-module' => 'game'
  const modName = fileName.endsWith('-module') ? fileName.slice(0, -7) : fileName;

  await runHooks('before:load', modName);

  const mod = await import(filePath + `?t=${Date.now()}`);
  const instance = mod.default || mod;

  if (typeof instance.validate === 'function') {
    await instance.validate();
  }

  if (typeof instance.init === 'function') {
    await instance.init();
  }

  modules[modName] = instance;

  await runHooks('after:load', modName);
  return instance;
}

export async function reloadModule(fileName) {
  // Strip '-module' suffix to get the actual module name for lookup
  const modName = fileName.endsWith('-module') ? fileName.slice(0, -7) : fileName;
  
  if (!modules[modName]) return;

  await runHooks('before:reload', modName);
  await loadModule(fileName);
  await runHooks('after:reload', modName);
}

export function getModule(modName) {
  return modules[modName];
}

/**
 * Register a module programmatically (useful for client extensions)
 * @param {string} moduleName - The name of the module (e.g., 'myCustom')
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
    throw new Error(`Module '${moduleName}' is already registered. Use reloadModule or unregisterModule first.`);
  }
  
  await runHooks('before:load', moduleName);
  
  // Validate if not skipped
  if (!skipValidation && typeof moduleInstance.validate === 'function') {
    await moduleInstance.validate();
  }
  
  // Initialize if not skipped
  if (!skipInit && typeof moduleInstance.init === 'function') {
    await moduleInstance.init();
  }
  
  modules[moduleName] = moduleInstance;
  
  await runHooks('after:load', moduleName);
  return moduleInstance;
}

/**
 * Unregister a module programmatically
 * @param {string} moduleName - The name of the module to unregister
 * @returns {boolean} True if module was unregistered, false if it didn't exist
 */
export function unregisterModule(moduleName) {
  if (!modules[moduleName]) {
    return false;
  }
  
  delete modules[moduleName];
  return true;
}

export default { initRegistry, loadModule, reloadModule, getModule, registerModule, unregisterModule };
