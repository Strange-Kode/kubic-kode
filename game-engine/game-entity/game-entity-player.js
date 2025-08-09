import { GameEntity } from './game-entity.js';

import { kubicLog } from "../../kubic-log.js";

export class GameEntityPlayer extends GameEntity {
    constructor(id, name, position) {
        super(id, name, position);
    }

    moveTo(x, y) {
        this.position = { x, y };
        kubicLog.debug(`[GameEntityPlayer]::moveTo: ${this.name} moved to (${x}, ${y})`);
    }

    update() {
        // Example AI or player logic per turn/frame
        kubicLog.debug(`[GameEntityPlayer]::update: ${this.name} is waiting for action...`);
    }
}
