import { TileMap } from "./tile-map.js";
import { ScrollableTileMapManager } from "./scrollable-tile-map-manager.js";
import { GameStateMachine } from "./game-state-machine.js";
import { kubicLog } from "../kubic-log.js";
import { 
  KubicGameError, 
  KubicSystemError, 
  ErrorFactory,
  ErrorCodes 
} from "./kubic-kode-error.js";

export class GameEngine {
  constructor(tilemapWidth, tilemapHeight, engineConfig = {}) {
    this._player_entities = [];
    this._registeredComponents = new Map(); // componentFunc -> componentName
    this._componentNames = new Set(); // set of all names in use
    this._tilemapWidth = tilemapWidth;
    this._tilemapHeight = tilemapHeight;
    
    // Use regular TileMap by default, scrollable tile map is opt-in
    this._useScrollableTileMap = engineConfig.useScrollableTileMap === true; // Default to false
    this._tileMap = new TileMap(this._tilemapWidth, this._tilemapHeight);
    
    // Initialize scrollable tile map manager if enabled
    this._scrollableManager = null;
    if (this._useScrollableTileMap) {
      this._scrollableManager = new ScrollableTileMapManager(this._tilemapWidth, this._tilemapHeight);
      this._tileMap = this._scrollableManager.getTileMap();
    }
    
    this._currentTurnIndex = 0; // keeps track of current player
    this._currentTurnNumber = 1; // keeps track of amount of turns played between game started and stopped
    this._gameStarted = false;

    // Play styles:
    // - "single-set": One player per turn (e.g., tic-tac-toe)
    // - "multi-set": All players act simultaneously in rounds (e.g., rock-paper-scissors)  
    // - "multi-subset": Subgroup of players per turn (e.g., 2p vs. 2p)
    // - "non-blocking": No turn restrictions, game implementation handles turn logic (e.g. advanced Dungeon Crawler like game)
    this._playStyle = engineConfig.playStyle || "single-set";

    // For single-set and multi-set: [id1, id2, ...]
    // For multi-subset: [[id1, id2], [id3, id4], ...]
    this._turnOrder = engineConfig.turnOrder || [];
    // For multi-set: track which players have acted this round
    this._actedThisRound = new Set();

    // Game State Machine (optional)
    this._useStateMachine = engineConfig.useStateMachine === true;
    this._stateMachine = null;
    if (this._useStateMachine) {
      this._stateMachine = new GameStateMachine(this);
    }
  }

  /**
   * Get all registered entities in the game engine
   * @returns {Array} Array of all registered player entities
   */
  getEntities() {
    return this._player_entities;
  }

  /**
   * Register a player entity with the game engine
   * @param {Object} entity - The player entity to register
   */
  registerPlayerEntity(entity) {
    // Check if player is already registered to prevent duplicates
    const existingPlayer = this._player_entities.find(e => e.getPlayerId() === entity.getPlayerId());
    if (existingPlayer) {
      kubicLog.warn(`[GameEngine] Player ${entity.getPlayerId()} already registered, skipping duplicate registration`);
      return; // Don't add duplicate players
    }
    
    this._player_entities.push(entity);
    
    // Register viewport for scrollable tile map if available
    if (this._useScrollableTileMap && this._scrollableManager && entity.viewport) {
      this._scrollableManager.registerPlayerViewport(entity.getPlayerId(), entity.viewport);
    }
    
    // Automatically update turnOrder for single-set and multi-set
    if (this._playStyle === "single-set" || this._playStyle === "multi-set") {
      this._turnOrder = this._player_entities.map(e => e.getPlayerId());
    }
    // For multi-subset, only set turnOrder if not already set
    if (this._playStyle === "multi-subset" && this._turnOrder.length === 0) {
      this._turnOrder = [this._player_entities.map(e => e.getPlayerId())];
    }
    // For non-blocking, don't manage turn order - let game implementation handle it
  }

  /**
   * Clear all registered players and reset turn state
   * Useful for game restart scenarios
   */
  clearPlayerEntities() {
    this._player_entities = [];
    this._turnOrder = [];
    this._currentTurnIndex = 0;
    this._actedThisRound.clear();
    kubicLog.debug(`[GameEngine] Cleared all player entities and reset turn state`);
  }

  /**
   * Deregister a player entity from the game engine.
   * Removing player entity from the game engine may have side effects,
   * such as changing the turn order.
   * @param {string} entityId - The ID of the player entity to deregister
   */
  deregisterPlayerEntity(entityId) {
    this._player_entities = this._player_entities.filter(e => e.getPlayerId() !== entityId);
    
    // Unregister viewport for scrollable tile map if available
    if (this._useScrollableTileMap && this._scrollableManager) {
      this._scrollableManager.unregisterPlayerViewport(entityId);
    }
    
    // Automatically update turnOrder for single-set and multi-set
    if (this._playStyle === "single-set" || this._playStyle === "multi-set") {
      this._turnOrder = this._player_entities.map(e => e.getPlayerId());
    }
    // For multi-subset, only update if turnOrder was default
    if (this._playStyle === "multi-subset" && this._turnOrder.length === 1) {
      this._turnOrder = [this._player_entities.map(e => e.getPlayerId())];
    }
    // For non-blocking, don't manage turn order - let game implementation handle it
  }
  
