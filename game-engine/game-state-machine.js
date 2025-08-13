import { kubicLog } from "../kubic-log.js";

/**
 * Game State Machine Implementation
 * 
 * Provides a flexible state machine for complex game logic with multiple screens,
 * phases, transitions, pause/resume, inventory, game scenes, etc.
 */

/**
 * Base GameState class that all game states should extend
 */
export class GameState {
  constructor(name, stateMachine) {
    this._name = name;
    this._stateMachine = stateMachine;
    this._isActive = false;
  }

  /**
   * Get the name of this state
   * @returns {string} The state name
   */
  getName() {
    return this._name;
  }

  /**
   * Get the parent state machine
   * @returns {GameStateMachine} The state machine instance
   */
  getStateMachine() {
    return this._stateMachine;
  }

  /**
   * Check if this state is currently active
   * @returns {boolean} True if the state is active, false otherwise
   */
  isActive() {
    return this._isActive;
  }

  /**
   * Called when entering this state
   * Override in subclasses to define enter behavior
   * @param {GameState|null} fromState - The state we're coming from
   * @param {Object} data - Optional transition data
   */
  async onEnter(fromState, data = {}) {
    this._isActive = true;
    kubicLog.debug(`[GSM] Entering state: ${this._name}`);
  }

  /**
   * Called when exiting this state
   * Override in subclasses to define exit behavior
   * @param {GameState|null} toState - The state we're going to
   * @param {Object} data - Optional transition data
   */
  async onExit(toState, data = {}) {
    this._isActive = false;
    kubicLog.debug(`[GSM] Exiting state: ${this._name}`);
  }

  /**
   * Called each frame/update while this state is active
   * Override in subclasses to define update behavior
   * @param {number} deltaTime - Time elapsed since last update in milliseconds
   */
  update(deltaTime) {
    // Override in subclasses
  }

  /**
   * Called when game events occur while this state is active
   * Override in subclasses to handle events
   * @param {string} eventType - The type of event
   * @param {Object} eventData - Event data
   */
  handleEvent(eventType, eventData) {
    // Override in subclasses
  }

  /**
   * Called when player actions occur while this state is active
   * Override in subclasses to handle player actions
   * @param {string} playerId - The ID of the player
   * @param {string} action - The action type
   * @param {Object} data - Action data
   */
  handlePlayerAction(playerId, action, data) {
    // Override in subclasses
  }
}

/**
 * StateTransition defines conditions and behavior for moving between states
 */
export class StateTransition {
  constructor(fromState, toState, condition, options = {}) {
    this._fromState = fromState;
    this._toState = toState;
    this._condition = condition; // function that returns boolean
    this._priority = options.priority || 0;
    this._data = options.data || {};
    this._automatic = options.automatic || false; // if true, transition happens automatically when condition is met
  }

  /**
   * Get the source state name
   * @returns {string} The from state name
   */
  getFromState() {
    return this._fromState;
  }

  /**
   * Get the target state name
   * @returns {string} The to state name
   */
  getToState() {
    return this._toState;
  }

  /**
   * Check if this transition can occur given the current state and context
   * @param {string} currentState - The current state name
   * @param {Object} context - Optional context data for condition evaluation
   * @returns {boolean} True if transition can occur, false otherwise
   */
  canTransition(currentState, context = {}) {
    if (currentState !== this._fromState) {
      return false;
    }
    
    if (typeof this._condition === "function") {
      return this._condition(context);
    }
    
    return !!this._condition;
  }

  /**
   * Get the priority of this transition (higher priority transitions are checked first)
   * @returns {number} The transition priority
   */
  getPriority() {
    return this._priority;
  }

  /**
   * Get the data associated with this transition
   * @returns {Object} The transition data
   */
  getData() {
    return this._data;
  }

  /**
   * Check if this transition is automatic
   * @returns {boolean} True if automatic, false otherwise
   */
  isAutomatic() {
    return this._automatic;
  }
}

/**
 * Main Game State Machine class
 */
