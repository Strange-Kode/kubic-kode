export class TileMap {
  constructor(width, height) {
    this._width = width;
    this._height = height;
    this._tiles = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => null)
    );
  }

  get width() {
    throw new Error("Attempting to access width property on TileMap. Not allowed, width is a protected property. Use getWidth() instead.");
  }

  getWidth() {
    return this._width;
  }

  get height() {
    throw new Error("Attempting to access height property on TileMap. Not allowed, height is a protected property. Use getHeight() instead.");
  }

  getHeight() {
    return this._height;
  }

  get tiles() {
    throw new Error("Attempting to access tiles property on TileMap. Not allowed, tiles is a protected property. Use getTiles() instead.");
  }

  getTiles() {
    return this._tiles;
  }

  getTile(x, y) {
    return this._tiles[y][x];
  }

  /**
   * setTile overwrites any existing value at (x, y).
   * If you do not want to overwrite an existing value, use trySetTile() instead.
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {any} value - Value to assign to tile at (x, y)
   */
  setTile(x, y, value) {
    this._tiles[y][x] = value;
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
    return this._tiles[y][x] !== null && this._tiles[y][x] !== undefined;
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

    const previousValue = this._tiles[y][x];
    const wasOccupied = this.isTileOccupied(x, y);

    if (wasOccupied) {
      return { 
        success: false, 
        occupied: true, 
        previousValue: previousValue,
        error: "Tile already occupied" 
      };
    }

    this._tiles[y][x] = value;
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
    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        if (this.isTileOccupied(x, y)) {
          occupied.push({ x, y, value: this._tiles[y][x] });
        }
      }
    }
    return occupied;
  }

  /**
   * Get all empty tile positions
   * @returns {Array} - Array of {x, y} objects for empty tiles
   */
  getEmptyTiles() {
    const empty = [];
    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        if (!this.isTileOccupied(x, y)) {
          empty.push({ x, y });
        }
      }
    }
    return empty;
  }

  /**
   * Count total number of occupied tiles
   * @returns {number} - Number of occupied tiles
   */
  getOccupiedCount() {
    let count = 0;
    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        if (this.isTileOccupied(x, y)) {
          count++;
        }
      }
    }
    return count;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this._width && y < this._height;
  }

  getTotalTiles() {
    return this._width * this._height;
  }

  resize(newWidth, newHeight) {
    // Create new tiles array with the new dimensions
    const newTiles = Array.from({ length: newHeight }, () =>
      Array.from({ length: newWidth }, () => null)
    );

    // Copy existing tiles that fit within the new dimensions
    const maxWidth = Math.min(this._width, newWidth);
    const maxHeight = Math.min(this._height, newHeight);
    
    for (let y = 0; y < maxHeight; y++) {
      for (let x = 0; x < maxWidth; x++) {
        newTiles[y][x] = this._tiles[y][x];
      }
    }

    // Update dimensions and tiles
    this._width = newWidth;
    this._height = newHeight;
    this._tiles = newTiles;
  }

  getArea(startX, startY, endX, endY) {
    const areaTiles = [];
    for (let y = startY; y < endY; y++) {
      const row = [];
      for (let x = startX; x < endX; x++) {
        row.push(this._tiles[y][x]);
      }
      areaTiles.push(row);
    }
    return areaTiles;
  }

  *[Symbol.iterator]() {
    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        yield {
          x,
          y,
          value: this._tiles[y][x]
        };
      }
    }
  }

  toJSON() {
    return {
      width: this._width,
      height: this._height,
      tiles: this._tiles,
    };
  }
}
