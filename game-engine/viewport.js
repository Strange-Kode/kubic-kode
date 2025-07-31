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
 *   console.log('Player can see this position');
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
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Move the viewport to a new position
   * @param {number} x - New X coordinate
   * @param {number} y - New Y coordinate
   */
  moveTo(x, y) {
    this.x = x;
    this.y = y;
  }

  /**
   * Move the viewport by a relative amount
   * @param {number} deltaX - Change in X coordinate
   * @param {number} deltaY - Change in Y coordinate
   */
  moveBy(deltaX, deltaY) {
    this.x += deltaX;
    this.y += deltaY;
  }

  /**
   * Resize the viewport
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  /**
   * Check if a position is within this viewport
   * @param {number} x - X coordinate to check
   * @param {number} y - Y coordinate to check
   * @returns {boolean} True if the position is within the viewport
   */
  contains(x, y) {
    return x >= this.x && x < this.x + this.width &&
           y >= this.y && y < this.y + this.height;
  }

  /**
   * Get the center position of the viewport
   * @returns {Object} {x, y} coordinates of the center
   */
  getCenter() {
    return {
      x: Math.floor(this.x + this.width / 2),
      y: Math.floor(this.y + this.height / 2)
    };
  }

  /**
   * Get the bounds of the viewport
   * @returns {Object} {left, right, top, bottom} bounds
   */
  getBounds() {
    return {
      left: this.x,
      right: this.x + this.width - 1,
      top: this.y,
      bottom: this.y + this.height - 1
    };
  }

  /**
   * Check if this viewport intersects with another viewport
   * @param {Viewport} other - Another viewport to check against
   * @returns {boolean} True if the viewports intersect
   */
  intersects(other) {
    return !(this.x + this.width <= other.x ||
             other.x + other.width <= this.x ||
             this.y + this.height <= other.y ||
             other.y + other.height <= this.y);
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

    const left = Math.max(this.x, other.x);
    const top = Math.max(this.y, other.y);
    const right = Math.min(this.x + this.width, other.x + other.width);
    const bottom = Math.min(this.y + this.height, other.y + other.height);

    return new Viewport(left, top, right - left, bottom - top);
  }

  /**
   * Clone this viewport
   * @returns {Viewport} A new viewport with the same properties
   */
  clone() {
    return new Viewport(this.x, this.y, this.width, this.height);
  }

  /**
   * Convert world coordinates to viewport-relative coordinates
   * @param {number} worldX - World X coordinate
   * @param {number} worldY - World Y coordinate
   * @returns {Object} {x, y} relative coordinates
   */
  worldToViewport(worldX, worldY) {
    return {
      x: worldX - this.x,
      y: worldY - this.y
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
      x: viewportX + this.x,
      y: viewportY + this.y
    };
  }

  /**
   * Ensure the viewport stays within the bounds of a tile map
   * @param {number} mapWidth - Width of the tile map
   * @param {number} mapHeight - Height of the tile map
   */
  clampToMap(mapWidth, mapHeight) {
    this.x = Math.max(0, Math.min(mapWidth - this.width, this.x));
    this.y = Math.max(0, Math.min(mapHeight - this.height, this.y));
  }

  /**
   * Check if the viewport is valid for a given map size
   * @param {number} mapWidth - Width of the tile map
   * @param {number} mapHeight - Height of the tile map
   * @returns {boolean} True if the viewport is valid
   */
  isValidForMap(mapWidth, mapHeight) {
    return this.width > 0 && this.height > 0 &&
           this.x >= 0 && this.y >= 0 &&
           this.x + this.width <= mapWidth &&
           this.y + this.height <= mapHeight;
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      width: this.width,
      height: this.height
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