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

export default { initRegistry, loadModule, reloadModule, getModule };
