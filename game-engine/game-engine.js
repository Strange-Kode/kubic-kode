import { TileMap } from "./tile-map.js";

export class GameEngine {
  constructor(tilemapWidth, tilemapHeight, turnConfig = {}) {
    this.player_entities = [];
    this.registeredComponents = new Map(); // componentFunc -> componentName
    this.componentNames = new Set(); // set of all names in use
    this.tilemapWidth = tilemapWidth;
    this.tilemapHeight = tilemapHeight;
    this.tileMap = new TileMap(this.tilemapWidth, this.tilemapHeight);
    this.currentTurnIndex = 0; // keeps track of current player
    this.currentTurnNumber = 1; // keeps track of amount of turns played between game started and stopped
    this.gameStarted = false;

    // Turn config
    this.playStyle = turnConfig.playStyle || "single-set";
    // For single-set and multi-set: [id1, id2, ...]
    // For multi-subset: [[id1, id2], [id3, id4], ...]
    this.turnOrder = turnConfig.turnOrder || [];
    // For multi-set: track which players have acted this round
    this.actedThisRound = new Set();
  }

  getEntities() {
    return this.player_entities;
  }

  registerPlayerEntity(entity) {
    this.player_entities.push(entity);
    // Automatically update turnOrder for single-set and multi-set
    if (this.playStyle === "single-set" || this.playStyle === "multi-set") {
      this.turnOrder = this.player_entities.map(e => e.id);
    }
    // For multi-subset, only set turnOrder if not already set
    if (this.playStyle === "multi-subset" && this.turnOrder.length === 0) {
      this.turnOrder = [this.player_entities.map(e => e.id)];
    }
  }

  deregisterPlayerEntity(entityId) {
    this.player_entities = this.player_entities.filter(e => e.id !== entityId);
    // Automatically update turnOrder for single-set and multi-set
    if (this.playStyle === "single-set" || this.playStyle === "multi-set") {
      this.turnOrder = this.player_entities.map(e => e.id);
    }
    // For multi-subset, only update if turnOrder was default
    if (this.playStyle === "multi-subset" && this.turnOrder.length === 1) {
      this.turnOrder = [this.player_entities.map(e => e.id)];
    }
  }
  
  getPlayerEntities() {
    return this.player_entities;
  }
  
  getPlayerEntity(playerId) {
    const playerEntity = this.player_entities.find(e => e.id === playerId);
    if (!playerEntity) {
      throw new Error(`Player with ID ${playerId} not found. Registered player entities: ${this.player_entities.map(e => e.id).join(', ')}.`);
    }
    return playerEntity;
  }
  
  startGame() {
    if (this.gameStarted === true) {
      throw new Error(`Game is already started.`);
    }

    if (this.player_entities.length === 0) {
      throw new Error(`No player entities registered.`);
    }
    this.gameStarted = true;
  }

  isGameStarted() {
    return this.gameStarted;
  }

  stopGame() {
    if (this.gameStarted === false) {
      throw new Error(`Game is already stopped.`);
    }
    this.gameStarted = false;
    this.currentTurnIndex = 0;
    this.currentTurnNumber = 1;
    this.actedThisRound.clear();
  }

  getCurrentTurnPlayers() {
    if (this.playStyle === "single-set") {
      const playerId = this.turnOrder[this.currentTurnIndex];
      return this.player_entities.find(e => e.id === playerId);
    }
    else if (this.playStyle === "multi-set") {
      // All players act simultaneously
      return this.player_entities.filter(e => this.turnOrder.includes(e.id));
    }
    else if (this.playStyle === "multi-subset") {
      // Return the current subset (array of player entities)
      const currentSubset = this.turnOrder[this.currentTurnIndex];
      return this.player_entities.filter(e => currentSubset.includes(e.id));
    }
    // Fallback: all players
    return this.player_entities;
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
    return this.player_entities.find(e => e.id === playerId);
  }

  nextTurn(playerId = null) {
    if (this.playStyle === "single-set") {
      this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
      this.currentTurnNumber++;
      this.actedThisRound.clear();
    }
    else if (this.playStyle === "multi-set") {
      // Mark player as having acted
      if (playerId) this.actedThisRound.add(playerId);
      // If all players have acted, advance round
      if (this.actedThisRound.size >= this.turnOrder.length) {
        this.currentTurnNumber++;
        this.actedThisRound.clear();
      }
    }
    else if (this.playStyle === "multi-subset") {
      // Mark player as having acted (optional, for validation)
      if (playerId) this.actedThisRound.add(playerId);
      // If all players in current subset have acted, advance to next subset
      const currentSubset = this.turnOrder[this.currentTurnIndex];
      if (currentSubset.every(id => this.actedThisRound.has(id))) {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.turnOrder.length;
        this.currentTurnNumber++;
        this.actedThisRound.clear();
      }
    }
  }
  
  getTurnNumber() {
    return this.currentTurnNumber;
  }

  update() {
    for (const player_entity of this.player_entities) {
      player_entity.update();
    }
  }

  getTileMap() {
    return this.tileMap;
  }
  
  resetTileMap() {
    this.tileMap = new TileMap(this.tilemapWidth, this.tilemapHeight);
  }

  getPlayStyle() {
    return this.playStyle;
  }

  registerComponent(componentFunc) {
    const componentName = componentFunc.componentName;

    if (!componentName) {
      throw new Error("Component function missing static componentName property.");
    }

    if (this.registeredComponents.has(componentFunc)) {
      throw new Error(`Component function already registered as "${componentName}".`);
    }

    if (this.componentNames.has(componentName)) {
      throw new Error(`Component name "${componentName}" is already registered.`);
    }

    this.registeredComponents.set(componentFunc, componentName);
    this.componentNames.add(componentName);
  }
  
  applyComponent(entity, componentFunc, ...args) {
    const componentName = this.registeredComponents.get(componentFunc);

    if (!componentName) {
      throw new Error(`Component function not registered.`);
    }

    if (entity[componentName]) {
      throw new Error(`Entity already has component "${componentName}".`);
    }

    componentFunc(entity, ...args);
  }
}