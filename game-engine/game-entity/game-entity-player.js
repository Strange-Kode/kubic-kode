import { GameEntity } from "./game-entity.js";

import { kubicLog } from "../../kubic-log.js";

export class GameEntityPlayer extends GameEntity {
  constructor(id, name, position) {
    super(id, name, position);
  }
  
  moveTo(x, y) {
    this._position = { x, y };
    kubicLog.debug(`[GameEntityPlayer]::moveTo: ${this.getEntityName()} moved to (${x}, ${y})`);
  }
  
  update() {
    // Example AI or player logic per turn/frame
    kubicLog.debug(`[GameEntityPlayer]::update: ${this.getEntityName()} is waiting for action...`);
  }
}
