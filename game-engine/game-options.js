// GameOptions - manages game options with lifecycle-based modification rules
export class GameOptions {
  constructor(options = {}) {
    this.options = new Map(); // All options with their lifecycle rules
    this.gameState = 'pre-start'; // Current game state: 'pre-start', 'started', 'round-active', 'between-rounds', 'ended'
    
    // Legacy support - convert old format to new lifecycle-based format
    if (options.configurable) {
      for (const [key, value] of Object.entries(options.configurable)) {
        this.addOption(key, value, 'runtime'); // Default configurable to runtime
      }
    }
    
    if (options.frozen) {
      for (const [key, value] of Object.entries(options.frozen)) {
        this.addOption(key, value, 'frozen');
      }
    }
    
    if (options.defaults) {
      for (const [key, value] of Object.entries(options.defaults)) {
        this.addOption(key, value, 'runtime'); // Default to runtime if not specified
      }
    }
  }

  // Add an option with lifecycle rules
  addOption(key, defaultValue, lifecycle = 'pre-start', validator = null) {
    // Validate lifecycle value
    const validLifecycles = ['frozen', 'pre-start', 'runtime', 'between-rounds'];
    if (!validLifecycles.includes(lifecycle)) {
      throw new Error(`Invalid lifecycle '${lifecycle}'. Must be one of: ${validLifecycles.join(', ')}`);
    }

    this.options.set(key, {
      defaultValue,
      currentValue: defaultValue,
      lifecycle,
      validator,
      locked: false // Will be set based on game state and lifecycle rules
    });
  }

  // Legacy methods for backwards compatibility
  // @deprecated
  addConfigurable(key, defaultValue, validator = null) {
    console.warn(`addConfigurable is deprecated. Use addOption(key, defaultValue, 'runtime', validator) instead.`);
    this.addOption(key, defaultValue, 'runtime', validator);
  }

  // @deprecated
  addFrozen(key, value) {
    console.warn(`addFrozen is deprecated. Use addOption(key, value, 'frozen') instead.`);
    this.addOption(key, value, 'frozen');
  }

  // Game state management
  setGameState(newState) {
    const validStates = ['pre-start', 'started', 'round-active', 'between-rounds', 'ended'];
    if (!validStates.includes(newState)) {
      throw new Error(`Invalid game state '${newState}'. Must be one of: ${validStates.join(', ')}`);
    }

    const oldState = this.gameState;
    this.gameState = newState;
    
    // Update option locks based on new state
    this._updateOptionLocks(oldState, newState);
  }

  getGameState() {
    return this.gameState;
  }

  // Internal method to update option locks based on game state transitions
  _updateOptionLocks(oldState, newState) {
    for (const [key, option] of this.options) {
      const shouldBeLocked = this._shouldOptionBeLocked(option.lifecycle, newState);
      option.locked = shouldBeLocked;
    }
  }

  // Determine if an option should be locked based on its lifecycle and current game state
  _shouldOptionBeLocked(lifecycle, gameState) {
    switch (lifecycle) {
      case 'frozen':
        return true; // Always locked
      case 'pre-start':
        return gameState !== 'pre-start'; // Locked once game starts
      case 'runtime':
        return false; // Never locked
      case 'between-rounds':
        return gameState === 'round-active'; // Locked during active rounds
      default:
        return true; // Default to locked for unknown lifecycles
    }
  }

  // Get all available options
  getAllOptions() {
    const allOptions = {};
    for (const [key, option] of this.options) {
      allOptions[key] = option.currentValue;
    }
    return allOptions;
  }

  // Get configurable options only (legacy support)
  getConfigurableOptions() {
    const configurable = {};
    for (const [key, option] of this.options) {
      if (option.lifecycle !== 'frozen') {
        configurable[key] = option.currentValue;
      }
    }
    return configurable;
  }

  // Get frozen options only (legacy support)
  getFrozenOptions() {
    const frozen = {};
    for (const [key, option] of this.options) {
      if (option.lifecycle === 'frozen') {
        frozen[key] = option.currentValue;
      }
    }
    return frozen;
  }

  // Get options by lifecycle
  getOptionsByLifecycle(lifecycle) {
    const options = {};
    for (const [key, option] of this.options) {
      if (option.lifecycle === lifecycle) {
        options[key] = option.currentValue;
      }
    }
    return options;
  }

  // Get options that are currently unlocked and can be modified
  getModifiableOptions() {
    const modifiable = {};
    for (const [key, option] of this.options) {
      if (!option.locked) {
        modifiable[key] = option.currentValue;
      }
    }
    return modifiable;
  }

