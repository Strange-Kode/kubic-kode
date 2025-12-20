# Module System Documentation

## Overview

The KubicKode Module System is a dynamic, extensible module loading and management system that enables modular architecture for game server functionality. Modules are automatically discovered, loaded, validated, and initialized, with support for hot-reloading during development.

## Key Features

- **Automatic Module Discovery**: Modules are automatically loaded from the `game-module/modules/` directory
- **Hot Reloading**: Modules are automatically reloaded when files change (development mode)
- **Lifecycle Hooks**: Built-in hooks for module loading, reloading, and custom events
- **Validation System**: Optional `validate()` method for dependency checking
- **Dynamic Registration**: Programmatic module registration for client extensions
- **User-Defined Modules**: Load custom modules from external projects using `loadModulesFromDirectory`
- **Automatic Naming**: Kebab-case file names are automatically converted to camelCase module names
- **Inter-Module Communication**: Modules can use other modules via the `modules` object
- **TypeScript Support**: Full TypeScript definitions for IDE autocomplete

## Architecture

### Core Components

- **`registry.js`**: Module loading, validation, and lifecycle management
- **`proxy.js`**: Dynamic module access via Proxy pattern
- **`hooks.js`**: Event system for module lifecycle and custom hooks
- **`index.js`**: Main entry point exporting all module system functionality

### Module Structure

A module is a JavaScript file that exports a default object with optional lifecycle methods:

```javascript
export default {
  // Optional: Validate dependencies before initialization
  async validate() {
    // Check dependencies, throw errors if requirements not met
  },
  
  // Optional: Initialize module (called after validation)
  async init() {
    // Set up module, register hooks, etc.
  },
  
  // Your module methods
  myMethod() {
    // Module functionality
  }
};
```

## Module Lifecycle

### Loading Process

1. **File Discovery**: System scans `game-module/modules/` directory for `.js` files
2. **`before:load` Hook**: Fires before module is loaded
3. **Module Import**: Module file is dynamically imported
4. **Validation**: `validate()` method is called if present
5. **Initialization**: `init()` method is called if present
6. **Registration**: Module is registered in the module registry
7. **`after:load` Hook**: Fires after module is loaded

### Hot Reloading

When a module file changes (in development mode with file watching enabled):

1. **`before:reload` Hook**: Fires before reload
2. **Module Reload**: Module is reloaded using the same process as initial load
3. **`after:reload` Hook**: Fires after reload

## Creating Modules

### Basic Module

Create a file in `game-module/modules/` directory:

```javascript
// game-module/modules/my-module.js
import { kubicLog } from "../../kubic-log.js";

export default {
  async init() {
    kubicLog.info('[my-module] Module initialized');
  },
  
  doSomething() {
    return 'Hello from my module!';
  }
};
```

The module will be automatically loaded and accessible as `modules.myModule`.

**Note**: File names are automatically converted from kebab-case to camelCase:
- `tilemap-noise-module.js` → `modules.tilemapNoise`
- `my-custom-module.js` → `modules.myCustom`

### Module with Validation

```javascript
// game-module/modules/validated-module.js
import { GameEventService } from "../../game-server/game-event-service.js";
import { kubicLog } from "../../kubic-log.js";

export default {
  async validate() {
    // Validate dependencies exist
    if (!GameEventService || typeof GameEventService.broadcastToSession !== 'function') {
      throw new Error('[validated-module] GameEventService.broadcastToSession is required');
    }
    kubicLog.debug('[validated-module] Validation passed');
  },
  
  async init() {
    kubicLog.info('[validated-module] Module initialized');
  },
  
  broadcastMessage(gameSession, message) {
    GameEventService.broadcastToSession(gameSession, {
      type: "custom::message",
      payload: { message }
    });
  }
};
```

### Module Using Other Modules

Modules can access other modules via the `modules` object:

```javascript
// game-module/modules/dependent-module.js
import { modules } from "../module-system/index.js";
import { kubicLog } from "../../kubic-log.js";

export default {
  async init() {
    // Check for dependencies
    if (!modules.game) {
      throw new Error('[dependent-module] game module is required');
    }
    
    // Store references for later use
    this.gameModule = modules.game;
    kubicLog.info('[dependent-module] Module initialized');
  },
  
  enhancedGameStart(gameSession, options) {
    // Use another module
    return this.gameModule.handleGameStart(gameSession, options);
  }
};
```

## Using Modules

### In Route Files

