export class TileMap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.tiles = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => null)
    );
  }

  getTiles() {
    return this.tiles;
  }

  getTile(x, y) {
    return this.tiles[y][x];
  }

  setTile(x, y, value) {
    this.tiles[y][x] = value;
  }

  /**
   * Check if a tile is occupied (not null/empty)
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} - True if tile has a value (occupied)
   */
  isTileOccupied(x, y) {
    if (!this.inBounds(x, y)) {
      return false; // Out of bounds tiles are not "occupied"
    }
    return this.tiles[y][x] !== null && this.tiles[y][x] !== undefined;
  }

  /**
   * Attempt to set a tile only if it's currently empty
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {*} value - Value to set
   * @returns {Object} - {success: boolean, occupied: boolean, previousValue: *}
   */
  trySetTile(x, y, value) {
    if (!this.inBounds(x, y)) {
      return { 
        success: false, 
        occupied: false, 
        previousValue: null,
        error: "Out of bounds" 
      };
    }

    const previousValue = this.tiles[y][x];
    const wasOccupied = this.isTileOccupied(x, y);

    if (wasOccupied) {
      return { 
        success: false, 
        occupied: true, 
        previousValue: previousValue,
        error: "Tile already occupied" 
      };
    }

    this.tiles[y][x] = value;
    return { 
      success: true, 
      occupied: false, 
      previousValue: previousValue 
    };
  }

  /**
   * Get all occupied tile positions
   * @returns {Array} - Array of {x, y, value} objects for occupied tiles
   */
  getOccupiedTiles() {
    const occupied = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.isTileOccupied(x, y)) {
          occupied.push({ x, y, value: this.tiles[y][x] });
        }
      }
    }
    return occupied;
  }

  /**
   * Count total number of occupied tiles
   * @returns {number} - Number of occupied tiles
   */
  getOccupiedCount() {
    let count = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.isTileOccupied(x, y)) {
          count++;
        }
      }
    }
    return count;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  getTotalTiles() {
    return this.width * this.height;
  }

  resize(newWidth, newHeight) {
    // Create new tiles array with the new dimensions
    const newTiles = Array.from({ length: newHeight }, () =>
      Array.from({ length: newWidth }, () => null)
    );

    // Copy existing tiles that fit within the new dimensions
    const maxWidth = Math.min(this.width, newWidth);
    const maxHeight = Math.min(this.height, newHeight);
    
    for (let y = 0; y < maxHeight; y++) {
      for (let x = 0; x < maxWidth; x++) {
        newTiles[y][x] = this.tiles[y][x];
      }
    }

    // Update dimensions and tiles
    this.width = newWidth;
    this.height = newHeight;
    this.tiles = newTiles;
  }

  *[Symbol.iterator]() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        yield {
          x,
          y,
          value: this.tiles[y][x]
        };
      }
    }
  }

  toJSON() {
    return {
      width: this.width,
      height: this.height,
      tiles: this.tiles,
    };
  }
}
