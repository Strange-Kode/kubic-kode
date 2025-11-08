declare module 'module-system' {
    export interface Module {
      init?(): Promise<void> | void;
      validate?(): Promise<void> | void;
    }
  
    export interface Hooks {
      register(name: string, fn: (...args: any[]) => any): void;
      run(name: string, ...args: any[]): Promise<void>;
      unregister(name: string, fn: (...args: any[]) => any): void;
      clear(): void;
    }
  
    export const modules: Record<string, any>;
    export const hooks: Hooks;
    export function initModuleSystem(basePath: string): Promise<void>;
  }
