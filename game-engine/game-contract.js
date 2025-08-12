import { kubicLog } from "../kubic-log.js";

// Game Contract - defines what methods game implementations must provide
export class GameContract {
  constructor() {
    // Required methods that game implementations MUST provide
    this._requiredMethods = new Set([
      'getGameEngine',
      'playTurn',
      'addPlayer',
      'startGame',
      'resetForRestart',
      'requiredPlayers'
    ]);

    // Optional methods that game implementations CAN provide
    // If not provided, KubicKodeGame will provide default implementations
    this._optionalMethods = new Set([
      'getTileMap',
      'getCurrentTurnPlayers',
      'getWinner',
      'getInactivityTimeout',
      'isGameActive',
      'getGameStats',
      'stopGame',
      'handleInactivity',
      'initializeGameOptions',
      'calculateComputerMove',
      'establishFirstPlayers'
    ]);

    // Methods that are always provided by KubicKodeGame wrapper
    // These methods are bound to the game instance and can be called from within the game
    this._wrapperMethods = new Set([
      'getGameOptions',
      'getOptionValue',
      'resetGameOptions',
      'applyGameOptions',
      'recordCustomEvent',
      'setPlayerMappings',
      'getPlayerMappings'
    ]);
  }

  // Check if a method is required
  isRequired(methodName) {
    return this._requiredMethods.has(methodName);
  }

  // Check if a method is optional
  isOptional(methodName) {
    return this._optionalMethods.has(methodName);
  }

  // Check if a method is provided by the wrapper
  isWrapperMethod(methodName) {
    return this._wrapperMethods.has(methodName);
  }

  // Validate that a game instance implements the required contract
  validateGameInstance(gameInstance, className = 'GameInstance') {
    const missingMethods = [];
    const implementedMethods = [];

    // Check required methods
    for (const methodName of this._requiredMethods) {
      if (typeof gameInstance[methodName] !== 'function') {
        missingMethods.push(methodName);
      } else {
        implementedMethods.push(methodName);
      }
    }

    // Check optional methods
    for (const methodName of this._optionalMethods) {
      if (typeof gameInstance[methodName] === 'function') {
        implementedMethods.push(methodName);
      }
    }

    if (missingMethods.length > 0) {
      throw new Error(
        `${className} is missing required methods: ${missingMethods.join(', ')}\n` +
        `Required methods: ${Array.from(this._requiredMethods).join(', ')}\n` +
        `Optional methods: ${Array.from(this._optionalMethods).join(', ')}`
      );
    }

    kubicLog.trace(`✅ ${className} implements required contract`);
    kubicLog.trace(`   Required methods: ${Array.from(this._requiredMethods).join(', ')}`);
    kubicLog.trace(`   Optional methods implemented: ${implementedMethods.filter(m => this._optionalMethods.has(m)).join(', ')}`);

    return {
      valid: true,
      requiredMethods: Array.from(this._requiredMethods),
      optionalMethods: Array.from(this._optionalMethods),
      implementedMethods: implementedMethods
    };
  }

  // Get all method names
  getAllMethods() {
    return [
      ...Array.from(this._requiredMethods),
      ...Array.from(this._optionalMethods),
      ...Array.from(this._wrapperMethods)
    ];
  }

  // Get documentation for the contract
  getDocumentation() {
    return {
      required: Array.from(this._requiredMethods),
      optional: Array.from(this._optionalMethods),
      wrapper: Array.from(this._wrapperMethods),
      description: {
        required: 'Methods that game implementations MUST provide',
        optional: 'Methods that game implementations CAN provide (defaults provided by wrapper)',
        wrapper: 'Methods always provided by KubicKodeGame wrapper and bound to game instance'
      },
      notes: {
        wrapperMethods: 'Wrapper methods are bound to the game instance and can be called from within the game using this.methodName()',
        gameOptions: 'Game options are managed exclusively through getGameOptions() and accessed via getOptionValue()',
        noBoilerplate: 'Games should NOT implement wrapper methods - they are provided automatically',
        playerMappings: 'Player mapping methods (setPlayerMappings, getPlayerMappings) are provided by KubicKodeGame wrapper to map participant IDs to player IDs'
      }
    };
  }
}

// Default game contract instance
export const gameContract = new GameContract();
