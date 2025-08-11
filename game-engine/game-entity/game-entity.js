/**
 * Base class for all game entities.
 * 
 * This class provides a base implementation for all game entities.
 * It is not meant to be instantiated directly.
 * 
 * @abstract
 */
export class GameEntity {
    constructor(id, name, position) {
        this._id = id;
        this._name = name;
        this._position = position; // { x: number, y: number }
    }

    get id() {
        throw new Error("Attempting to access id property on GameEntity. Use getEntityId() or getPlayerId() instead.");
    }
    
    getEntityId() {
        return this._id;
    }
    
    getEntityName() {
        return this._name;
    }

    get name() {
        throw new Error("Attempting to access name property on GameEntity. Use getEntityName() or getPlayerName() instead.");
    }
    
    getEntityPosition() {
        return this._position;
    }

    get position() {
        throw new Error("Attempting to access position property on GameEntity. Use getEntityPosition() or getPlayerPosition() instead.");
    }

    update() {
        // Override in subclasses
        throw new Error("Implement update() in subclass.");
    }
    
    toJSON() {
        // Override in subclasses
        throw new Error("Implement toJSON() in subclass.");
    }
}
