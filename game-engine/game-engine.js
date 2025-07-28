import { TileMap } from "./tile-map.js";

export class GameEngine {
  constructor(tilemapWidth, tilemapHeight, turnConfig = {}) {
    this._player_entities = [];
    this._registeredComponents = new Map(); // componentFunc -> componentName
    this._componentNames = new Set(); // set of all names in use
    this._tilemapWidth = tilemapWidth;
    this._tilemapHeight = tilemapHeight;
    this._tileMap = new TileMap(this._tilemapWidth, this._tilemapHeight);
    this._currentTurnIndex = 0; // keeps track of current player
    this._currentTurnNumber = 1; // keeps track of amount of turns played between game started and stopped
    this._gameStarted = false;

    // Turn config
    this._playStyle = turnConfig.playStyle || "single-set";
    // For single-set and multi-set: [id1, id2, ...]
    // For multi-subset: [[id1, id2], [id3, id4], ...]
    this._turnOrder = turnConfig.turnOrder || [];
    // For multi-set: track which players have acted this round
    this._actedThisRound = new Set();
  }

  getEntities() {
    return this._player_entities;
  }

  registerPlayerEntity(entity) {
    this._player_entities.push(entity);
    // Automatically update turnOrder for single-set and multi-set
    if (this._playStyle === "single-set" || this._playStyle === "multi-set") {
      this._turnOrder = this._player_entities.map(e => e.id);
    }
    // For multi-subset, only set turnOrder if not already set
    if (this._playStyle === "multi-subset" && this._turnOrder.length === 0) {
      this._turnOrder = [this._player_entities.map(e => e.id)];
    }
  }

  deregisterPlayerEntity(entityId) {
    this._player_entities = this._player_entities.filter(e => e.id !== entityId);
    // Automatically update turnOrder for single-set and multi-set
    if (this._playStyle === "single-set" || this._playStyle === "multi-set") {
      this._turnOrder = this._player_entities.map(e => e.id);
    }
    // For multi-subset, only update if turnOrder was default
    if (this._playStyle === "multi-subset" && this._turnOrder.length === 1) {
      this._turnOrder = [this._player_entities.map(e => e.id)];
    }
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
  }
  
  getTurnNumber() {
    return this._currentTurnNumber;
  }

  update() {
    for (const player_entity of this._player_entities) {
      player_entity.update();
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
    this._tileMap = new TileMap(this._tilemapWidth, this._tilemapHeight);
  }

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
}