export class GameEntity {
    constructor(id, name, position) {
        this.id = id;
        this.name = name;
        this.position = position; // { x: number, y: number }
    }

    update() {
        // Override in subclasses
    }
}
