export class GameEngine {
    constructor(tilemapWidth, tilemapHeight) {
        this.entities = [];
        this.registeredComponents = new Map(); // componentFunc -> componentName
        this.componentNames = new Set(); // set of all names in use
        this.tileMap = new TileMap(tilemapWidth, tilemapHeight);
        this.currentTurnIndex = 0;
    }

    registerEntity(entity) {
        this.entities.push(entity);
    }

    deregisterEntity(entityId) {
        this.entities = this.entities.filter(e => e.id !== entityId);
    }

    getCurrentPlayer() {
        return this.entities[this.currentTurnIndex];
    }

    nextTurn() {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % this.entities.length;
    }

    update() {
        for (const entity of this.entities) {
            entity.update();
        }
    }
    
    registerComponent(componentFunc) {
        const componentName = componentFunc.componentName;

        if (!componentName) {
            throw new Error('Component function missing static componentName property.');
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