```javascript
// game-server/route/my-routes.js
import { modules } from "../../game-module/module-system/index.js";

router.post("/my-endpoint", (req, res) => {
  const result = modules.myModule.doSomething();
  res.json(result);
});
```

### In External Projects

When using kubic-kode as a package in external projects:

```javascript
// my-project/routes/my-routes.js
import express from 'express';
import { modules } from 'kubic-kode';

const router = express.Router();

router.get('/my-endpoint', (req, res) => {
  // Access your custom module (file: tilemap-noise-module.js)
  const result = modules.tilemapNoise.generateTilemap(10, 10);
  res.json({ result });
});

export default router;
```

### Direct Module Access

```javascript
import { modules } from "./game-module/module-system/index.js";
// Or from external projects:
// import { modules } from 'kubic-kode';

// Access modules directly
modules.game.handleGameStart(gameSession, options);
modules.player.formatPlayerIds(gameInstance, playerIds);
modules.turn.executeTurn(gameInstance, playerId, moveData);
modules.tilemapNoise.generateTilemap(width, height); // Custom module
```

### Destructuring Modules

You can destructure modules for cleaner code:

```javascript
import { modules } from "./game-module/module-system/index.js";

const { game, player, turn, tilemapNoise } = modules;

game.handleGameStart(gameSession, options);
player.formatPlayerIds(gameInstance, playerIds);
tilemapNoise.generateTilemap(10, 10);
```

## Module Hooks

### Built-in Hooks

The module system automatically fires these hooks:

- **`before:load`**: Fires before a module is loaded (receives module name)
- **`after:load`**: Fires after a module is loaded (receives module name)
- **`before:reload`**: Fires before a module is reloaded (receives module name)
- **`after:reload`**: Fires after a module is reloaded (receives module name)

### Registering Hooks

```javascript
import { hooks } from "./game-module/module-system/index.js";

// Register a hook callback
hooks.register('after:load', async (moduleName) => {
  console.log(`Module ${moduleName} loaded!`);
});

// Register custom hooks
hooks.register('game:beforeStart', async (gameSession) => {
  console.log('Game about to start');
});
```

### Using Hooks in Modules

```javascript
import { hooks } from "../module-system/index.js";

export default {
  async init() {
    // Register hooks during initialization
    hooks.register('game:afterStart', async (gameSession) => {
      console.log('[my-module] Game started!');
    });
  }
};
```

### Running Hooks

```javascript
import { hooks } from "./game-module/module-system/index.js";

// Run a hook (all registered callbacks will execute)
await hooks.run('game:beforeStart', gameSession);
```

## User-Defined Modules (External Projects)

### Loading Modules from a Directory

For external projects using kubic-kode, you can load custom modules from a directory:

```javascript
// my-project/server.js
import { initModuleSystem, getKubicKodeModulesPath, loadModulesFromDirectory, kubicLog } from 'kubic-kode';
import path from 'path';

// Initialize module system with native kubic modules
const modulesPath = getKubicKodeModulesPath();
await initModuleSystem(modulesPath);
kubicLog.info("Native module system initialized");

// Load user-defined modules from 'module' folder
const userModulesPath = path.resolve(process.cwd(), 'module');
await loadModulesFromDirectory(userModulesPath);
```

**With file watching (hot reload):**

```javascript
await loadModulesFromDirectory(userModulesPath, { watch: true });
```

### Creating User-Defined Modules

Create a file in your `module/` directory:

```javascript
// my-project/module/tilemap-noise-module.js
import { modules, hooks } from 'kubic-kode';
import { kubicLog } from 'kubic-kode';
import { createNoise2D } from 'simplex-noise';

export default {
  async validate() {
    kubicLog.debug('[tilemap-noise-module] Validation passed');
  },

  async init() {
    kubicLog.info('[tilemap-noise-module] Module initialized');
  },

  generateTilemap(width, height, noiseScale = 0.03, seed = undefined) {
    // Your implementation
    const noise = createNoise2D();
    const grid = [];
    // ... generate tilemap
    return grid;
  }
};
```

The module will be automatically:
- Loaded from the directory
- Converted from kebab-case to camelCase (`tilemap-noise-module.js` → `modules.tilemapNoise`)
- Accessible via `modules.tilemapNoise.generateTilemap()`

## Programmatic Module Registration

### Registering Modules

For client extensions or dynamic module loading:

