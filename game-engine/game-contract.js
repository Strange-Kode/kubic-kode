import { kubicLog } from "../kubic-log.js";
import { 
  KubicSystemError, 
  KubicContractError, 
  ErrorFactory,
  ErrorCodes 
} from "./kubic-kode-error.js";

// Game Contract - defines what methods game implementations must provide
export class GameContract {
  constructor() {
    // Required methods that game implementations MUST provide
    this._requiredMethods = new Set([
      "getGameEngine",
      "playTurn",
      "addPlayer",
      "startGame",
      "resetForRestart",
      "requiredPlayers"
    ]);

    // Optional methods that game implementations CAN provide
    // If not provided, KubicKodeGame will provide default implementations
    this._optionalMethods = new Set([
      "getTileMap",
      "getCurrentTurnPlayers",
      "getWinner",
      "etInactivityTimeout",
      "isGameActive",
      "getGameStats",
      "stopGame",
      "handleInactivity",
      "initializeGameOptions",
      "calculateComputerMove",
      "establishFirstPlayers",
      "removePlayer"
    ]);

    // Methods that are always provided by KubicKodeGame wrapper
    // These methods are bound to the game instance and can be called from within the game
    this._wrapperMethods = new Set([
      "getGameOptions",
      "getOptionValue",
      "resetGameOptions",
      "applyGameOptions",
      "recordCustomEvent",
      "setPlayerMappings",
      "getPlayerMappings"
    ]);
  }

  /**
   * Check if a method is required for game implementations
   * @param {string} methodName - The name of the method to check
   * @returns {boolean} True if the method is required, false otherwise
   */
  isRequired(methodName) {
    return this._requiredMethods.has(methodName);
  }

  /**
   * Check if a method is optional for game implementations
   * @param {string} methodName - The name of the method to check
   * @returns {boolean} True if the method is optional, false otherwise
   */
  isOptional(methodName) {
    return this._optionalMethods.has(methodName);
  }

  /**
   * Check if a method is provided by the KubicKodeGame wrapper
   * @param {string} methodName - The name of the method to check
   * @returns {boolean} True if the method is provided by the wrapper, false otherwise
   */
  isWrapperMethod(methodName) {
    return this._wrapperMethods.has(methodName);
  }

  /**
   * Validate that a game instance implements the required contract
   * @param {Object} gameInstance - The game instance to validate
   * @param {string} className - The class name for error messages (default: "GameInstance")
   * @returns {Object} Validation result with valid flag, required methods, optional methods, and implemented methods
   * @throws {Error} If required methods are missing
   */
  validateGameInstance(gameInstance, className = "GameInstance") {
    const missingMethods = [];
    const implementedMethods = [];

    // Check required methods
    for (const methodName of this._requiredMethods) {
      if (typeof gameInstance[methodName] !== "function") {
        missingMethods.push(methodName);
      } else {
        implementedMethods.push(methodName);
      }
    }

    // Check optional methods
    for (const methodName of this._optionalMethods) {
      if (typeof gameInstance[methodName] === "function") {
        implementedMethods.push(methodName);
      }
    }

    if (missingMethods.length > 0) {
      throw ErrorFactory.contract(
        `${className} is missing required methods: ${missingMethods.join(", ")}`,
        "GameContract",
        className,
        { context: { 
          missingMethods, 
          requiredMethods: Array.from(this._requiredMethods), 
          optionalMethods: Array.from(this._optionalMethods) 
        } }
      );
    }

    kubicLog.trace(`✅ ${className} implements required contract`);
    kubicLog.trace(`   Required methods: ${Array.from(this._requiredMethods).join(", ")}`);
    kubicLog.trace(`   Optional methods implemented: ${implementedMethods.filter(m => this._optionalMethods.has(m)).join(", ")}`);

    return {
      valid: true,
      requiredMethods: Array.from(this._requiredMethods),
      optionalMethods: Array.from(this._optionalMethods),
      implementedMethods: implementedMethods
    };
  }

  /**
   * Get all method names defined in the contract
   * @returns {Array<string>} Array of all method names (required, optional, and wrapper methods)
   */
  getAllMethods() {
    return [
      ...Array.from(this._requiredMethods),
      ...Array.from(this._optionalMethods),
      ...Array.from(this._wrapperMethods)
    ];
  }

  /**
   * Get comprehensive documentation for the contract
   * @returns {Object} Documentation object containing method lists, descriptions, and notes
   */
  getDocumentation() {
    return {
      required: Array.from(this._requiredMethods),
      optional: Array.from(this._optionalMethods),
      wrapper: Array.from(this._wrapperMethods),
      description: {
        required: "Methods that game implementations MUST provide",
        optional: "Methods that game implementations CAN provide (defaults provided by wrapper)",
        wrapper: "Methods always provided by KubicKodeGame wrapper and bound to game instance"
      },
      notes: {
        wrapperMethods: "Wrapper methods are bound to the game instance and can be called from within the game using this.methodName()",
        gameOptions: "Game options are managed exclusively through getGameOptions() and accessed via getOptionValue()",
        noBoilerplate: "Games should NOT implement wrapper methods - they are provided automatically",
        playerMappings: "Player mapping methods (setPlayerMappings, getPlayerMappings) are provided by KubicKodeGame wrapper to map participant IDs to player IDs"
      }
    };
  }
}

// Default game contract instance
export const gameContract = new GameContract();
