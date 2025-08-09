// Root exports for kubic-kode (CommonJS)

// Game Utility
const gameUtility = require("./game-utility/game-utility");
const inactivityManager = require("./game-utility/inactivity-manager");

// Game Engine
const gameEngine = require("./game-engine/game-engine");
const tileMap = require("./game-engine/tile-map");
const scrollableTileMap = require("./game-engine/scrollable-tile-map");
const scrollableTileMapManager = require("./game-engine/scrollable-tile-map-manager");
const viewport = require("./game-engine/viewport");
const gameEntity = require("./game-engine/game-entity/game-entity");
const gameEntityPlayer = require("./game-engine/game-entity/game-entity-player");
const viewportPlayer = require("./game-engine/game-entity/viewport-player");
const actionPointComponent = require("./game-engine/game-entity/compose/action-point-component");
const healthPointComponent = require("./game-engine/game-entity/compose/health-point-component");
const gameContract = require("./game-engine/game-contract");
const gameInterface = require("./game-engine/game-interface");
const gameOptions = require("./game-engine/game-options");
const playStatus = require("./game-engine/play-status");
const interfaceComplianceChecker = require("./game-engine/interface-compliance-checker");
const kubicKodeGame = require("./game-engine/kubic-kode-game");

// Game Server
const { sessionManager } = require("./game-server/session-manager");
const gameSession = require("./game-server/game-session");
const { gameRegistry } = require("./game-server/game-registry");
const gameEventService = require("./game-server/game-event-service");
const gameHistory = require("./game-server/game-history");
const gameHistoryManager = require("./game-server/game-history-manager");
const gameRoutes = require("./game-server/route/game-routes");
const sessionRoutes = require("./game-server/route/session-routes");

module.exports = {
  gameUtility,
  inactivityManager,
  gameEngine,
  tileMap,
  scrollableTileMap,
  scrollableTileMapManager,
  viewport,
  gameEntity,
  gameEntityPlayer,
  viewportPlayer,
  actionPointComponent,
  healthPointComponent,
  gameContract,
  gameInterface,
  gameOptions,
  playStatus,
  interfaceComplianceChecker,
  kubicKodeGame,
  sessionManager,
  gameSession,
  gameRegistry,
  gameEventService,
  gameHistory,
  gameHistoryManager,
  gameRoutes,
  sessionRoutes
}; 