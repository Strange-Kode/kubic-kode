# Scrollable TileMap

The Scrollable TileMap feature extends Kubic Kode's tile-based game engine to support large worlds with player-specific viewports. This allows each player to see only a subset of the entire game world, enabling more immersive and performance-friendly large-scale games.

## Overview

The scrollable TileMap system consists of three main components:

1. **ScrollableTileMap** - Extends the base TileMap class with viewport management
2. **Viewport** - Represents a rectangular area of the tile map that a player can see
3. **ViewportPlayer** - Enhanced player entity with viewport integration

## Key Features

- **Player-specific viewports**: Each player has their own view of the world
- **Auto-follow mode**: Viewports can automatically follow player movement
- **Manual scrolling**: Players can manually scroll their viewport
- **Visibility checks**: Determine what each player can see
- **Coordinate conversion**: Convert between world and viewport coordinates
- **Viewport intersection**: Check if viewports overlap

## Usage

### Basic Setup

```javascript
import { GameEngine } from "../game-engine/game-engine.js";
import { ViewportPlayer } from "../game-engine/game-entity/viewport-player.js";

// Create a game engine with scrollable tile map enabled
const gameEngine = new GameEngine(100, 100, {
    useScrollableTileMap: true,  // Enable scrollable tile map
    playStyle: "multi-set"
});

// Create a player with viewport configuration
const player = new ViewportPlayer("player1", "Alice", { x: 10, y: 10 }, {
    width: 15,        // Viewport width in tiles
    height: 10,       // Viewport height in tiles
    autoFollow: true  // Auto-follow player movement
});

// Register the player
gameEngine.registerPlayerEntity(player);
gameEngine.startGame();
```

### Viewport Configuration

When creating a `ViewportPlayer`, you can configure the viewport:

```javascript
const viewportConfig = {
    width: 15,        // Viewport width (default: 10)
    height: 10,       // Viewport height (default: 10)
    x: 5,            // Initial X position (optional, auto-calculated if not provided)
    y: 5,            // Initial Y position (optional, auto-calculated if not provided)
    autoFollow: true  // Auto-follow player movement (default: true)
};

const player = new ViewportPlayer("player1", "Alice", { x: 10, y: 10 }, viewportConfig);
```

### Getting Visible Tiles

```javascript
// Get all tiles visible to a specific player
const scrollable = gameEngine.getScrollable();
const visibleTiles = scrollable.getVisibleTilesForPlayer("player1");

// Each tile includes world coordinates and viewport-relative coordinates
visibleTiles.forEach(tile => {
    console.log(`Tile at (${tile.x}, ${tile.y}) with value "${tile.value}"`);
    console.log(`Relative to viewport: (${tile.relativeX}, ${tile.relativeY})`);
});
```

### Scrolling Viewports

```javascript
// Scroll a player's viewport
const scrollable = gameEngine.getScrollable();
scrollable.scrollPlayerViewport("player1", "right", 3);  // Scroll right by 3 tiles
scrollable.scrollPlayerViewport("player1", "up", 2);     // Scroll up by 2 tiles

// Available directions: "up", "down", "left", "right"
```

### Centering Viewports

```javascript
// Center a player's viewport on a specific position
const scrollable = gameEngine.getScrollable();
scrollable.centerPlayerViewportOn("player1", 25, 25);

// Follow a player's position with their viewport
scrollable.followPlayerWithViewport("player1", player.position);
```

### Visibility Checks

```javascript
// Check if a position is visible to a player
const scrollable = gameEngine.getScrollable();
const isVisible = scrollable.isPositionVisibleToPlayer("player1", 15, 15);
console.log(`Player can see position (15, 15): ${isVisible}`);
```

### Player-Specific Viewport Operations

```javascript
// Get a player's viewport
const viewport = player.getViewport();

// Move the viewport manually
player.moveViewportTo(20, 20);

// Scroll the viewport
player.scrollViewport("left", 5);

// Resize the viewport
player.resizeViewport(20, 15);

// Check if a position is visible to this player
const canSee = player.canSeePosition(25, 25);

// Enable/disable auto-follow
player.setAutoFollow(false);
```

## API Reference

### ScrollableTileMap Methods

- `registerViewport(playerId, viewport)` - Register a viewport for a player
- `unregisterViewport(playerId)` - Unregister a player's viewport
- `getViewport(playerId)` - Get a player's viewport
- `getVisibleTiles(playerId)` - Get tiles visible to a player
- `scrollViewport(playerId, direction, amount)` - Scroll a player's viewport
- `centerViewportOn(playerId, x, y)` - Center a player's viewport on a position
- `followPlayer(playerId, playerPosition)` - Follow a player with their viewport
- `isPositionVisible(playerId, x, y)` - Check if a position is visible to a player

