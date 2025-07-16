export class GameEntity {
    constructor(id, name, position) {
        this.id = id;
        this.name = name;
        this.position = position; // { x: number, y: number }
    }
    
    getPlayerId() {
        return this.id;
    }
    
    getPlayerName() {
        return this.name;
    }
    
    getPlayerPosition() {
        return this.position;
    }

    update() {
        // Override in subclasses
    }
}
