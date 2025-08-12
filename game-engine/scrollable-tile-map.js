import { TileMap } from './tile-map.js';

export class ScrollableTileMap extends TileMap {
  constructor(width, height) {
    super(width, height);
    this._viewports = new Map(); // playerId -> Viewport
  }

  get viewports() {
    throw new Error("Attempting to access viewports property on ScrollableTileMap. Not allowed, viewports is a protected property.");
  }

  /**
   * Register a viewport for a player
   * @param {string} playerId - The player's ID
   * @param {Viewport} viewport - The viewport instance
   */
  registerViewport(playerId, viewport) {
    this._viewports.set(playerId, viewport);
  }

  /**
   * Unregister a viewport for a player
   * @param {string} playerId - The player's ID
   */
  unregisterViewport(playerId) {
    this._viewports.delete(playerId);
  }

  /**
   * Get a player's viewport
   * @param {string} playerId - The player's ID
   * @returns {Viewport|null} The viewport or null if not found
   */
  getViewport(playerId) {
    return this._viewports.get(playerId) || null;
  }

  /**
   * Get the visible tiles for a specific player based on their viewport
   * @param {string} playerId - The player's ID
   * @returns {Array} Array of visible tiles with their positions
   */
  getVisibleTiles(playerId) {
    const viewport = this.getViewport(playerId);
    if (!viewport) {
      return [];
    }

    const visibleTiles = [];
    const { x: viewX, y: viewY, width: viewWidth, height: viewHeight } = viewport;

    for (let y = viewY; y < viewY + viewHeight; y++) {
      for (let x = viewX; x < viewX + viewWidth; x++) {
        if (this.inBounds(x, y)) {
          visibleTiles.push({
            x,
            y,
            value: this.getTile(x, y),
            relativeX: x - viewX,
            relativeY: y - viewY
          });
        }
      }
    }

    return visibleTiles;
  }

  /**
   * Scroll a player's viewport in a specific direction
   * @param {string} playerId - The player's ID
   * @param {string} direction - 'up', 'down', 'left', 'right'
   * @param {number} amount - Number of tiles to scroll (default: 1)
   * @returns {boolean} True if scroll was successful, false if out of bounds
   */
  scrollViewport(playerId, direction, amount = 1) {
    const viewport = this.getViewport(playerId);
    if (!viewport) {
      return false;
    }

    const newViewport = { ...viewport };

    switch (direction) {
      case 'up':
        newViewport.y = Math.max(0, viewport.y - amount);
        break;
      case 'down':
        newViewport.y = Math.min(this._height - viewport.height, viewport.y + amount);
        break;
      case 'left':
        newViewport.x = Math.max(0, viewport.x - amount);
        break;
      case 'right':
        newViewport.x = Math.min(this._width - viewport.width, viewport.x + amount);
        break;
      default:
        return false;
    }

    // Check if the new viewport is valid
    if (newViewport.x < 0 || newViewport.y < 0 || 
        newViewport.x + newViewport.width > this._width || 
        newViewport.y + newViewport.height > this._height) {
      return false;
    }

    // Update the viewport
    viewport.x = newViewport.x;
    viewport.y = newViewport.y;
    return true;
  }

  /**
   * Center a player's viewport on a specific position
   * @param {string} playerId - The player's ID
   * @param {number} x - Target X coordinate
   * @param {number} y - Target Y coordinate
   * @returns {boolean} True if centering was successful
   */
  centerViewportOn(playerId, x, y) {
    const viewport = this.getViewport(playerId);
    if (!viewport) {
      return false;
    }

    // Calculate the center position
    const centerX = Math.floor(viewport.width / 2);
    const centerY = Math.floor(viewport.height / 2);

    // Calculate new viewport position
    const newX = Math.max(0, Math.min(this._width - viewport.width, x - centerX));
    const newY = Math.max(0, Math.min(this._height - viewport.height, y - centerY));

    // Update viewport
    viewport.x = newX;
    viewport.y = newY;
    return true;
  }

  /**
   * Follow a player's position with their viewport
   * @param {string} playerId - The player's ID
   * @param {Object} playerPosition - {x, y} position of the player
   * @returns {boolean} True if following was successful
   */
  followPlayer(playerId, playerPosition) {
    return this.centerViewportOn(playerId, playerPosition.x, playerPosition.y);
  }

  /**
   * Get all registered viewports
   * @returns {Map} Map of playerId -> Viewport
   */
  getAllViewports() {
    return new Map(this._viewports);
  }

  /**
   * Check if a position is visible to a specific player
   * @param {string} playerId - The player's ID
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} True if the position is visible to the player
   */
  isPositionVisible(playerId, x, y) {
    const viewport = this.getViewport(playerId);
    if (!viewport) {
      return false;
    }

    return x >= viewport.x && x < viewport.x + viewport.width &&
           y >= viewport.y && y < viewport.y + viewport.height;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      viewports: Object.fromEntries(this._viewports)
    };
  }
} 