export class GameStateMachine {
  constructor(gameEngine) {
    this._gameEngine = gameEngine;
    this._states = new Map(); // name -> GameState
    this._transitions = []; // array of StateTransition
    this._currentState = null;
    this._previousState = null;
    this._globalData = {}; // shared data across all states
    this._stateHistory = []; // track state history
    this._maxHistorySize = 50;
    this._paused = false;
    this._pausedState = null;
  }

  /**
   * Get the game engine instance connected to this state machine
   * @returns {GameEngine} The game engine
   */
  getGameEngine() {
    return this._gameEngine;
  }

  /**
   * Register a new state
   * @param {GameState} state - The state to register
   * @returns {GameStateMachine} This instance for chaining
   * @throws {Error} If state is not a GameState instance
   */
  addState(state) {
    if (!(state instanceof GameState)) {
      throw new Error("State must be an instance of GameState");
    }
    
    this._states.set(state.getName(), state);
    return this;
  }

  /**
   * Get a state by name
   * @param {string} stateName - The name of the state to get
   * @returns {GameState|undefined} The state or undefined if not found
   */
  getState(stateName) {
    return this._states.get(stateName);
  }

  /**
   * Get all registered states
   * @returns {Array<GameState>} Array of all registered states
   */
  getAllStates() {
    return Array.from(this._states.values());
  }

  /**
   * Add a transition between states
   * @param {StateTransition} transition - The transition to add
   * @returns {GameStateMachine} This instance for chaining
   * @throws {Error} If transition is not a StateTransition instance
   */
  addTransition(transition) {
    if (!(transition instanceof StateTransition)) {
      throw new Error("Transition must be an instance of StateTransition");
    }
    
    this._transitions.push(transition);
    // Sort by priority (higher priority first)
    this._transitions.sort((a, b) => b.getPriority() - a.getPriority());
    return this;
  }

  /**
   * Add a simple transition (convenience method)
   * @param {string} fromState - The source state name
   * @param {string} toState - The target state name
   * @param {Function|boolean} condition - The transition condition
   * @param {Object} options - Transition options (priority, data, automatic)
   * @returns {GameStateMachine} This instance for chaining
   */
  addSimpleTransition(fromState, toState, condition, options = {}) {
    const transition = new StateTransition(fromState, toState, condition, options);
    return this.addTransition(transition);
  }

  /**
   * Get current state
   * @returns {GameState|null} The current state or null if none set
   */
  getCurrentState() {
    return this._currentState;
  }

  /**
   * Get previous state
   * @returns {GameState|null} The previous state or null if none
   */
  getPreviousState() {
    return this._previousState;
  }

  /**
   * Set initial state (doesn't trigger onEnter)
   * @param {string} stateName - The name of the initial state
   * @returns {GameStateMachine} This instance for chaining
   * @throws {Error} If state is not found
   */
  setInitialState(stateName) {
    const state = this._states.get(stateName);
    if (!state) {
      throw new Error(`State "${stateName}" not found`);
    }
    
    this._currentState = state;
    this._currentState._isActive = true;
    this._addToHistory(stateName);
    return this;
  }

  /**
   * Transition to a new state
   * @param {string} stateName - The name of the state to transition to
   * @param {Object} data - Optional transition data
   * @returns {Promise<boolean>} True if transition was successful, false if already in target state
   * @throws {Error} If target state is not found
   */
  async transitionTo(stateName, data = {}) {
    const newState = this._states.get(stateName);
    if (!newState) {
      throw new Error(`State "${stateName}" not found`);
    }

    if (this._currentState === newState) {
      kubicLog.warn(`[GSM] Already in state: ${stateName}`);
      return false;
    }

    const previousState = this._currentState;
    
    // Exit current state
    if (this._currentState) {
      await this._currentState.onExit(newState, data);
    }

    // Update state references
    this._previousState = this._currentState;
    this._currentState = newState;
    
    // Enter new state
    await this._currentState.onEnter(previousState, data);
    
    this._addToHistory(stateName);
    
    kubicLog.debug(`[GSM] State transition: ${previousState?.getName() || "null"} -> ${stateName}`);
    return true;
  }

