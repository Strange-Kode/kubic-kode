import { GameEntity } from "../../../../game-engine/game-entity/game-entity.js";

class MarkEntity extends GameEntity {
  constructor({ type, owner, position }) {
    super();
    this.type = type; // 'X' or 'O'
    this.owner = owner; // Reference to PlayerEntity
    this.position = position; // e.g., { x: 1, y: 2 }
  }
}

export default MarkEntity;