### Viewport Methods

- `moveTo(x, y)` - Move viewport to a specific position
- `moveBy(deltaX, deltaY)` - Move viewport by relative amount
- `resize(width, height)` - Resize the viewport
- `contains(x, y)` - Check if a position is within the viewport
- `getCenter()` - Get the center position of the viewport
- `getBounds()` - Get the bounds of the viewport
- `intersects(other)` - Check if this viewport intersects with another
- `worldToViewport(worldX, worldY)` - Convert world coordinates to viewport coordinates
- `viewportToWorld(viewportX, viewportY)` - Convert viewport coordinates to world coordinates
- `clampToMap(mapWidth, mapHeight)` - Ensure viewport stays within map bounds

### GameEngine ScrollableTileMap Methods

- `getScrollable()` - Get the scrollable tile map manager (returns null if not enabled)

### ScrollableTileMapManager Methods

**Viewport-specific methods:**
- `getVisibleTilesForPlayer(playerId)` - Get visible tiles for a player
- `scrollPlayerViewport(playerId, direction, amount)` - Scroll a player's viewport
- `centerPlayerViewportOn(playerId, x, y)` - Center a player's viewport
- `followPlayerWithViewport(playerId, playerPosition)` - Follow a player with their viewport
- `isPositionVisibleToPlayer(playerId, x, y)` - Check visibility for a player
- `getAllViewports()` - Get all registered viewports
- `getPlayerViewport(playerId)` - Get a player's viewport

**For tile map operations, use `getTileMap()`:**
```javascript
const scrollable = gameEngine.getScrollable();
const tileMap = scrollable.getTileMap();

// Use tile map methods directly
tileMap.setTile(10, 10, "treasure");
tileMap.getTile(10, 10);
tileMap.inBounds(10, 10);
tileMap.getTiles();
```

## Examples

### Creating a Large World Game

```javascript
// Create a large world (200x200 tiles)
const gameEngine = new GameEngine(200, 200, {
    useScrollableTileMap: true,
    playStyle: "multi-set"
});

  // Create players with different viewport sizes
  const warrior = new ViewportPlayer("warrior", "Warrior", { x: 10, y: 10 }, {
    width: 20, height: 15, autoFollow: true
  });

  const mage = new ViewportPlayer("mage", "Mage", { x: 150, y: 150 }, {
    width: 15, height: 12, autoFollow: false
  });

  // Register players
  gameEngine.registerPlayerEntity(warrior);
  gameEngine.registerPlayerEntity(mage);

// Generate world content
const scrollable = gameEngine.getScrollable();
const tileMap = scrollable.getTileMap();
for (let i = 0; i < 1000; i++) {
    const x = Math.floor(Math.random() * 200);
    const y = Math.floor(Math.random() * 200);
    tileMap.setTile(x, y, "terrain");
}
```

### Fog of War Implementation

```javascript
// Check what each player can see and only send visible tiles
function getPlayerVisibleWorld(playerId) {
  const scrollable = gameEngine.getScrollable();
  const visibleTiles = scrollable.getVisibleTilesForPlayer(playerId);
  const playerWorld = {};
  
  visibleTiles.forEach(tile => {
    playerWorld[`${tile.x},${tile.y}`] = tile.value;
  });
  
  return playerWorld;
}

// Send only visible tiles to each player
gameEngine.getPlayerEntities().forEach(player => {
    const visibleWorld = getPlayerVisibleWorld(player.id);
    // Send visibleWorld to the player's client
});
```

## Performance Considerations

- **Viewport size**: Larger viewports require more processing
- **Player count**: More players mean more viewport calculations
- **Map size**: Very large maps may require optimization for tile access
- **Update frequency**: Consider batching viewport updates for better performance

## Migration from Regular TileMap

To migrate existing games to use scrollable TileMap:

1. Enable scrollable TileMap in GameEngine constructor
2. Update player creation to include viewport configuration
3. Replace direct tile map access with viewport-aware methods
4. Update client-side rendering to use viewport coordinates

```javascript
// Before (regular TileMap)
const allTiles = gameEngine.getTileMap().getTiles();

// After (scrollable TileMap)
const scrollable = gameEngine.getScrollable();
const visibleTiles = scrollable.getVisibleTilesForPlayer("player1");
```
