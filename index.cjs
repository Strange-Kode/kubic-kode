// Root exports for kubic-kode (CommonJS)

// Game Utility
const gameUtility = require("./game-utility/game-utility");
const inactivityManager = require("./game-utility/inactivity-manager");

// Game Engine
const gameEngine = require("./game-engine/game-engine");
const tileMap = require("./game-engine/tile-map");
const gameEntity = require("./game-engine/game-entity/game-entity");
const gameEntityPlayer = require("./game-engine/game-entity/game-entity-player");

// Game Server
const gameServer = require("./game-server/game-server");
const sessionManager = require("./game-server/session-manager");
const gameSession = require("./game-server/game-session");
const gameRegistry = require("./game-server/game-registry");
const gameEventService = require("./game-server/game-event-service");
const gameRoutes = require("./game-server/route/game-routes");
const sessionRoutes = require("./game-server/route/session-routes");

module.exports = {
  gameUtility,
  inactivityManager,
  gameEngine,
  tileMap,
  gameEntity,
  gameEntityPlayer,
  gameServer,
  sessionManager,
  gameSession,
  gameRegistry,
  gameEventService,
  gameRoutes,
  sessionRoutes
}; 