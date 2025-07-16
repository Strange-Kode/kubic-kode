import { TileMap } from "./tile-map.js";

export class GameEngine {
  constructor(tilemapWidth, tilemapHeight) {
    this.player_entities = [];
    this.registeredComponents = new Map(); // componentFunc -> componentName
    this.componentNames = new Set(); // set of all names in use
    this.tileMap = new TileMap(tilemapWidth, tilemapHeight);
    this.currentTurnIndex = 0;
    this.gameStarted = false;
  }

  registerEntity(entity) {
    this.player_entities.push(entity);
  }

  deregisterEntity(entityId) {
    this.player_entities = this.player_entities.filter(
      (e) => e.id !== entityId
    );
  }

  startGame() {
    if (this.gameStarted === true) {
      throw new Error(`Game is already started.`);
    }
    this.gameStarted = true;
  }

  stopGame() {
    if (this.gameStarted === false) {
      throw new Error(`Game is already stopped.`);
    }
    this.gameStarted = false;
  }

  getCurrentPlayer() {
    return this.player_entities[this.currentTurnIndex];
  }

  nextTurn() {
    this.currentTurnIndex =
      (this.currentTurnIndex + 1) % this.player_entities.length;
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
      throw new Error(
        "Component function missing static componentName property."
      );
    }

    if (this.registeredComponents.has(componentFunc)) {
      throw new Error(
        `Component function already registered as "${componentName}".`
      );
    }

    if (this.componentNames.has(componentName)) {
      throw new Error(
        `Component name "${componentName}" is already registered.`
      );
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