  /**
   * Get all registered player entities
   * @returns {Array} Array of all player entities
   */
  getPlayerEntities() {
    return this._player_entities;
  }
  
  /**
   * Get a specific player entity by ID
   * @param {string} playerId - The ID of the player to find
   * @returns {Object} The player entity
   * @throws {Error} If player is not found
   */
  getPlayerEntity(playerId) {
    const playerEntity = this._player_entities.find(e => e.getPlayerId() === playerId);
    if (!playerEntity) {
      throw ErrorFactory.game(
        `Player with ID ${playerId} not found. Registered player entities: ${this._player_entities.map(e => e.getPlayerId()).join(", ")}.`,
        "GameEngine",
        playerId,
        { context: { registeredPlayers: this._player_entities.map(e => e.getPlayerId()) } }
      );
    }
    return playerEntity;
  }
  
  /**
   * Start the game engine
   * @throws {Error} If game is already started or no players are registered
   */
  startGame() {
    if (this._gameStarted === true) {
      throw ErrorFactory.game(
        `Game is already started.`,
        "GameEngine",
        null,
        { context: { currentState: "started", playStyle: this._playStyle } }
      );
    }

    if (this._player_entities.length === 0) {
      throw ErrorFactory.game(
        `No player entities registered.`,
        "GameEngine",
        null,
        { context: { playStyle: this._playStyle, turnOrder: this._turnOrder } }
      );
    }
    this._gameStarted = true;
  }

  /**
   * Check if the game has been started
   * @returns {boolean} True if game is started, false otherwise
   */
  isGameStarted() {
    return this._gameStarted;
  }

  /**
   * Stop the game engine and reset turn state
   * @throws {Error} If game is already stopped
   */
  stopGame() {
    if (this._gameStarted === false) {
      throw ErrorFactory.game(
        `Game is already stopped.`,
        "GameEngine",
        null,
        { context: { currentState: "stopped", playStyle: this._playStyle } }
      );
    }
    this._gameStarted = false;
    this._currentTurnIndex = 0;
    this._currentTurnNumber = 1;
    this._actedThisRound.clear();
  }

  /**
   * Get array of registered player entities whose turn it currently is.
   * Return result depends on set play style.
   * @returns {Object|Array|null} Current turn player(s) or null if no players
   */
  getCurrentTurnPlayers() {
    if (this._playStyle === "single-set") {
      // Safety check for empty turn order
      if (this._turnOrder.length === 0) {
        kubicLog.warn(`[GameEngine] Turn order is empty, returning first player entity`);
        return this._player_entities.length > 0 ? this._player_entities[0] : null;
      }
      
      const playerId = this._turnOrder[this._currentTurnIndex];
      return this._player_entities.find(e => e.getPlayerId() === playerId);
    }
    else if (this._playStyle === "multi-set") {
      // All players act simultaneously
      return this._player_entities.filter(e => this._turnOrder.includes(e.getPlayerId()));
    }
    else if (this._playStyle === "multi-subset") {
      // Return the current subset (array of player entities)
      const currentSubset = this._turnOrder[this._currentTurnIndex];
      return this._player_entities.filter(e => currentSubset.includes(e.getPlayerId()));
    }
    else if (this._playStyle === "non-blocking") {
      // All players can act at any time - no turn restrictions
      return this._player_entities;
    }
    // Fallback: all players
    return this._player_entities;
  }

  /**
   * Find a registered player entity by ID
   * @param {string} playerId - The ID of the player to find
   * @returns {Object|undefined} The player entity or undefined if not found
   */
  getPlayerById(playerId) {
    return this._player_entities.find(e => e.getPlayerId() === playerId);
  }

