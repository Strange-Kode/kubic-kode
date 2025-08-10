import { kubicLog } from "../kubic-log.js";

// GameOptions - manages game options with lifecycle-based modification rules
export class GameOptions {
  constructor(options = {}) {
    this.namespaces = new Map(); // namespace -> Map of options
    this.gameState = 'pre-start'; // Current game state: 'pre-start', 'started', 'round-active', 'between-rounds', 'ended'
    
    // Initialize default namespaces
    this.namespaces.set('userspace', new Map());
    this.namespaces.set('systemspace', new Map());
    
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

  // Add an option with lifecycle rules to the userspace namespace (default)
  addOption(key, defaultValue, lifecycle = 'pre-start', validator = null, namespace = 'userspace') {
    this._addOptionToNamespace(namespace, key, defaultValue, lifecycle, validator);
  }

  // Add an option to the systemspace namespace
  addSystemOption(key, defaultValue, lifecycle = 'pre-start', validator = null, description = '') {
    // Check if this option name exists in any other namespace
    for (const [ns, options] of this.namespaces) {
      if (ns !== 'systemspace' && options.has(key)) {
        throw new Error(`Option '${key}' already exists in namespace '${ns}'. System option names must be unique across all namespaces.`);
      }
    }
    
    this._addOptionToNamespace('systemspace', key, defaultValue, lifecycle, validator, description);
  }

  // Internal method to add option to specific namespace
  _addOptionToNamespace(namespace, key, defaultValue, lifecycle, validator, description = '') {
    // Validate lifecycle value
    const validLifecycles = ['frozen', 'pre-start', 'runtime', 'between-rounds'];
    if (!validLifecycles.includes(lifecycle)) {
      throw new Error(`Invalid lifecycle '${lifecycle}'. Must be one of: ${validLifecycles.join(', ')}`);
    }

    // Ensure namespace exists
    if (!this.namespaces.has(namespace)) {
      this.namespaces.set(namespace, new Map());
    }

    // Check if option already exists in this namespace
    const namespaceOptions = this.namespaces.get(namespace);
    if (namespaceOptions.has(key)) {
      throw new Error(`Option '${key}' already exists in namespace '${namespace}'`);
    }

    // System option names must be unique across all namespaces
    if (namespace === 'systemspace') {
      // If adding to systemspace, check no other namespace has this key
      for (const [ns, options] of this.namespaces) {
        if (ns !== 'systemspace' && options.has(key)) {
          throw new Error(`Option '${key}' already exists in namespace '${ns}'. System option names must be unique across all namespaces.`);
        }
      }
    } else {
      // If adding to non-system namespace, check if systemspace already has this key
      const systemOptions = this.namespaces.get('systemspace');
      if (systemOptions && systemOptions.has(key)) {
        throw new Error(`Option '${key}' already exists in systemspace. System option names must be unique across all namespaces. Use this.getGameOptions().readSystemOption('${key}') to access it.`);
      }
    }

    namespaceOptions.set(key, {
      defaultValue,
      currentValue: defaultValue,
      lifecycle,
      validator,
      description,
      namespace,
      locked: false // Will be set based on game state and lifecycle rules
    });
  }

  // Read an option from userspace namespace (default)
  readOption(key, namespace = 'userspace') {
    const namespaceOptions = this.namespaces.get(namespace);
    if (!namespaceOptions || !namespaceOptions.has(key)) {
      // Check if option exists in other namespaces and suggest
      const suggestions = this._findOptionInOtherNamespaces(key, namespace);
      if (suggestions.length > 0) {
        const suggestionText = suggestions.map(s => `${s.namespace}::${key}`).join(', ');
        throw new Error(`Option '${key}' not found in namespace '${namespace}'. Did you mean: ${suggestionText}?`);
      }
      throw new Error(`Option '${key}' not found in namespace '${namespace}'`);
    }
    return namespaceOptions.get(key);
  }

  // Read an option from systemspace namespace
  readSystemOption(key) {
    return this.readOption(key, 'systemspace');
  }

  // Get current value of an option (checks userspace first, then systemspace)
  getCurrentValue(key, namespace = null) {
    if (namespace) {
      const option = this.readOption(key, namespace);
      return option.currentValue;
    }
    
    // Check userspace first, then systemspace
    try {
      const option = this.readOption(key, 'userspace');
      return option.currentValue;
    } catch {
      try {
        const option = this.readOption(key, 'systemspace');
        return option.currentValue;
      } catch {
        // Check if option exists in any namespace and suggest
        const suggestions = this._findOptionInAllNamespaces(key);
        if (suggestions.length > 0) {
          const suggestionText = suggestions.map(s => `${s.namespace}::${key}`).join(', ');
          throw new Error(`Option '${key}' not found. Did you mean: ${suggestionText}?`);
        }
        throw new Error(`Option '${key}' not found in any namespace`);
      }
    }
  }

  // Get current value of a system option
  getCurrentSystemValue(key) {
    return this.getCurrentValue(key, 'systemspace');
  }

  // Helper method to find option in other namespaces
  _findOptionInOtherNamespaces(key, excludeNamespace) {
    const suggestions = [];
    for (const [ns, options] of this.namespaces) {
      if (ns !== excludeNamespace && options.has(key)) {
        suggestions.push({ namespace: ns, option: options.get(key) });
      }
    }
    return suggestions;
  }

  // Helper method to find option in all namespaces
  _findOptionInAllNamespaces(key) {
    const suggestions = [];
    for (const [ns, options] of this.namespaces) {
      if (options.has(key)) {
        suggestions.push({ namespace: ns, option: options.get(key) });
      }
    }
    return suggestions;
  }

  // Get all options from a specific namespace
  getNamespaceOptions(namespace = 'userspace') {
    const namespaceOptions = this.namespaces.get(namespace);
    if (!namespaceOptions) {
      throw new Error(`Namespace '${namespace}' does not exist`);
    }
    
    const options = {};
    for (const [key, option] of namespaceOptions) {
      options[key] = option.currentValue;
    }
    return options;
  }

  // Get all system options
  getSystemOptions() {
    return this.getNamespaceOptions('systemspace');
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
    for (const [namespace, options] of this.namespaces) {
      for (const [key, option] of options) {
        const shouldBeLocked = this._shouldOptionBeLocked(option.lifecycle, newState);
        option.locked = shouldBeLocked;
      }
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

  // Get all available options from all namespaces
  getAllOptions() {
    const allOptions = {};
    for (const [namespace, options] of this.namespaces) {
      for (const [key, option] of options) {
        // Use namespace::key format for system options to avoid conflicts
        const optionKey = namespace === 'systemspace' ? `system::${key}` : key;
        allOptions[optionKey] = option.currentValue;
      }
    }
    return allOptions;
  }

  // Get configurable options only (legacy support) - from userspace only
  getConfigurableOptions() {
    const configurable = {};
    const userOptions = this.namespaces.get('userspace');
    if (userOptions) {
      for (const [key, option] of userOptions) {
        if (option.lifecycle !== 'frozen') {
          configurable[key] = option.currentValue;
        }
      }
    }
    return configurable;
  }

  // Get frozen options only (legacy support) - from userspace only
  getFrozenOptions() {
    const frozen = {};
    const userOptions = this.namespaces.get('userspace');
    if (userOptions) {
      for (const [key, option] of userOptions) {
        if (option.lifecycle === 'frozen') {
          frozen[key] = option.currentValue;
        }
      }
    }
    return frozen;
  }

  // Get options by lifecycle from a specific namespace
  getOptionsByLifecycle(lifecycle, namespace = null) {
    const options = {};
    const namespacesToCheck = namespace ? [namespace] : Array.from(this.namespaces.keys());
    
    for (const ns of namespacesToCheck) {
      const namespaceOptions = this.namespaces.get(ns);
      if (namespaceOptions) {
        for (const [key, option] of namespaceOptions) {
          if (option.lifecycle === lifecycle) {
            const optionKey = ns === 'systemspace' ? `system::${key}` : key;
            options[optionKey] = option.currentValue;
          }
        }
      }
    }
    return options;
  }

  // Get options that are currently unlocked and can be modified
  getModifiableOptions(namespace = null) {
    const modifiable = {};
    const namespacesToCheck = namespace ? [namespace] : Array.from(this.namespaces.keys());
    
    for (const ns of namespacesToCheck) {
      const namespaceOptions = this.namespaces.get(ns);
      if (namespaceOptions) {
        for (const [key, option] of namespaceOptions) {
          if (!option.locked) {
            const optionKey = ns === 'systemspace' ? `system::${key}` : key;
            modifiable[optionKey] = option.currentValue;
          }
        }
      }
    }
    return modifiable;
  }

  // Validate and apply options (supports system:: prefix for system options)
  validateAndApply(requestedOptions) {
    const result = {
      valid: true,
      applied: {},
      errors: [],
      ignored: [],
      locked: [] // New: track options that were rejected due to being locked
    };

    for (const [key, value] of Object.entries(requestedOptions)) {
      let option = null;
      let namespace = 'userspace';
      let actualKey = key;

      // Check if this is a system option (prefixed with system::)
      if (key.startsWith('system::')) {
        namespace = 'systemspace';
        actualKey = key.substring(8); // Remove 'system::' prefix
      }

      // Try to find the option in the specified namespace
      const namespaceOptions = this.namespaces.get(namespace);
      if (namespaceOptions && namespaceOptions.has(actualKey)) {
        option = namespaceOptions.get(actualKey);
      } else {
        // Check if option exists in other namespaces and suggest
        const suggestions = this._findOptionInOtherNamespaces(actualKey, namespace);
        if (suggestions.length > 0) {
          const suggestionText = suggestions.map(s => `${s.namespace === 'systemspace' ? 'system::' : ''}${actualKey}`).join(', ');
          result.ignored.push(`Option '${key}' not found in namespace '${namespace}'. Did you mean: ${suggestionText}?`);
        } else {
          result.ignored.push(`Unknown option '${key}'`);
        }
        continue;
      }

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
  
  // Check if an option is currently locked (supports system:: prefix)
  isLocked(key) {
    try {
      let namespace = 'userspace';
      let actualKey = key;
      
      if (key.startsWith('system::')) {
        namespace = 'systemspace';
        actualKey = key.substring(8);
      }
      
      const option = this.readOption(actualKey, namespace);
      return option ? option.locked : true;
    } catch {
      return true; // Default to locked if option doesn't exist
    }
  }

  // Check if an option can be modified in the current game state (supports system:: prefix)
  canModify(key) {
    try {
      let namespace = 'userspace';
      let actualKey = key;
      
      if (key.startsWith('system::')) {
        namespace = 'systemspace';
        actualKey = key.substring(8);
      }
      
      const option = this.readOption(actualKey, namespace);
      return option && !option.locked;
    } catch {
      return false;
    }
  }

  // Get option info (supports system:: prefix)
  getOptionInfo(key) {
    try {
      let namespace = 'userspace';
      let actualKey = key;
      
      if (key.startsWith('system::')) {
        namespace = 'systemspace';
        actualKey = key.substring(8);
      }
      
      const option = this.readOption(actualKey, namespace);
      if (!option) {
        return null;
      }

      return {
        lifecycle: option.lifecycle,
        defaultValue: option.defaultValue,
        currentValue: option.currentValue,
        locked: option.locked,
        namespace: option.namespace,
        description: option.description || null,
        validator: option.validator ? option.validator.toString() : null,
        canModify: !option.locked,
        // Legacy fields for backwards compatibility
        type: option.lifecycle === 'frozen' ? 'frozen' : 'configurable',
        value: option.currentValue
      };
    } catch {
      return null;
    }
  }

  // Get all option metadata from all namespaces
  getOptionsMetadata() {
    const metadata = {};
    
    for (const [namespace, options] of this.namespaces) {
      for (const [key, option] of options) {
        // Use namespace::key format for system options to avoid conflicts
        const metadataKey = namespace === 'systemspace' ? `system::${key}` : key;
        metadata[metadataKey] = {
          lifecycle: option.lifecycle,
          defaultValue: option.defaultValue,
          currentValue: option.currentValue,
          locked: option.locked,
          namespace: option.namespace,
          description: option.description || null,
          validator: option.validator ? option.validator.toString() : null,
          canModify: !option.locked,
          gameState: this.gameState,
          // Legacy fields for backwards compatibility
          type: option.lifecycle === 'frozen' ? 'frozen' : 'configurable',
          value: option.currentValue
        };
      }
    }
    
    return metadata;
  }

  // Reset applied values back to defaults in all namespaces
  resetAppliedValues() {
    for (const [namespace, options] of this.namespaces) {
      for (const [key, option] of options) {
        option.currentValue = option.defaultValue;
      }
    }
  }

  // Get currently applied values (legacy support)
  getAppliedOptions() {
    return this.getAllOptions();
  }

  // Get the default value for a specific option (supports system:: prefix)
  getDefaultValue(key) {
    try {
      let namespace = 'userspace';
      let actualKey = key;
      
      if (key.startsWith('system::')) {
        namespace = 'systemspace';
        actualKey = key.substring(8);
      }
      
      const option = this.readOption(actualKey, namespace);
      return option ? option.defaultValue : undefined;
    } catch {
      return undefined;
    }
  }

  // Get option lifecycle (supports system:: prefix)
  getOptionLifecycle(key) {
    try {
      let namespace = 'userspace';
      let actualKey = key;
      
      if (key.startsWith('system::')) {
        namespace = 'systemspace';
        actualKey = key.substring(8);
      }
      
      const option = this.readOption(actualKey, namespace);
      return option ? option.lifecycle : null;
    } catch {
      return null;
    }
  }

  // Get all available lifecycles
  getAvailableLifecycles() {
    return ['frozen', 'pre-start', 'runtime', 'between-rounds'];
  }

  // Get summary of current state for debugging
  getDebugInfo() {
    let totalOptions = 0;
    let lockedOptions = 0;
    const optionsByLifecycle = {
      frozen: 0,
      'pre-start': 0,
      runtime: 0,
      'between-rounds': 0
    };
    const optionsByNamespace = {};

    for (const [namespace, options] of this.namespaces) {
      optionsByNamespace[namespace] = options.size;
      totalOptions += options.size;
      
      for (const [key, option] of options) {
        if (option.locked) lockedOptions++;
        if (optionsByLifecycle.hasOwnProperty(option.lifecycle)) {
          optionsByLifecycle[option.lifecycle]++;
        }
      }
    }

    return {
      gameState: this.gameState,
      totalOptions,
      lockedOptions,
      optionsByLifecycle,
      optionsByNamespace,
      availableNamespaces: Array.from(this.namespaces.keys())
    };
  }
} 