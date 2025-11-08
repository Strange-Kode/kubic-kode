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
      const modName = path.basename(file, '.js');
      await loadModule(modName, { lockOnReload: false });
    }
  }

  if (watch) {
    chokidar.watch(basePath).on('change', async filePath => {
      const modName = path.basename(filePath, '.js');
      await reloadModule(modName);
    });
  }
}

export async function loadModule(modName, { lockOnReload = false } = {}) {
  const filePath = path.join(moduleBasePath, `${modName}.js`);

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

export async function reloadModule(modName) {
  if (!modules[modName]) return;

  await runHooks('before:reload', modName);
  await loadModule(modName);
  await runHooks('after:reload', modName);
}

export function getModule(modName) {
  return modules[modName];
}

export default { initRegistry, loadModule, reloadModule, getModule };