  /**
   * Advance to the next turn based on play style
   * @param {string} playerId - Optional player ID for tracking who acted (used in multi-set/multi-subset play style)
   */
  nextTurn(playerId = null) {
    if (this._playStyle === "single-set") {
      this._currentTurnIndex = (this._currentTurnIndex + 1) % this._turnOrder.length;
      this._currentTurnNumber++;
      this._actedThisRound.clear();
    }
    else if (this._playStyle === "multi-set") {
      // Mark player as having acted
      if (playerId) this._actedThisRound.add(playerId);
      // If all players have acted, advance round
      if (this._actedThisRound.size >= this._turnOrder.length) {
        this._currentTurnNumber++;
        this._actedThisRound.clear();
      }
    }
    else if (this._playStyle === "multi-subset") {
      // Mark player as having acted (optional, for validation)
      if (playerId) this._actedThisRound.add(playerId);
      // If all players in current subset have acted, advance to next subset
      const currentSubset = this._turnOrder[this._currentTurnIndex];
      if (currentSubset.every(id => this._actedThisRound.has(id))) {
        this._currentTurnIndex = (this._currentTurnIndex + 1) % this._turnOrder.length;
        this._currentTurnNumber++;
        this._actedThisRound.clear();
      }
    }
    else if (this._playStyle === "non-blocking") {
      // For non-blocking, only advance turn number if requested by game implementation
      // This allows game to trigger world updates/events when needed
      this._currentTurnNumber++;
      // Don't clear actedThisRound - let game implementation manage player action tracking
    }
  }
  
  /**
   * Get the current turn number
   * @returns {number} The current turn number
   */
  getTurnNumber() {
    return this._currentTurnNumber;
  }

  /**
   * Update the game engine and all player entities
   * @param {number} deltaTime - Time elapsed since last update in milliseconds (default: 16)
   * @deprecated - Not used, will be removed in v. 1.1.x.
   */
  update(deltaTime = 16) {
    for (const player_entity of this._player_entities) {
      player_entity.update();
    }
    
    // Update state machine if enabled
    if (this._useStateMachine && this._stateMachine) {
      this._stateMachine.update(deltaTime);
    }
  }

  /**
   * Get the current tile map
   * @returns {TileMap} The tile map instance
   */
  getTileMap() {
    return this._tileMap;
  }
  
  /**
   * Reset the tile map to a new instance
   */
  resetTileMap() {
    this._tileMap = new TileMap(this._tilemapWidth, this._tilemapHeight);
  }

  /**
   * Update tile map dimensions and recreate the tile map
   * Note: This completely resets the tile map, so all existing tiles are lost
   * @param {number} newWidth - The new width of the tile map
   * @param {number} newHeight - The new height of the tile map
   */
  updateTileMapDimensions(newWidth, newHeight) {
    this._tilemapWidth = newWidth;
    this._tilemapHeight = newHeight;
    
    if (this._useScrollableTileMap && this._scrollableManager) {
      this._scrollableManager.resize(newWidth, newHeight);
      this._tileMap = this._scrollableManager.getTileMap();
    } else {
      this._tileMap = new TileMap(this._tilemapWidth, this._tilemapHeight);
    }
  }

  // Utility methods for non-blocking games
  // ------------------------------------
  
  /**
   * Check if a player can act (for non-blocking games, always true unless game implements custom logic)
   * @param {string} playerId - The player ID to check
   * @returns {boolean} - Whether the player can act
   */
  canPlayerAct(playerId) {
    if (this._playStyle === "non-blocking") {
      // In non-blocking mode, all players can always act
      // Game implementation can override this logic
      return this.getPlayerById(playerId) !== undefined;
    }
    
    // For other play styles, check if player is in current turn players
    const currentPlayers = this.getCurrentTurnPlayers();
    if (Array.isArray(currentPlayers)) {
      return currentPlayers.some(player => player.getPlayerId() === playerId);
    }
    return currentPlayers && currentPlayers.getPlayerId() === playerId;
  }
  
  /**
   * Mark a player as having acted this round (useful for non-blocking games)
   * @param {string} playerId - The player ID
   */
  markPlayerActed(playerId) {
    this._actedThisRound.add(playerId);
  }
  
  /**
   * Check if a player has acted this round
   * @param {string} playerId - The player ID
   * @returns {boolean} - Whether the player has acted
   */
  hasPlayerActed(playerId) {
    return this._actedThisRound.has(playerId);
  }
  
  /**
   * Get all players who have acted this round
   * @returns {Set<string>} - Set of player IDs who have acted
   */
  getPlayersWhoActed() {
    return new Set(this._actedThisRound);
  }
  
  /**
   * Clear the acted players tracking (useful for world update cycles)
   */
  clearActedPlayers() {
    this._actedThisRound.clear();
  }
  
  /**
   * Get the current play style
   * @returns {string} - The play style
   */
  getPlayStyle() {
    return this._playStyle;
  }

  /**
   * Register a component function with the game engine
   * @param {Function} componentFunc - The component function to register
   * @throws {Error} If component is missing name or already registered
   */
  registerComponent(componentFunc) {
    const componentName = componentFunc.componentName;

    if (!componentName) {
      throw ErrorFactory.system(
        "Component function missing static componentName property.",
        "GameEngine",
        { context: { componentFunc: componentFunc.toString(), availableProperties: Object.getOwnPropertyNames(componentFunc) } }
      );
    }

    if (this._registeredComponents.has(componentFunc)) {
      throw ErrorFactory.system(
        `Component function already registered as "${componentName}".`,
        "GameEngine",
        { context: { componentName, existingComponent: this._registeredComponents.get(componentFunc) } }
      );
    }

    if (this._componentNames.has(componentName)) {
      throw ErrorFactory.system(
        `Component name "${componentName}" is already registered.`,
        "GameEngine",
        { context: { componentName, registeredComponents: Array.from(this._componentNames) } }
      );
    }

    this._registeredComponents.set(componentFunc, componentName);
    this._componentNames.add(componentName);
  }
  
