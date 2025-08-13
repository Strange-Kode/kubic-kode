import { GameEntityPlayer } from './game-entity-player.js';
import { Viewport } from '../viewport.js';

import { kubicLog } from "../../kubic-log.js";

/**
* ViewportPlayer extends GameEntityPlayer to add viewport functionality.
* This class provides viewport management capabilities for games that need
* large worlds with player-specific visibility areas.
* 
* Example usage:
* ```javascript
* // Create a player with viewport capabilities
* const player = new ViewportPlayer('player1', 'Alice', { x: 10, y: 10 }, {
*   width: 15,
*   height: 10,
*   autoFollow: true
* });
* 
* // The viewport will automatically follow the player
* player.moveTo(20, 20);
* 
* // Or manually control the viewport
* player.scrollViewport('right', 5);
* player.centerViewportOnPlayer();
* ```
*/
export class ViewportPlayer extends GameEntityPlayer {
  constructor(id, name, position, viewportConfig = {}) {
    super(id, name, position);
    
    // Initialize viewport with default or provided configuration
    const viewportWidth = viewportConfig.width || 10;
    const viewportHeight = viewportConfig.height || 10;
    const viewportX = viewportConfig.x || Math.max(0, position.x - Math.floor(viewportWidth / 2));
    const viewportY = viewportConfig.y || Math.max(0, position.y - Math.floor(viewportHeight / 2));
    
    this.viewport = new Viewport(viewportX, viewportY, viewportWidth, viewportHeight);
    this.autoFollow = viewportConfig.autoFollow !== false; // Default to true
  }
  
  moveTo(x, y) {
    super.moveTo(x, y);
    
    // Auto-follow with viewport if enabled
    if (this.autoFollow) {
      this.centerViewportOnPlayer();
    }
    
    kubicLog.debug(`[ViewportPlayer]::moveTo: ${this.name} moved to (${x}, ${y})`);
  }
  
  /**
  * Center the viewport on the player's current position
  */
  centerViewportOnPlayer() {
    const centerX = Math.floor(this.viewport.width / 2);
    const centerY = Math.floor(this.viewport.height / 2);
    
    this.viewport.moveTo(
      this.position.x - centerX,
      this.position.y - centerY
    );
  }
  
  /**
  * Scroll the viewport in a specific direction
  * @param {string} direction - 'up', 'down', 'left', 'right'
  * @param {number} amount - Number of tiles to scroll (default: 1)
  */
  scrollViewport(direction, amount = 1) {
    switch (direction) {
      case 'up':
      this.viewport.moveBy(0, -amount);
      break;
      case 'down':
      this.viewport.moveBy(0, amount);
      break;
      case 'left':
      this.viewport.moveBy(-amount, 0);
      break;
      case 'right':
      this.viewport.moveBy(amount, 0);
      break;
    }
  }
  
  /**
  * Move the viewport to a specific position
  * @param {number} x - X coordinate
  * @param {number} y - Y coordinate
  */
  moveViewportTo(x, y) {
    this.viewport.moveTo(x, y);
  }
  
  /**
  * Resize the viewport
  * @param {number} width - New width
  * @param {number} height - New height
  */
  resizeViewport(width, height) {
    this.viewport.resize(width, height);
  }
  
  /**
  * Get the current viewport
  * @returns {Viewport} The player's viewport
  */
  getViewport() {
    return this.viewport;
  }
  
  /**
  * Check if a position is visible to this player
  * @param {number} x - X coordinate
  * @param {number} y - Y coordinate
  * @returns {boolean} True if the position is visible
  */
  canSeePosition(x, y) {
    return this.viewport.contains(x, y);
  }
  
  /**
  * Enable or disable auto-follow mode
  * @param {boolean} enabled - Whether to enable auto-follow
  */
  setAutoFollow(enabled) {
    this.autoFollow = enabled;
  }
  
  /**
  * Get the visible area bounds for this player
  * @returns {Object} {left, right, top, bottom} bounds
  */
  getVisibleBounds() {
    return this.viewport.getBounds();
  }
  
  toJSON() {
    return {
      ...super.toJSON(),
      viewport: this.viewport.toJSON(),
      autoFollow: this.autoFollow
    };
  }
}
