import { TileMap } from "./tile-map.js";

export class GameEngine {
  constructor(tilemapWidth, tilemapHeight) {
    this.player_entities = [];
    this.registeredComponents = new Map(); // componentFunc -> componentName
    this.componentNames = new Set(); // set of all names in use
    this.tileMap = new TileMap(tilemapWidth, tilemapHeight);
    this.currentTurnIndex = 0; // keeps track of current player
    this.currentTurnNumber = 1; // keeps track of amount of turns played between game started and stopped
    this.gameStarted = false;
  }

  getEntities() {
    return this.player_entities;
  }

  registerPlayerEntity(entity) {
    this.player_entities.push(entity);
  }

  deregisterPlayerEntity(entityId) {
    this.player_entities = this.player_entities.filter(e => e.id !== entityId);
  }
  
  getPlayerEntities() {
    return this.player_entities;
  }
  
  startGame() {
    if (this.gameStarted === true) {
      throw new Error(`Game is already started.`);
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
  }

  getCurrentPlayer() {
    return this.player_entities[this.currentTurnIndex];
  }

  nextTurn() {
    this.currentTurnIndex =
      (this.currentTurnIndex + 1) % this.player_entities.length;
    this.currentTurnNumber++;
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