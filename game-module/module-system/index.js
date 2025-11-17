import * as hooks from "./hooks.js";
import * as registry from "./registry.js";
import { modules } from "./proxy.js";

export async function initModuleSystem(basePath) {
  await registry.initRegistry(basePath, { watch: true });
}

export { hooks, registry, modules };

// Re-export registerModule and unregisterModule for convenience
export { 
  registerModule, 
  unregisterModule,
  getModuleState,
  getModuleError,
  isModuleInError,
  ModuleState
} from "./registry.js";