  /**
   * Check for and execute automatic transitions
   * @param {Object} context - Optional context data for condition evaluation
   * @returns {boolean} True if a transition occurred, false otherwise
   */
  checkAutomaticTransitions(context = {}) {
    if (this._paused || !this._currentState) {
      return false;
    }

    for (const transition of this._transitions) {
      if (transition.isAutomatic() && transition.canTransition(this._currentState.getName(), context)) {
        this.transitionTo(transition.getToState(), transition.getData());
        return true;
      }
    }
    
    return false;
  }

  /**
   * Manually trigger a transition if conditions are met
   * @param {string} toState - The name of the state to transition to
   * @param {Object} context - Optional context data for condition evaluation
   * @returns {Promise<boolean>} True if transition was successful, false if conditions not met
   */
  async triggerTransition(toState, context = {}) {
    if (!this._currentState) {
      return false;
    }

    for (const transition of this._transitions) {
      if (transition.getToState() === toState && 
          transition.canTransition(this._currentState.getName(), context)) {
        await this.transitionTo(toState, transition.getData());
        return true;
      }
    }
    
    return false;
  }

  /**
   * Update the state machine (call every frame)
   * @param {number} deltaTime - Time elapsed since last update in milliseconds
   */
  update(deltaTime) {
    if (this._paused) {
      return;
    }

    // Update current state
    if (this._currentState) {
      this._currentState.update(deltaTime);
    }

    // Check for automatic transitions
    this.checkAutomaticTransitions();
  }

  /**
   * Handle game events
   * @param {string} eventType - The type of event
   * @param {Object} eventData - Event data
   */
  handleEvent(eventType, eventData) {
    if (this._paused) {
      return;
    }

    if (this._currentState) {
      this._currentState.handleEvent(eventType, eventData);
    }
  }

  /**
   * Handle player actions
   * @param {string} playerId - The ID of the player
   * @param {string} action - The action type
   * @param {Object} data - Action data
   */
  handlePlayerAction(playerId, action, data) {
    if (this._paused) {
      return;
    }

    if (this._currentState) {
      this._currentState.handlePlayerAction(playerId, action, data);
    }
  }

  /**
   * Pause the state machine
   */
  pause() {
    this._paused = true;
    this._pausedState = this._currentState?.getName();
    kubicLog.debug(`[GSM] State machine paused in state: ${this._pausedState}`);
  }

  /**
   * Resume the state machine
   */
  resume() {
    this._paused = false;
    kubicLog.debug(`[GSM] State machine resumed in state: ${this._pausedState}`);
  }

  /**
   * Check if the state machine is paused
   * @returns {boolean} True if paused, false otherwise
   */
  isPaused() {
    return this._paused;
  }

  /**
   * Set global data accessible to all states
   * @param {string} key - The data key
   * @param {any} value - The data value
   */
  setGlobalData(key, value) {
    this._globalData[key] = value;
  }

  /**
   * Get global data
   * @param {string} key - The data key
   * @returns {any} The data value
   */
  getGlobalData(key) {
    return this._globalData[key];
  }

  /**
   * Get all global data
   * @returns {Object} Copy of all global data
   */
  getAllGlobalData() {
    return { ...this._globalData };
  }

  /**
   * Get state history
   * @returns {Array} Copy of state history array
   */
  getStateHistory() {
    return [...this._stateHistory];
  }

  /**
   * Go back to previous state
   * @param {Object} data - Optional transition data
   * @returns {Promise<boolean>} True if transition was successful, false if no previous state
   */
  async goBack(data = {}) {
    if (this._previousState) {
      await this.transitionTo(this._previousState.getName(), data);
      return true;
    }
    return false;
  }

  /**
   * Reset the state machine
   */
  reset() {
    if (this._currentState) {
      this._currentState._isActive = false;
    }
    
    this._currentState = null;
    this._previousState = null;
    this._globalData = {};
    this._stateHistory = [];
    this._paused = false;
    this._pausedState = null;
  }

  /**
   * Add state to history (internal method)
   * @param {string} stateName - The name of the state to add to history
   * @private
   */
  _addToHistory(stateName) {
    this._stateHistory.push({
      state: stateName,
      timestamp: Date.now()
    });
    
    // Keep history size manageable
    if (this._stateHistory.length > this._maxHistorySize) {
      this._stateHistory.shift();
    }
  }
}
