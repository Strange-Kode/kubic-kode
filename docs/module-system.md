# Module System Documentation

## Overview

The KubicKode Module System is a dynamic, extensible module loading and management system that enables modular architecture for game server functionality. Modules are automatically discovered, loaded, validated, and initialized, with support for hot-reloading during development.

## Key Features

- **Automatic Module Discovery**: Modules are automatically loaded from the `game-module/modules/` directory
- **Hot Reloading**: Modules are automatically reloaded when files change (development mode)
- **Lifecycle Hooks**: Built-in hooks for module loading, reloading, and custom events
- **Validation System**: Optional `validate()` method for dependency checking
- **Dynamic Registration**: Programmatic module registration for client extensions
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

### Direct Module Access

```javascript
import { modules } from "./game-module/module-system/index.js";

// Access modules directly
modules.game.handleGameStart(gameSession, options);
modules.player.formatPlayerIds(gameInstance, playerIds);
modules.turn.executeTurn(gameInstance, playerId, moveData);
```

### Destructuring Modules

You can destructure modules for cleaner code:

```javascript
import { modules } from "./game-module/module-system/index.js";

const { game, player, turn } = modules;

game.handleGameStart(gameSession, options);
player.formatPlayerIds(gameInstance, playerIds);
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

## Programmatic Module Registration

### Registering Modules

For client extensions or dynamic module loading:

```javascript
import { registerModule } from "./game-module/module-system/index.js";

const myModule = {
  async validate() {
    // Validation logic
  },
  
  async init() {
    console.log('[my-module] Initialized');
  },
  
  doSomething() {
    return 'Hello!';
  }
};

// Register the module
await registerModule('myModule', myModule);

// Accessible as modules.myModule
```

### Unregistering Modules

```javascript
import { unregisterModule } from "./game-module/module-system/index.js";

// Remove a module (async - calls teardown() if available)
const removed = await unregisterModule('myModule');
if (removed) {
  console.log('Module unregistered');
}
```

### Registration Options

```javascript
await registerModule('myModule', moduleInstance, {
  skipValidation: false,  // Skip validate() call (default: false)
  skipInit: false         // Skip init() call (default: false)
});
```

## Module Naming

### File Naming Convention

- Module files should be named with kebab-case: `my-module.js`
- The module name will be converted to camelCase: `myModule`
- Files ending with `-module.js` will have the suffix stripped: `auth-module.js` → `auth`

### Examples

| File Name | Module Name | Access |
|-----------|-------------|--------|
| `game-module.js` | `game` | `modules.game` |
| `player-module.js` | `player` | `modules.player` |
| `my-custom-module.js` | `myCustom` | `modules.myCustom` |
| `test.js` | `test` | `modules.test` |

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
  modules,        // Proxy object for accessing modules
  hooks,          // Hook system for events
  registry,       // Module registry (loadModule, getModule, etc.)
  registerModule, // Register modules programmatically
  unregisterModule // Unregister modules
} from './game-module/module-system/index.js';
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

### Client Extension Example

```javascript
// client-extension.js
import { registerModule, modules } from './game-module/module-system/index.js';

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

1. Check the file exists in `game-module/modules/`
2. Verify the file exports a default object
3. Check module name matches (kebab-case file → camelCase module)
4. Ensure module system has been initialized

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

