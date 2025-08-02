import { TileMap } from "./tile-map.js";
import { ScrollableTileMapManager } from "./scrollable-tile-map-manager.js";
import { GameStateMachine } from "./game-state-machine.js";

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

  getEntities() {
    return this._player_entities;
  }

  registerPlayerEntity(entity) {
    this._player_entities.push(entity);
    
    // Register viewport for scrollable tile map if available
    if (this._useScrollableTileMap && this._scrollableManager && entity.viewport) {
      this._scrollableManager.registerPlayerViewport(entity.id, entity.viewport);
    }
    
    // Automatically update turnOrder for single-set and multi-set
    if (this._playStyle === "single-set" || this._playStyle === "multi-set") {
      this._turnOrder = this._player_entities.map(e => e.id);
    }
    // For multi-subset, only set turnOrder if not already set
    if (this._playStyle === "multi-subset" && this._turnOrder.length === 0) {
      this._turnOrder = [this._player_entities.map(e => e.id)];
    }
    // For non-blocking, don't manage turn order - let game implementation handle it
  }

  deregisterPlayerEntity(entityId) {
    this._player_entities = this._player_entities.filter(e => e.id !== entityId);
    
    // Unregister viewport for scrollable tile map if available
    if (this._useScrollableTileMap && this._scrollableManager) {
      this._scrollableManager.unregisterPlayerViewport(entityId);
    }
    
    // Automatically update turnOrder for single-set and multi-set
    if (this._playStyle === "single-set" || this._playStyle === "multi-set") {
      this._turnOrder = this._player_entities.map(e => e.id);
    }
    // For multi-subset, only update if turnOrder was default
    if (this._playStyle === "multi-subset" && this._turnOrder.length === 1) {
      this._turnOrder = [this._player_entities.map(e => e.id)];
    }
    // For non-blocking, don't manage turn order - let game implementation handle it
  }
  
  getPlayerEntities() {
    return this._player_entities;
  }
  
  getPlayerEntity(playerId) {
    const playerEntity = this._player_entities.find(e => e.id === playerId);
    if (!playerEntity) {
      throw new Error(`Player with ID ${playerId} not found. Registered player entities: ${this._player_entities.map(e => e.id).join(', ')}.`);
    }
    return playerEntity;
  }
  
  startGame() {
    if (this._gameStarted === true) {
      throw new Error(`Game is already started.`);
    }

    if (this._player_entities.length === 0) {
      throw new Error(`No player entities registered.`);
    }
    this._gameStarted = true;
  }

  isGameStarted() {
    return this._gameStarted;
  }

  stopGame() {
    if (this._gameStarted === false) {
      throw new Error(`Game is already stopped.`);
    }
    this._gameStarted = false;
    this._currentTurnIndex = 0;
    this._currentTurnNumber = 1;
    this._actedThisRound.clear();
  }

  getCurrentTurnPlayers() {
    if (this._playStyle === "single-set") {
      const playerId = this._turnOrder[this._currentTurnIndex];
      return this._player_entities.find(e => e.id === playerId);
    }
    else if (this._playStyle === "multi-set") {
      // All players act simultaneously
      return this._player_entities.filter(e => this._turnOrder.includes(e.id));
    }
    else if (this._playStyle === "multi-subset") {
      // Return the current subset (array of player entities)
      const currentSubset = this._turnOrder[this._currentTurnIndex];
      return this._player_entities.filter(e => currentSubset.includes(e.id));
    }
    else if (this._playStyle === "non-blocking") {
      // All players can act at any time - no turn restrictions
      return this._player_entities;
    }
    // Fallback: all players
    return this._player_entities;
  }
  // @deprecated (use getCurrentTurnPlayers instead)
  getCurrentPlayer() {
    const turn = this.getCurrentTurnPlayers();
    if (Array.isArray(turn)) {
      // Return the first player entity in the group
      return turn[0];
    }
    else {
      return turn;
    }
  }

  getPlayerById(playerId) {
    return this._player_entities.find(e => e.id === playerId);
  }

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
  
  getTurnNumber() {
    return this._currentTurnNumber;
  }

  update(deltaTime = 16) {
    for (const player_entity of this._player_entities) {
      player_entity.update();
    }
    
    // Update state machine if enabled
    if (this._useStateMachine && this._stateMachine) {
      this._stateMachine.update(deltaTime);
    }
  }

  getTileMap() {
    return this._tileMap;
  }
  
  resetTileMap() {
    this._tileMap = new TileMap(this._tilemapWidth, this._tilemapHeight);
  }

  // Method to update tile map dimensions
  // Note: tileMap is completely reset, so all existing tiles are lost
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
      return currentPlayers.some(player => player.id === playerId);
    }
    return currentPlayers && currentPlayers.id === playerId;
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

  registerComponent(componentFunc) {
    const componentName = componentFunc.componentName;

    if (!componentName) {
      throw new Error("Component function missing static componentName property.");
    }

    if (this._registeredComponents.has(componentFunc)) {
      throw new Error(`Component function already registered as "${componentName}".`);
    }

    if (this._componentNames.has(componentName)) {
      throw new Error(`Component name "${componentName}" is already registered.`);
    }

    this._registeredComponents.set(componentFunc, componentName);
    this._componentNames.add(componentName);
  }
  
  applyComponent(entity, componentFunc, ...args) {
    const componentName = this._registeredComponents.get(componentFunc);

    if (!componentName) {
      throw new Error(`Component function not registered.`);
    }

    if (entity[componentName]) {
      throw new Error(`Entity already has component "${componentName}".`);
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
      console.warn('[GameEngine] State machine is not enabled. Use { useStateMachine: true } in engineConfig.');
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
    console.warn('[GameEngine] Cannot transition to state - state machine is not enabled.');
    return false;
  }
}