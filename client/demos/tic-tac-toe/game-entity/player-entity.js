import { GameEntity } from '../game-engine/game-entity/game-entity.js';

class PlayerEntity extends GameEntity {
    constructor(name, markType) {
        super();
        this.name = name;
        this.markType = markType; // 'X' or 'O'
        this.marks = []; // List of MarkEntity objects
    }

    placeMark(position) {
        const mark = new MarkEntity({
            type: this.markType,
            owner: this,
            position
        });
        this.marks.push(mark);
        return mark;
    }
}
