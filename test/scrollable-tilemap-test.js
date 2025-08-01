import { GameEngine } from '../game-engine/game-engine.js';
import { ViewportPlayer } from '../game-engine/game-entity/viewport-player.js';
import { ScrollableTileMap } from '../game-engine/scrollable-tile-map.js';
import { Viewport } from '../game-engine/viewport.js';

export function runScrollableTileMapTests() {
  console.log('Running Scrollable TileMap Tests...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      testsPassed++;
    } else {
      console.log(`❌ FAIL: ${message}`);
      testsFailed++;
    }
  }

  // Test 1: Basic ScrollableTileMap creation
  console.log('Test 1: Basic ScrollableTileMap creation');
  const scrollableMap = new ScrollableTileMap(20, 20);
  assert(scrollableMap instanceof ScrollableTileMap, 'ScrollableTileMap should be created');
  assert(scrollableMap.width === 20 && scrollableMap.height === 20, 'Dimensions should be correct');
  assert(scrollableMap.viewports instanceof Map, 'Viewports should be a Map');

  // Test 2: Viewport creation and basic operations
  console.log('\nTest 2: Viewport creation and basic operations');
  const viewport = new Viewport(5, 5, 10, 10);
  assert(viewport.x === 5 && viewport.y === 5, 'Viewport position should be correct');
  assert(viewport.width === 10 && viewport.height === 10, 'Viewport size should be correct');
  assert(viewport.contains(7, 7), 'Viewport should contain internal point');
  assert(!viewport.contains(20, 20), 'Viewport should not contain external point');

  // Test 3: Registering viewports with ScrollableTileMap
  console.log('\nTest 3: Registering viewports with ScrollableTileMap');
  scrollableMap.registerViewport('player1', viewport);
  const retrievedViewport = scrollableMap.getViewport('player1');
  assert(retrievedViewport === viewport, 'Should retrieve the same viewport');
  assert(scrollableMap.getViewport('nonexistent') === null, 'Should return null for non-existent player');

  // Test 4: Getting visible tiles
  console.log('\nTest 4: Getting visible tiles');
  scrollableMap.setTile(7, 7, 'treasure');
  scrollableMap.setTile(15, 15, 'enemy');
  const visibleTiles = scrollableMap.getVisibleTiles('player1');
  assert(visibleTiles.length === 100, 'Should see 100 tiles (10x10 viewport)');
  const treasureTile = visibleTiles.find(tile => tile.value === 'treasure');
  const enemyTile = visibleTiles.find(tile => tile.value === 'enemy');
  assert(treasureTile !== undefined, 'Should see treasure within viewport');
  assert(enemyTile === undefined, 'Should not see enemy outside viewport');

  // Test 5: Scrolling viewport
  console.log('\nTest 5: Scrolling viewport');
  const scrollResult = scrollableMap.scrollViewport('player1', 'right', 2);
  assert(scrollResult === true, 'Scroll should succeed');
  assert(scrollableMap.getViewport('player1').x === 7, 'Viewport should move right by 2');
  
  const enemyVisibleAfterScroll = scrollableMap.getVisibleTiles('player1')
    .find(tile => tile.value === 'enemy');
  assert(enemyVisibleAfterScroll !== undefined, 'Should see enemy after scrolling');

  // Test 6: Centering viewport
  console.log('\nTest 6: Centering viewport');
  const centerResult = scrollableMap.centerViewportOn('player1', 10, 10);
  assert(centerResult === true, 'Centering should succeed');
  const centeredViewport = scrollableMap.getViewport('player1');
  assert(centeredViewport.x === 5 && centeredViewport.y === 5, 'Should center on position');

  // Test 7: GameEngine integration
  console.log('\nTest 7: GameEngine integration');
  const gameEngine = new GameEngine(30, 30, { useScrollableTileMap: true });
  const scrollable = gameEngine.getScrollable();
  assert(scrollable !== null, 'GameEngine should have scrollable tile map enabled');
  
  const player = new ViewportPlayer('testPlayer', 'TestPlayer', { x: 10, y: 10 }, {
    width: 8,
    height: 6
  });
  
  gameEngine.registerPlayerEntity(player);
  gameEngine.startGame();
  
  const playerViewport = scrollable.getPlayerViewport('testPlayer');
  assert(playerViewport !== null, 'Should have registered viewport for player');
  assert(playerViewport.width === 8 && playerViewport.height === 6, 'Viewport should have correct size');

  // Test 8: Player movement with auto-follow
  console.log('\nTest 8: Player movement with auto-follow');
  const initialViewport = player.getViewport().clone();
  player.moveTo(15, 15);
  const newViewport = player.getViewport();
  assert(newViewport.x !== initialViewport.x || newViewport.y !== initialViewport.y, 
         'Viewport should change after player movement');

  // Test 9: Visibility checks
  console.log('\nTest 9: Visibility checks');
  const tileMap = scrollable.getTileMap();
  tileMap.setTile(12, 12, 'test');
  const isVisible = scrollable.isPositionVisibleToPlayer('testPlayer', 12, 12);
  assert(isVisible, 'Should be able to see tile within viewport');

  // Test 10: Viewport bounds validation
  console.log('\nTest 10: Viewport bounds validation');
  const invalidViewport = new Viewport(-5, -5, 10, 10);
  assert(!invalidViewport.isValidForMap(20, 20), 'Invalid viewport should be detected');
  
  const validViewport = new Viewport(5, 5, 10, 10);
  assert(validViewport.isValidForMap(20, 20), 'Valid viewport should be accepted');

  // Test 11: Coordinate conversion
  console.log('\nTest 11: Coordinate conversion');
  const testViewport = new Viewport(10, 10, 8, 6);
  const worldCoords = testViewport.viewportToWorld(2, 3);
  const viewportCoords = testViewport.worldToViewport(12, 13);
  
  assert(worldCoords.x === 12 && worldCoords.y === 13, 'World coordinates should be correct');
  assert(viewportCoords.x === 2 && viewportCoords.y === 3, 'Viewport coordinates should be correct');

  // Test 12: Viewport intersection
  console.log('\nTest 12: Viewport intersection');
  const viewport1 = new Viewport(0, 0, 10, 10);
  const viewport2 = new Viewport(5, 5, 10, 10);
  const viewport3 = new Viewport(20, 20, 5, 5);
  
  assert(viewport1.intersects(viewport2), 'Overlapping viewports should intersect');
  assert(!viewport1.intersects(viewport3), 'Non-overlapping viewports should not intersect');
  
  const intersection = viewport1.getIntersection(viewport2);
  assert(intersection !== null, 'Should have intersection between overlapping viewports');
  assert(intersection.x === 5 && intersection.y === 5, 'Intersection should be correct');

  console.log('\n=== Test Results ===');
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log(`Total tests: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed!');
  }

  return testsFailed === 0;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runScrollableTileMapTests();
} 