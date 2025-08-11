import { GameEntity } from "../../../../game-engine/game-entity/game-entity.js";
import MarkEntity from "./mark-entity.js";

class PlayerEntity extends GameEntity {
  constructor(name, markType, isComputer=false) {
    // Generate a simple ID based on the markType for now
    const playerId = markType === "X" ? 1 : 2;
    super(playerId, name, null); // Pass id, name, position to parent
    this._markType = markType; // 'X' or 'O'
    this._marks = []; // List of MarkEntity objects
    this._isComputer = isComputer;
  }

  get marks() {
    throw new Error("Attempting to access marks property on PlayerEntity. Use getMarks() instead.");
  }

  getMarks() {
    return this._marks;
  }

  get isComputer() {
    throw new Error("Attempting to access isComputer property on PlayerEntity. Use isComputer() instead.");
  }

  isComputer() {
    return this._isComputer;
  }

  get markType() {
    throw new Error("Attempting to access markType property on PlayerEntity. Use getMarkType() instead.");
  }

  getMarkType() {
    return this._markType;
  }

  placeMark(position) {
    const mark = new MarkEntity({
      type: this._markType,
      owner: this,
      position,
    });
    this._marks.push(mark);
    return mark;
  }

  getPlayerId() {
    return this.getEntityId();
  }

  getPlayerName() {
    return this.getEntityName();
  }

  getPlayerPosition() {
    return this.getEntityPosition();
  }

  getPlayerType() {
    if (this.isComputer()) {
      return 'computer';
    }
    return 'human';
  }

  clearMarks() {
    this._marks = [];
  }

  toJSON() {
    return {
      id: this.getPlayerId(),
      name: this.getPlayerName(),
      position: this.getPlayerPosition(),
      markType: this._markType,
      marks: this._marks
    };
  }
}

export default PlayerEntity;
