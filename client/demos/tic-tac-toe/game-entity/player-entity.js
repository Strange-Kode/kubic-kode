import { GameEntity } from "../../../../game-engine/game-entity/game-entity.js";
import MarkEntity from "./mark-entity.js";

class PlayerEntity extends GameEntity {
  constructor(name, markType, isComputer=false) {
    // Generate a simple ID based on the markType for now
    const playerId = markType === "X" ? 1 : 2;
    super(playerId, name, null); // Pass id, name, position to parent
    this.markType = markType; // 'X' or 'O'
    this.marks = []; // List of MarkEntity objects
    this.isComputer = isComputer;
  }

  placeMark(position) {
    const mark = new MarkEntity({
      type: this.markType,
      owner: this,
      position,
    });
    this.marks.push(mark);
    return mark;
  }
  
  getPlayerType() {
    if (this.isComputer) {
      return 'computer';
    }
    return 'human';
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      position: this.position,
      markType: this.markType,
      marks: this.marks
    };
  }
}

export default PlayerEntity;
