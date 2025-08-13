import { ScrollableTileMap } from "./scrollable-tile-map.js";

/**
* ScrollableTileMapManager encapsulates viewport-specific functionality.
* This class provides a clean interface for managing viewports while
* delegating tile map operations to the underlying ScrollableTileMap.
* 
* Example usage:
* ```javascript
* const manager = new ScrollableTileMapManager(100, 100);
* 
* // Register a player's viewport
* manager.registerPlayerViewport("player1", viewport);
* 
* // Get visible tiles for a player
* const visibleTiles = manager.getVisibleTilesForPlayer("player1");
* 
* // For tile operations, use getTileMap()
* const tileMap = manager.getTileMap();
* tileMap.setTile(10, 10, "treasure");
* ```
*/
export class ScrollableTileMapManager {
  constructor(width, height) {
    this._tileMap = new ScrollableTileMap(width, height);
    this._width = width;
    this._height = height;
  }
  
  /**
  * Get the underlying scrollable tile map
  * @returns {ScrollableTileMap} The scrollable tile map instance
  */
  getTileMap() {
    return this._tileMap;
  }
  
  /**
  * Get the width of the tile map
  * @returns {number} The width
  */
  getWidth() {
    return this._width;
  }
  
  /**
  * Get the height of the tile map
  * @returns {number} The height
  */
  getHeight() {
    return this._height;
  }
  
  /**
  * Register a viewport for a player
  * @param {string} playerId - The player's ID
  * @param {Viewport} viewport - The viewport instance
  */
  registerPlayerViewport(playerId, viewport) {
    this._tileMap.registerViewport(playerId, viewport);
  }
  
  /**
  * Unregister a viewport for a player
  * @param {string} playerId - The player's ID
  */
  unregisterPlayerViewport(playerId) {
    this._tileMap.unregisterViewport(playerId);
  }
  
  /**
  * Get a player's viewport
  * @param {string} playerId - The player's ID
  * @returns {Viewport|null} The viewport or null if not found
  */
  getPlayerViewport(playerId) {
    return this._tileMap.getViewport(playerId);
  }
  
  /**
  * Get visible tiles for a specific player
  * @param {string} playerId - The player's ID
  * @returns {Array} Array of visible tiles
  */
  getVisibleTilesForPlayer(playerId) {
    return this._tileMap.getVisibleTiles(playerId);
  }
  
  /**
  * Scroll a player's viewport
  * @param {string} playerId - The player's ID
  * @param {string} direction - "up", "down", "left", "right"
  * @param {number} amount - Number of tiles to scroll
  * @returns {boolean} True if scroll was successful
  */
  scrollPlayerViewport(playerId, direction, amount = 1) {
    return this._tileMap.scrollViewport(playerId, direction, amount);
  }
  
  /**
  * Center a player's viewport on a position
  * @param {string} playerId - The player's ID
  * @param {number} x - X coordinate
  * @param {number} y - Y coordinate
  * @returns {boolean} True if centering was successful
  */
  centerPlayerViewportOn(playerId, x, y) {
    return this._tileMap.centerViewportOn(playerId, x, y);
  }
  
  /**
  * Follow a player's position with their viewport
  * @param {string} playerId - The player's ID
  * @param {Object} playerPosition - {x, y} position of the player
  * @returns {boolean} True if following was successful
  */
  followPlayerWithViewport(playerId, playerPosition) {
    return this._tileMap.followPlayer(playerId, playerPosition);
  }
  
  /**
  * Check if a position is visible to a specific player
  * @param {string} playerId - The player's ID
  * @param {number} x - X coordinate
  * @param {number} y - Y coordinate
  * @returns {boolean} True if the position is visible
  */
  isPositionVisibleToPlayer(playerId, x, y) {
    return this._tileMap.isPositionVisible(playerId, x, y);
  }
  
  /**
  * Get all registered viewports
  * @returns {Map} Map of playerId -> Viewport
  */
  getAllViewports() {
    return this._tileMap.getAllViewports();
  }
  
  /**
  * Resize the tile map
  * @param {number} newWidth - New width
  * @param {number} newHeight - New height
  */
  resize(newWidth, newHeight) {
    this._tileMap.resize(newWidth, newHeight);
    this._width = newWidth;
    this._height = newHeight;
  }
  
  /**
  * Convert the manager to JSON
  * @returns {Object} JSON representation
  */
  toJSON() {
    return {
      width: this._width,
      height: this._height,
      tileMap: this._tileMap.toJSON()
    };
  }
}