  /**
   * Apply a component to an entity
   * @param {Object} entity - The entity to apply the component to
   * @param {Function} componentFunc - The component function to apply
   * @param {...any} args - Additional arguments to pass to the component function
   * @throws {Error} If component is not registered or entity already has the component
   */
  applyComponent(entity, componentFunc, ...args) {
    const componentName = this._registeredComponents.get(componentFunc);

    if (!componentName) {
      throw ErrorFactory.system(
        `Component function not registered.`,
        "GameEngine",
        { context: { componentFunc: componentFunc.toString(), registeredComponents: Array.from(this._registeredComponents.values()) } }
      );
    }

    if (entity[componentName]) {
      throw ErrorFactory.system(
        `Entity already has component "${componentName}".`,
        "GameEngine",
        { context: { componentName, entityId: entity.getPlayerId?.() || entity.id, existingComponents: Object.keys(entity) } }
      );
    }

    componentFunc(entity, ...args);
  }

  /**
   * Get the scrollable tile map manager if enabled
   * @returns {ScrollableTileMapManager|null} The scrollable manager or null if not enabled
   */
  getScrollable() {
    if (!this._useScrollableTileMap) {
      return null;
    }
    return this._scrollableManager;
  }

  // Game State Machine methods
  // --------------------------

  /**
   * Check if state machine is enabled
   * @returns {boolean} True if state machine is enabled
   */
  isStateMachineEnabled() {
    return this._useStateMachine;
  }

  /**
   * Get the state machine instance
   * @returns {GameStateMachine|null} The state machine or null if not enabled
   */
  getStateMachine() {
    if (!this._useStateMachine) {
      kubicLog.warn("[GameEngine] State machine is not enabled. Use { useStateMachine: true } in engineConfig.");
      return null;
    }
    return this._stateMachine;
  }

  /**
   * Handle game events through state machine
   * @param {string} eventType - The type of event
   * @param {object} eventData - Event data
   */
  handleGameEvent(eventType, eventData = {}) {
    if (this._useStateMachine && this._stateMachine) {
      this._stateMachine.handleEvent(eventType, eventData);
    }
  }

  /**
   * Handle player actions through state machine
   * @param {string} playerId - The player ID
   * @param {string} action - The action type
   * @param {object} data - Action data
   */
  handlePlayerAction(playerId, action, data = {}) {
    if (this._useStateMachine && this._stateMachine) {
      this._stateMachine.handlePlayerAction(playerId, action, data);
    }
  }

  /**
   * Convenience method to get current game state
   * @returns {GameState|null} Current state or null if GSM not enabled
   */
  getCurrentGameState() {
    if (this._useStateMachine && this._stateMachine) {
      return this._stateMachine.getCurrentState();
    }
    return null;
  }

  /**
   * Convenience method to transition to a new game state
   * @param {string} stateName - Name of the state to transition to
   * @param {object} data - Optional transition data
   * @returns {Promise<boolean>} True if transition was successful
   */
  async transitionToState(stateName, data = {}) {
    if (this._useStateMachine && this._stateMachine) {
      return await this._stateMachine.transitionTo(stateName, data);
    }
    kubicLog.warn("[GameEngine] Cannot transition to state - state machine is not enabled.");
    return false;
  }

  // Turn Order Management
  // ---------------------

  /**
   * Get the current turn order
   * @returns {Array} The turn order array
   */
  getTurnOrder() {
    return [...this._turnOrder]; // Return a copy to prevent direct manipulation
  }

  /**
   * Set the turn order
   * @param {Array} turnOrder - The new turn order
   */
  setTurnOrder(turnOrder) {
    this._turnOrder = [...turnOrder]; // Make a copy to prevent external manipulation
  }

  /**
   * Get the current turn index
   * @returns {number} The current turn index
   */
  getCurrentTurnIndex() {
    return this._currentTurnIndex;
  }

  /**
   * Set the current turn index
   * @param {number} index - The new turn index
   */
  setCurrentTurnIndex(index) {
    if (index >= 0 && index < this._turnOrder.length) {
      this._currentTurnIndex = index;
    } else {
      kubicLog.warn(`[GameEngine] Invalid turn index: ${index}. Valid range: 0-${this._turnOrder.length - 1}`);
    }
  }
}
