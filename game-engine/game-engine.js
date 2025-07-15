export class GameEngine {
    constructor(tilemapWidth, tilemapHeight) {
        this.entities = [];
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
}