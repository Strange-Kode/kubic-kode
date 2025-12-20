// Root exports for kubic-kode

// Game Utility
export * as gameUtility from "./game-utility/game-utility.js";
export * as inactivityManager from "./game-utility/inactivity-manager.js";

// Game Engine
export * as gameEngine from "./game-engine/game-engine.js";
export * as tileMap from "./game-engine/tile-map.js";
export * as scrollableTileMap from "./game-engine/scrollable-tile-map.js";
export * as scrollableTileMapManager from "./game-engine/scrollable-tile-map-manager.js";
export * as viewport from "./game-engine/viewport.js";
export * as gameEntity from "./game-engine/game-entity/game-entity.js";
export * as gameEntityPlayer from "./game-engine/game-entity/game-entity-player.js";
export * as viewportPlayer from "./game-engine/game-entity/viewport-player.js";
export * as actionPointComponent from "./game-engine/game-entity/compose/action-point-component.js";
export * as healthPointComponent from "./game-engine/game-entity/compose/health-point-component.js";
export * as gameContract from "./game-engine/game-contract.js";
export * as gameInterface from "./game-engine/game-interface.js";
export * as gameOptions from "./game-engine/game-options.js";
export * as playStatus from "./game-engine/play-status.js";
export * as interfaceComplianceChecker from "./game-engine/interface-compliance-checker.js";
export * as kubicKodeGame from "./game-engine/kubic-kode-game.js";
export * as gameStateMachine from "./game-engine/game-state-machine.js";

// Game Server
export { sessionManager } from "./game-server/session-manager.js";
export * as gameSession from "./game-server/session/game-session.js";
export { gameRegistry } from "./game-server/game-registry.js";
export * as gameEventService from "./game-server/game-event-service.js";
export * as gameHistory from "./game-server/game-history.js";
export * as gameHistoryManager from "./game-server/game-history-manager.js";
export { default as gameRoutes } from "./game-server/route/game-routes.js";
export { default as sessionRoutes } from "./game-server/route/session-routes.js";

// Game Module
export { initModuleSystem, registerModule, unregisterModule, getKubicKodeModulesPath } from "./game-module/module-system/index.js";
export { hooks as moduleHooks, registry as moduleRegistry, modules as gameModules } from "./game-module/module-system/index.js";

// Logging
export { kubicLog, debugConfig } from "./kubic-log.js";