  // Validate and apply options
  validateAndApply(requestedOptions) {
    const result = {
      valid: true,
      applied: {},
      errors: [],
      ignored: [],
      locked: [] // New: track options that were rejected due to being locked
    };

    for (const [key, value] of Object.entries(requestedOptions)) {
      // Check if option exists
      if (!this.options.has(key)) {
        result.ignored.push(`Unknown option '${key}'`);
        continue;
      }

      const option = this.options.get(key);

      // Check if option is locked due to lifecycle rules
      if (option.locked) {
        const lockReason = this._getLockReason(option.lifecycle, this.gameState);
        result.errors.push(`Option '${key}' is locked: ${lockReason}`);
        result.locked.push({
          key,
          lifecycle: option.lifecycle,
          gameState: this.gameState,
          reason: lockReason
        });
        result.valid = false;
        continue;
      }

      // Validate the value if a validator is provided
      if (option.validator && typeof option.validator === 'function') {
        const validation = option.validator(value);
        if (validation !== true) {
          result.errors.push(`Invalid value for '${key}': ${validation}`);
          result.valid = false;
          continue;
        }
      }

      // Apply the valid option
      result.applied[key] = value;
      option.currentValue = value;
    }

    return result;
  }

  // Get human-readable reason why an option is locked
  _getLockReason(lifecycle, gameState) {
    switch (lifecycle) {
      case 'frozen':
        return 'this option is part of the core game rules and cannot be changed';
      case 'pre-start':
        return `this option can only be changed before the game starts (current state: ${gameState})`;
      case 'between-rounds':
        return `this option can only be changed between rounds (current state: ${gameState})`;
      default:
        return `option lifecycle '${lifecycle}' prevents changes in state '${gameState}'`;
    }
  }

  // Get the final options after applying requested changes
  getFinalOptions(requestedOptions = {}) {
    const final = this.getAllOptions();
    const validation = this.validateAndApply(requestedOptions);
    
    if (validation.valid) {
      // Apply valid requested options
      for (const [key, value] of Object.entries(validation.applied)) {
        final[key] = value;
      }
    }
    
    return final;
  }

  // Check if an option is configurable (legacy support)
  // @deprecated
  isConfigurable(key) {
    const option = this.options.get(key);
    return option && option.lifecycle !== 'frozen';
  }

  // Check if an option is frozen (legacy support)
  // @deprecated
  isFrozen(key) {
    const option = this.options.get(key);
    return option && option.lifecycle === 'frozen';
  }

  // Check if an option is currently locked
  isLocked(key) {
    const option = this.options.get(key);
    return option ? option.locked : true; // Default to locked if option doesn't exist
  }

  // Check if an option can be modified in the current game state
  canModify(key) {
    const option = this.options.get(key);
    return option && !option.locked;
  }

  // Get option info
  getOptionInfo(key) {
    const option = this.options.get(key);
    if (!option) {
      return null;
    }

    return {
      lifecycle: option.lifecycle,
      defaultValue: option.defaultValue,
      currentValue: option.currentValue,
      locked: option.locked,
      validator: option.validator ? option.validator.toString() : null,
      canModify: !option.locked,
      // Legacy fields for backwards compatibility
      type: option.lifecycle === 'frozen' ? 'frozen' : 'configurable',
      value: option.currentValue
    };
  }

  // Get all option metadata
  getOptionsMetadata() {
    const metadata = {};
    
    for (const [key, option] of this.options) {
      metadata[key] = {
        lifecycle: option.lifecycle,
        defaultValue: option.defaultValue,
        currentValue: option.currentValue,
        locked: option.locked,
        validator: option.validator ? option.validator.toString() : null,
        canModify: !option.locked,
        gameState: this.gameState,
        // Legacy fields for backwards compatibility
        type: option.lifecycle === 'frozen' ? 'frozen' : 'configurable',
        value: option.currentValue
      };
    }
    
    return metadata;
  }

  // Reset applied values back to defaults
  resetAppliedValues() {
    for (const [key, option] of this.options) {
      option.currentValue = option.defaultValue;
    }
  }

  // Get currently applied values (legacy support)
  getAppliedOptions() {
    return this.getAllOptions();
  }

  // Get the current applied value for a specific option
  getCurrentValue(key) {
    const option = this.options.get(key);
    return option ? option.currentValue : undefined;
  }

  // Get the default value for a specific option
  getDefaultValue(key) {
    const option = this.options.get(key);
    return option ? option.defaultValue : undefined;
  }

  // Get option lifecycle
  getOptionLifecycle(key) {
    const option = this.options.get(key);
    return option ? option.lifecycle : null;
  }

  // Get all available lifecycles
  getAvailableLifecycles() {
    return ['frozen', 'pre-start', 'runtime', 'between-rounds'];
  }

  // Get summary of current state for debugging
  getDebugInfo() {
    return {
      gameState: this.gameState,
      totalOptions: this.options.size,
      lockedOptions: Array.from(this.options.entries()).filter(([key, option]) => option.locked).length,
      optionsByLifecycle: {
        frozen: Array.from(this.options.entries()).filter(([key, option]) => option.lifecycle === 'frozen').length,
        'pre-start': Array.from(this.options.entries()).filter(([key, option]) => option.lifecycle === 'pre-start').length,
        runtime: Array.from(this.options.entries()).filter(([key, option]) => option.lifecycle === 'runtime').length,
        'between-rounds': Array.from(this.options.entries()).filter(([key, option]) => option.lifecycle === 'between-rounds').length
      }
    };
  }
} 