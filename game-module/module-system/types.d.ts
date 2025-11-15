declare module "module-system" {
    export interface Module {
      init?(): Promise<void> | void;
      validate?(): Promise<void> | void;
      teardown?(): Promise<void> | void;
    }
  
    export interface Hooks {
      register(name: string, fn: (...args: any[]) => any): void;
      run(name: string, ...args: any[]): Promise<void>;
      unregister(name: string, fn: (...args: any[]) => any): void;
      clear(): void;
    }

    export interface ModuleError {
      message: string;
      stack?: string;
      timestamp: string;
    }

    export enum ModuleState {
      LOADING = "loading",
      LOADED = "loaded",
      ERROR = "error"
    }
  
    export const modules: Record<string, any>;
    export const hooks: Hooks;
    export function initModuleSystem(basePath: string): Promise<void>;
    export function registerModule(moduleName: string, moduleInstance: Module, options?: { skipValidation?: boolean; skipInit?: boolean }): Promise<Module>;
    export function unregisterModule(moduleName: string): Promise<boolean>;
    export function getModuleState(modName: string): ModuleState | null;
    export function getModuleError(modName: string): ModuleError | null;
    export function isModuleInError(modName: string): boolean;
  }
