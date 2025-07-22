// Root exports for kubic-kode

// Game Utility
export * as gameUtility from "./game-utility/game-utility.js";
export * as inactivityManager from "./game-utility/inactivity-manager.js";

// Game Engine
export * as gameEngine from "./game-engine/game-engine.js";
export * as tileMap from "./game-engine/tile-map.js";
export * as gameEntity from "./game-engine/game-entity/game-entity.js";
export * as gameEntityPlayer from "./game-engine/game-entity/game-entity-player.js";

// Game Server
// export * as gameServer from "./game-server/game-server.js";
export * as sessionManager from "./game-server/session-manager.js";
export * as gameSession from "./game-server/game-session.js";
export * as gameRegistry from "./game-server/game-registry.js";
export * as gameEventService from "./game-server/game-event-service.js";
export { default as gameRoutes } from "./game-server/route/game-routes.js";
export { default as sessionRoutes } from "./game-server/route/session-routes.js";

