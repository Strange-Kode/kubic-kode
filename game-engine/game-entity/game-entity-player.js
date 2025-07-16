import { GameEntity } from './GameEngine.js';

export class GameEntityPlayer extends GameEntity {
    constructor(id, name, position) {
        super(id, name, position);
    }

    moveTo(x, y) {
        this.position = { x, y };
        console.log(`${this.name} moved to (${x}, ${y})`);
    }

    update() {
        // Example AI or player logic per turn/frame
        console.log(`${this.name} is waiting for action...`);
    }
}
