import { GameEntity } from "../../../../game-engine/game-entity/game-entity.js";

class MarkEntity extends GameEntity {
  constructor({ type, owner, position }) {
    super(null, type, position);
    this._type = type; // 'X' or 'O'
    this._owner = owner; // Reference to PlayerEntity
    this._position = position; // e.g., { x: 1, y: 2 }
  }

  get type() {
    throw new Error("Attempting to access type property on MarkEntity. Use getMarkType() instead.");
  }

  getMarkType() {
    return this._type;
  }

  get owner() {
    throw new Error("Attempting to access owner property on MarkEntity. Use getOwner() instead.");
  }

  getOwner() {
    return this._owner;
  }

  toJSON() {
    return {
      type: this._type,
      owner: {
        id: this._owner.getPlayerId(),
        name: this._owner.getPlayerName(),
      },
      position: this._position,
    };
  }
}

export default MarkEntity;
