import { kubicLog } from "../kubic-log.js";

/**
 * Viewport represents a rectangular subset of a TileMap that a player can see.
 * It defines the visible area for a player, enabling fog-of-war and large world support.
 * 
 * A viewport is essentially a "camera" that shows only a portion of the entire game world.
 * This allows games to have massive tile maps while maintaining performance by only
 * processing and rendering the tiles that each player can actually see.
 * 
 * Example usage:
 * ```javascript
 * // Create a viewport showing a 15x10 area starting at position (5, 5)
 * const viewport = new Viewport(5, 5, 15, 10);
 * 
 * // Check if a position is visible to this player
 * if (viewport.contains(10, 8)) {
 *   kubicLog.info('Player can see this position');
 * }
 * 
 * // Move the viewport to follow the player
 * viewport.moveTo(player.x - 7, player.y - 5);
 * 
 * // Get the center of the viewport
 * const center = viewport.getCenter();
 * ```
 */
export class Viewport {
  /**
   * Create a new viewport
   * @param {number} x - X coordinate of the viewport's top-left corner
   * @param {number} y - Y coordinate of the viewport's top-left corner
   * @param {number} width - Width of the viewport in tiles
   * @param {number} height - Height of the viewport in tiles
   */
  constructor(x = 0, y = 0, width = 10, height = 10) {
    this._x = x;
    this._y = y;
    this._width = width;
    this._height = height;
  }

  get x() {
    throw new Error("Attempting to access x property on Viewport. Not allowed, x is a protected property. Use getX() instead.");
  }

  getX() {
    return this._x;
  }

  get y() {
    throw new Error("Attempting to access y property on Viewport. Not allowed, y is a protected property. Use getY() instead.");
  }

  getY() {
    return this._y;
  }

  get width() {
    throw new Error("Attempting to access width property on Viewport. Not allowed, width is a protected property. Use getWidth() instead.");
  }

  getWidth() {
    return this._width;
  }

  get height() {
    throw new Error("Attempting to access height property on Viewport. Not allowed, height is a protected property. Use getHeight() instead.");
  }

  getHeight() {
    return this._height;
  }

  /**
   * Move the viewport to a new position
   * @param {number} x - New X coordinate
   * @param {number} y - New Y coordinate
   */
  moveTo(x, y) {
    this._x = x;
    this._y = y;
  }

  /**
   * Move the viewport by a relative amount
   * @param {number} deltaX - Change in X coordinate
   * @param {number} deltaY - Change in Y coordinate
   */
  moveBy(deltaX, deltaY) {
    this._x += deltaX;
    this._y += deltaY;
  }

  /**
   * Resize the viewport
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this._width = width;
    this._height = height;
  }

  /**
   * Check if a position is within this viewport
   * @param {number} x - X coordinate to check
   * @param {number} y - Y coordinate to check
   * @returns {boolean} True if the position is within the viewport
   */
  contains(x, y) {
    return x >= this._x && x < this._x + this._width &&
           y >= this._y && y < this._y + this._height;
  }

  /**
   * Get the center position of the viewport
   * @returns {Object} {x, y} coordinates of the center
   */
  getCenter() {
    return {
      x: Math.floor(this._x + this._width / 2),
      y: Math.floor(this._y + this._height / 2)
    };
  }

  /**
   * Get the bounds of the viewport
   * @returns {Object} {left, right, top, bottom} bounds
   */
  getBounds() {
    return {
      left: this._x,
      right: this._x + this._width - 1,
      top: this._y,
      bottom: this._y + this._height - 1
    };
  }

  /**
   * Check if this viewport intersects with another viewport
   * @param {Viewport} other - Another viewport to check against
   * @returns {boolean} True if the viewports intersect
   */
  intersects(other) {
    return !(this._x + this._width <= other._x ||
             other._x + other._width <= this._x ||
             this._y + this._height <= other._y ||
             other._y + other._height <= this._y);
  }

  /**
   * Get the intersection area with another viewport
   * @param {Viewport} other - Another viewport
   * @returns {Viewport|null} Intersection viewport or null if no intersection
   */
  getIntersection(other) {
    if (!this.intersects(other)) {
      return null;
    }

    const left = Math.max(this._x, other._x);
    const top = Math.max(this._y, other._y);
    const right = Math.min(this._x + this._width, other._x + other._width);
    const bottom = Math.min(this._y + this._height, other._y + other._height);

    return new Viewport(left, top, right - left, bottom - top);
  }

  /**
   * Clone this viewport
   * @returns {Viewport} A new viewport with the same properties
   */
  clone() {
    return new Viewport(this._x, this._y, this._width, this._height);
  }

  /**
   * Convert world coordinates to viewport-relative coordinates
   * @param {number} worldX - World X coordinate
   * @param {number} worldY - World Y coordinate
   * @returns {Object} {x, y} relative coordinates
   */
  worldToViewport(worldX, worldY) {
    return {
      x: worldX - this._x,
      y: worldY - this._y
    };
  }

  /**
   * Convert viewport-relative coordinates to world coordinates
   * @param {number} viewportX - Viewport-relative X coordinate
   * @param {number} viewportY - Viewport-relative Y coordinate
   * @returns {Object} {x, y} world coordinates
   */
  viewportToWorld(viewportX, viewportY) {
    return {
      x: viewportX + this._x,
      y: viewportY + this._y
    };
  }

  /**
   * Ensure the viewport stays within the bounds of a tile map
   * @param {number} mapWidth - Width of the tile map
   * @param {number} mapHeight - Height of the tile map
   */
  clampToMap(mapWidth, mapHeight) {
    this._x = Math.max(0, Math.min(mapWidth - this._width, this._x));
    this._y = Math.max(0, Math.min(mapHeight - this._height, this._y));
  }

  /**
   * Check if the viewport is valid for a given map size
   * @param {number} mapWidth - Width of the tile map
   * @param {number} mapHeight - Height of the tile map
   * @returns {boolean} True if the viewport is valid
   */
  isValidForMap(mapWidth, mapHeight) {
    return this._width > 0 && this._height > 0 &&
           this._x >= 0 && this._y >= 0 &&
           this._x + this._width <= mapWidth &&
           this._y + this._height <= mapHeight;
  }

  toJSON() {
    return {
      x: this._x,
      y: this._y,
      width: this._width,
      height: this._height
    };
  }

  /**
   * Create a viewport from JSON data
   * @param {Object} data - JSON data
   * @returns {Viewport} New viewport instance
   */
  static fromJSON(data) {
    return new Viewport(data.x, data.y, data.width, data.height);
  }
}
