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

  getName() {
    return this._name;
  }

  getStateMachine() {
    return this._stateMachine;
  }

  isActive() {
    return this._isActive;
  }

  /**
   * Called when entering this state
   * Override in subclasses to define enter behavior
   */
  async onEnter(fromState, data = {}) {
    this._isActive = true;
    kubicLog.debug(`[GSM] Entering state: ${this._name}`);
  }

  /**
   * Called when exiting this state
   * Override in subclasses to define exit behavior
   */
  async onExit(toState, data = {}) {
    this._isActive = false;
    kubicLog.debug(`[GSM] Exiting state: ${this._name}`);
  }

  /**
   * Called each frame/update while this state is active
   * Override in subclasses to define update behavior
   */
  update(deltaTime) {
    // Override in subclasses
  }

  /**
   * Called when game events occur while this state is active
   * Override in subclasses to handle events
   */
  handleEvent(eventType, eventData) {
    // Override in subclasses
  }

  /**
   * Called when player actions occur while this state is active
   * Override in subclasses to handle player actions
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

  getFromState() {
    return this._fromState;
  }

  getToState() {
    return this._toState;
  }

  canTransition(currentState, context = {}) {
    if (currentState !== this._fromState) {
      return false;
    }
    
    if (typeof this._condition === 'function') {
      return this._condition(context);
    }
    
    return !!this._condition;
  }

  getPriority() {
    return this._priority;
  }

  getData() {
    return this._data;
  }

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

  getGameEngine() {
    return this._gameEngine;
  }

  /**
   * Register a new state
   */
  addState(state) {
    if (!(state instanceof GameState)) {
      throw new Error('State must be an instance of GameState');
    }
    
    this._states.set(state.getName(), state);
    return this;
  }

  /**
   * Get a state by name
   */
  getState(stateName) {
    return this._states.get(stateName);
  }

  /**
   * Get all registered states
   */
  getAllStates() {
    return Array.from(this._states.values());
  }

  /**
   * Add a transition between states
   */
  addTransition(transition) {
    if (!(transition instanceof StateTransition)) {
      throw new Error('Transition must be an instance of StateTransition');
    }
    
    this._transitions.push(transition);
    // Sort by priority (higher priority first)
    this._transitions.sort((a, b) => b.getPriority() - a.getPriority());
    return this;
  }

  /**
   * Add a simple transition (convenience method)
   */
  addSimpleTransition(fromState, toState, condition, options = {}) {
    const transition = new StateTransition(fromState, toState, condition, options);
    return this.addTransition(transition);
  }

  /**
   * Get current state
   */
  getCurrentState() {
    return this._currentState;
  }

  /**
   * Get previous state
   */
  getPreviousState() {
    return this._previousState;
  }

  /**
   * Set initial state (doesn't trigger onEnter)
   */
  setInitialState(stateName) {
    const state = this._states.get(stateName);
    if (!state) {
      throw new Error(`State '${stateName}' not found`);
    }
    
    this._currentState = state;
    this._currentState._isActive = true;
    this._addToHistory(stateName);
    return this;
  }

  /**
   * Transition to a new state
   */
  async transitionTo(stateName, data = {}) {
    const newState = this._states.get(stateName);
    if (!newState) {
      throw new Error(`State '${stateName}' not found`);
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
    
    kubicLog.debug(`[GSM] State transition: ${previousState?.getName() || 'null'} -> ${stateName}`);
    return true;
  }

  /**
   * Check for and execute automatic transitions
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
   */
  isPaused() {
    return this._paused;
  }

  /**
   * Set global data accessible to all states
   */
  setGlobalData(key, value) {
    this._globalData[key] = value;
  }

  /**
   * Get global data
   */
  getGlobalData(key) {
    return this._globalData[key];
  }

  /**
   * Get all global data
   */
  getAllGlobalData() {
    return { ...this._globalData };
  }

  /**
   * Get state history
   */
  getStateHistory() {
    return [...this._stateHistory];
  }

  /**
   * Go back to previous state
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
