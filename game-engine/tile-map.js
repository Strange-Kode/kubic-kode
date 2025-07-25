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

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
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

  toJSON() {
    return {
      width: this.width,
      height: this.height,
      tiles: this.tiles,
    };
  }
}