```javascript
import { registerModule } from "./game-module/module-system/index.js";
// Or from external projects:
// import { registerModule } from 'kubic-kode';

const myModule = {
  async validate() {
    // Validation logic
  },
  
  async init() {
    console.log('[my-module] Initialized');
  },
  
  doSomething() {
    return "Hello!";
  }
};

// Register the module
await registerModule("myModule", myModule);

// Accessible as modules.myModule
```

### Unregistering Modules

```javascript
import { unregisterModule } from "./game-module/module-system/index.js";

// Remove a module (async - calls teardown() if available)
const removed = await unregisterModule("myModule");
if (removed) {
  console.log("Module unregistered");
}
```

### Registration Options

```javascript
await registerModule("myModule", moduleInstance, {
  skipValidation: false,  // Skip validate() call (default: false)
  skipInit: false         // Skip init() call (default: false)
});
```

## Module Naming

### File Naming Convention

Module file names are automatically converted to camelCase module names:

- **Kebab-case files** are converted to camelCase: `tilemap-noise-module.js` → `modules.tilemapNoise`
- **Files ending with `-module.js`** have the suffix stripped first: `auth-module.js` → `auth` → `modules.auth`
- **Simple names** remain unchanged: `test.js` → `modules.test`

### Examples

| File Name | Module Name | Access |
|-----------|-------------|--------|
| `game-module.js` | `game` | `modules.game` |
| `player-module.js` | `player` | `modules.player` |
| `tilemap-noise-module.js` | `tilemapNoise` | `modules.tilemapNoise` |
| `my-custom-module.js` | `myCustom` | `modules.myCustom` |
| `test.js` | `test` | `modules.test` |

### Helpful Error Messages

If you try to access a module using kebab-case (e.g., `modules['tilemap-noise']`), you'll get a helpful error:

```
Module "tilemap-noise" not found. Did you mean to use modules.tilemapNoise? 
(Module names are automatically converted from kebab-case to camelCase)
```

Always use camelCase when accessing modules: `modules.tilemapNoise` ✅

## Best Practices

### 1. Validate Dependencies

Always validate critical dependencies in your `validate()` method:

```javascript
async validate() {
  if (!GameEventService) {
    throw new Error('[my-module] GameEventService is required');
  }
}
```

### 2. Check Module Availability

When using other modules, check they exist:

```javascript
async init() {
  if (!modules.game) {
    throw new Error('[my-module] game module is required');
  }
}
```

### 3. Use Hooks for Cross-Module Communication

Instead of direct dependencies, use hooks for loose coupling:

```javascript
// Module A
hooks.register('custom:event', async (data) => {
  // Handle event
});

// Module B
hooks.run('custom:event', { some: 'data' });
```

### 4. Store Module References

Store frequently-used module references:

```javascript
async init() {
  this.gameModule = modules.game;
  this.playerModule = modules.player;
}
```

### 5. Handle Module Loading Order

Use hooks to wait for dependencies:

```javascript
async init() {
  hooks.register('after:load', async (moduleName) => {
    if (moduleName === 'game') {
      // Game module is now available
      this.setupGameIntegration();
    }
  });
  
  // If already loaded, set up immediately
  if (modules.game) {
    this.setupGameIntegration();
  }
}
```

## TypeScript Support

The module system includes TypeScript definitions in `game-module/module-system/types.d.ts`:

```typescript
import { modules, hooks, registerModule } from './game-module/module-system/index.js';

// Full type support and autocomplete
modules.game.handleGameStart(...);
hooks.register('custom:event', async (data) => {});
```

## API Reference

### Module System Exports

```javascript
import { 
  modules,                // Proxy object for accessing modules
  hooks,                  // Hook system for events
  registry,               // Module registry (loadModule, getModule, etc.)
  registerModule,         // Register modules programmatically
  unregisterModule,       // Unregister modules
  loadModulesFromDirectory, // Load modules from a directory (external projects)
  initModuleSystem,       // Initialize module system with a base path
  getKubicKodeModulesPath // Get path to kubic-kode's native modules
} from './game-module/module-system/index.js';

// Or from external projects:
// import { modules, hooks, loadModulesFromDirectory } from 'kubic-kode';
```

### Module Interface

```typescript
interface Module {
  validate?(): Promise<void> | void;  // Optional validation
  init?(): Promise<void> | void;      // Optional initialization
  [key: string]: any;                  // Your module methods
}
```

### Hooks API

```typescript
hooks.register(name: string, callback: Function): void;
hooks.run(name: string, ...args: any[]): Promise<void>;
hooks.unregister(name: string, callback: Function): void;
hooks.clear(): void;
```

### Registry API

