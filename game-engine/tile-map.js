export class TileMap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.tiles = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => null)
    );
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

  toJSON() {
    return {
      width: this.width,
      height: this.height,
      tiles: this.tiles,
    };
  }
}
