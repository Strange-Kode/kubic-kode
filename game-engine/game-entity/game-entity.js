import { 
  KubicSystemError, 
  ErrorFactory,
  ErrorCodes 
} from "../kubic-kode-error.js";

/**
* Base class for all game entities.
* 
* This class provides a base implementation for all game entities.
* It is not meant to be instantiated directly.
* 
* @abstract
*/
export class GameEntity {
  /**
   * Create a new game entity
   * @param {string} id - Unique identifier for the entity
   * @param {string} name - Display name for the entity
   * @param {Object} position - Position object with x and y coordinates
   * @param {number} position.x - X coordinate
   * @param {number} position.y - Y coordinate
   */
  constructor(id, name, position) {
    this._id = id;
    this._name = name;
    this._position = position; // { x: number, y: number }
  }
  
  get id() {
    throw ErrorFactory.system(
      "Attempting to access id property on GameEntity. Use getEntityId() or getPlayerId() instead.",
      "GameEntity",
      { context: { suggestion: "Use getEntityId() or getPlayerId() method instead", property: "id" } }
    );
  }
  
  /**
   * Get the entity's unique identifier
   * @returns {string} The entity ID
   */
  getEntityId() {
    return this._id;
  }
  
  /**
   * Get the entity's display name
   * @returns {string} The entity name
   */
  getEntityName() {
    return this._name;
  }
  
  get name() {
    throw ErrorFactory.system(
      "Attempting to access name property on GameEntity. Use getEntityName() or getPlayerName() instead.",
      "GameEntity",
      { context: { suggestion: "Use getEntityName() or getPlayerName() method instead", property: "name" } }
    );
  }
  
  /**
   * Get the entity's current position
   * @returns {Object} Position object with x and y coordinates
   * @returns {number} returns.x - X coordinate
   * @returns {number} returns.y - Y coordinate
   */
  getEntityPosition() {
    return this._position;
  }
  
  get position() {
    throw ErrorFactory.system(
      "Attempting to access position property on GameEntity. Use getEntityPosition() or getPlayerPosition() instead.",
      "GameEntity",
      { context: { suggestion: "Use getEntityPosition() or getPlayerPosition() method instead", property: "position" } }
    );
  }
  
  /**
   * Update the entity's state (called each frame)
   * Override in subclasses to implement entity-specific update logic
   * @throws {Error} If not implemented in subclass
   * @deprecated - Not used, will be removed in v. 1.1.x.
   */
  update() {
    // Override in subclasses
    throw ErrorFactory.system(
      "Implement update() in subclass.",
      "GameEntity",
      { context: { method: "update", suggestion: "Override update() method in your entity subclass" } }
    );
  }
  
  /**
   * Convert the entity to a JSON representation
   * Override in subclasses to implement entity-specific serialization
   * @returns {Object} JSON representation of the entity
   * @throws {Error} If not implemented in subclass
   */
  toJSON() {
    // Override in subclasses
    throw ErrorFactory.system(
      "Implement toJSON() in subclass.",
      "GameEntity",
      { context: { method: "toJSON", suggestion: "Override toJSON() method in your entity subclass" } }
    );
  }
}