```typescript
registry.loadModule(fileName: string, options?: object): Promise<Module>;
registry.reloadModule(fileName: string): Promise<void>;
registry.getModule(modName: string): Module | undefined;
registry.registerModule(name: string, instance: Module, options?: object): Promise<Module>;
registry.unregisterModule(name: string): Promise<boolean>;
registry.loadModulesFromDirectory(directoryPath: string, options?: { watch?: boolean }): Promise<void>;
```

### External Project Helpers

```typescript
// Initialize module system with native kubic modules
initModuleSystem(basePath: string): Promise<void>;

// Get path to kubic-kode's native modules directory
getKubicKodeModulesPath(): string;

// Load user-defined modules from a directory
loadModulesFromDirectory(directoryPath: string, options?: { watch?: boolean }): Promise<void>;
```

## Examples

### Complete Module Example

```javascript
// game-module/modules/analytics-module.js
import { modules, hooks } from "../module-system/index.js";
import { GameEventService } from "../../game-server/game-event-service.js";
import { kubicLog } from "../../kubic-log.js";

export default {
  async validate() {
    if (!GameEventService) {
      throw new Error('[analytics] GameEventService is required');
    }
  },
  
  async init() {
    kubicLog.info('[analytics] Initializing analytics module');
    
    // Store module references
    this.gameModule = modules.game;
    
    // Register hooks
    hooks.register('game:afterStart', async (gameSession) => {
      this.trackEvent('game_started', {
        sessionId: gameSession.getSessionId()
      });
    });
  },
  
  trackEvent(eventName, data) {
    kubicLog.debug(`[analytics] Event: ${eventName}`, data);
    // Send to analytics service
  },
  
  getStats() {
    return { eventsTracked: 100 };
  }
};
```

### External Project Example

```javascript
// my-project/server.js
import express from 'express';
import { 
  initModuleSystem, 
  getKubicKodeModulesPath, 
  loadModulesFromDirectory,
  modules,
  kubicLog 
} from 'kubic-kode';
import path from 'path';

const app = express();

// Initialize native kubic modules
const modulesPath = getKubicKodeModulesPath();
await initModuleSystem(modulesPath);
kubicLog.info("Native module system initialized");

// Load user-defined modules
const userModulesPath = path.resolve(process.cwd(), 'module');
await loadModulesFromDirectory(userModulesPath);

// Use your custom module in routes
app.get('/api/tilemap', (req, res) => {
  const tilemap = modules.tilemapNoise.generateTilemap(10, 10);
  res.json({ tilemap });
});

app.listen(3000);
```

### Manual Registration Example

```javascript
// client-extension.js
import { registerModule, modules } from './game-module/module-system/index.js';
// Or from external projects:
// import { registerModule, modules } from 'kubic-kode';

const clientModule = {
  async init() {
    console.log('[client-module] Initialized');
    
    // Use existing modules
    if (modules.game) {
      console.log('Game module available!');
    }
  },
  
  customMethod() {
    return 'Custom functionality';
  }
};

await registerModule('client', clientModule);
```

## Troubleshooting

### Module Not Found

If you get `Module 'X' not found`:

1. Check the file exists in the modules directory
2. Verify the file exports a default object (`export default { ... }`)
3. Check module name matches (kebab-case file → camelCase module)
   - File: `tilemap-noise-module.js` → Access: `modules.tilemapNoise`
   - If you see a helpful error suggesting camelCase, use that name
4. Ensure module system has been initialized (`initModuleSystem()`)
5. For external projects, ensure `loadModulesFromDirectory()` was called
6. Restart your server to clear module cache

### Module Method Not Found

If you get `modules.X.methodName is not a function`:

1. Verify the method is defined on the exported default object
2. Check for typos in the method name
3. Ensure the method is not defined inside `init()` - it should be on the module object
4. Check that the module was loaded successfully (check logs)

### Circular Dependencies

Avoid circular dependencies between modules. Use hooks instead:

```javascript
// ❌ BAD: Module A uses Module B, Module B uses Module A

// ✅ GOOD: Use hooks for communication
hooks.register('moduleA:event', handler);
hooks.run('moduleA:event', data);
```

### Module Not Loading

If a module isn't loading:

1. Check for syntax errors in the module file
2. Verify `validate()` doesn't throw errors
3. Check `init()` completes successfully
4. Review console logs for error messages

## See Also

- [Game Token System](./game-token-system.md) - Authentication system
- [Game State Machine](./game-state-machine.md) - State management
- [Kubic Log](./kubic-log.md) - Logging system

