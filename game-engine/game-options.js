// GameOptions - manages configurable and frozen game options
export class GameOptions {
  constructor(options = {}) {
    this.configurable = new Map(); // Options that can be changed
    this.frozen = new Map(); // Options that cannot be changed
    this.defaults = new Map(); // Default values for all options
    
    // Initialize with provided options
    if (options.configurable) {
      for (const [key, value] of Object.entries(options.configurable)) {
        this.configurable.set(key, value);
      }
    }
    
    if (options.frozen) {
      for (const [key, value] of Object.entries(options.frozen)) {
        this.frozen.set(key, value);
      }
    }
    
    if (options.defaults) {
      for (const [key, value] of Object.entries(options.defaults)) {
        this.defaults.set(key, value);
      }
    }
  }

  // Add a configurable option
  addConfigurable(key, defaultValue, validator = null) {
    this.configurable.set(key, { defaultValue, validator });
    this.defaults.set(key, defaultValue);
  }

  // Add a frozen option
  addFrozen(key, value) {
    this.frozen.set(key, value);
    this.defaults.set(key, value);
  }

  // Get all available options (configurable + frozen)
  getAllOptions() {
    const allOptions = {};
    
    // Add configurable options
    for (const [key, config] of this.configurable) {
      allOptions[key] = config.defaultValue;
    }
    
    // Add frozen options
    for (const [key, value] of this.frozen) {
      allOptions[key] = value;
    }
    
    return allOptions;
  }

  // Get configurable options only
  getConfigurableOptions() {
    const configurable = {};
    for (const [key, config] of this.configurable) {
      configurable[key] = config.defaultValue;
    }
    return configurable;
  }

  // Get frozen options only
  getFrozenOptions() {
    const frozen = {};
    for (const [key, value] of this.frozen) {
      frozen[key] = value;
    }
    return frozen;
  }

  // Validate and apply options
  validateAndApply(requestedOptions) {
    const result = {
      valid: true,
      applied: {},
      errors: [],
      ignored: []
    };

    for (const [key, value] of Object.entries(requestedOptions)) {
      // Check if option is frozen
      if (this.frozen.has(key)) {
        const frozenValue = this.frozen.get(key);
        if (value !== frozenValue) {
          result.errors.push(`Option '${key}' is frozen and cannot be changed from ${frozenValue} to ${value}`);
          result.valid = false;
        } else {
          result.applied[key] = value;
        }
        continue;
      }

      // Check if option is configurable
      if (this.configurable.has(key)) {
        const config = this.configurable.get(key);
        
        // Validate the value if a validator is provided
        if (config.validator && typeof config.validator === 'function') {
          const validation = config.validator(value);
          if (validation !== true) {
            result.errors.push(`Invalid value for '${key}': ${validation}`);
            result.valid = false;
            continue;
          }
        }
        
        result.applied[key] = value;
      } else {
        // Unknown option
        result.ignored.push(`Unknown option '${key}'`);
      }
    }

    return result;
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

  // Check if an option is configurable
  isConfigurable(key) {
    return this.configurable.has(key);
  }

  // Check if an option is frozen
  isFrozen(key) {
    return this.frozen.has(key);
  }

  // Get option info
  getOptionInfo(key) {
    if (this.configurable.has(key)) {
      const config = this.configurable.get(key);
      return {
        type: 'configurable',
        defaultValue: config.defaultValue,
        validator: config.validator
      };
    }
    
    if (this.frozen.has(key)) {
      return {
        type: 'frozen',
        value: this.frozen.get(key)
      };
    }
    
    return null;
  }

  // Get all option metadata
  getOptionsMetadata() {
    const metadata = {};
    
    for (const [key, config] of this.configurable) {
      metadata[key] = {
        type: 'configurable',
        defaultValue: config.defaultValue,
        validator: config.validator ? config.validator.toString() : null
      };
    }
    
    for (const [key, value] of this.frozen) {
      metadata[key] = {
        type: 'frozen',
        value: value
      };
    }
    
    return metadata;
  }
} 