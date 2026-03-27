/**
 * Game routes
 * 
 * This file contains the routes for the game server.
 * 
 * All /game/ routes have to be POST requests due to the game token being passed in the body.
 * 
 * The middleware is used to:
 * - validate the game token.
 * - identify the participant and the game session.
 * - validate that the participant is allowed to perform the action.
 */
import express from "express";
import { sessionManager } from "../session-manager.js";
import { kubicLog } from "../../kubic-log.js";

const gameRouter = express.Router();

import { checkPlayableAccess, validateSession, validatePlayableParticipant } from "../../game-utility/game-utility.js";
import { validateGameTokenWithParticipant, validateGameTokenWithParticipantReadOnly } from "../game-token-middleware.js";

// Import kubic modules
import { modules as kubicModules } from "../../game-module/module-system/index.js";

// Create middleware instances with session manager
const checkPlayableAccessMiddleware = checkPlayableAccess(sessionManager);
const validateSessionMiddleware = validateSession(sessionManager);

// Use the POST method if you want to start the game with custom options (such as gridSize), otherwise use GET.
gameRouter.post("/game/:sessionId/start", validateGameTokenWithParticipant(sessionManager), (req, res) => {
  const { participantId, ...options } = req.body || {};
  const gameSession = req.gameSession;
  
  try {
    // Game options will be validated and applied according to the game's configuration
    const result = kubicModules.game.handleGameStart(
      gameSession, 
      options, 
      participantId,
      kubicModules.player.formatPlayerIds,
      (session, status) => kubicModules.computer.processComputerTurns(
        session, 
        status, 
        kubicModules.tilemap.processTileMapData
      )
    );
    
    // Check if the result indicates an error
    if (result && result.error) {
      return res.status(400).json(result);
    }
    
    res.json(result);
  } catch (err) {
    kubicLog.error("game-routes.js::Start game error:", err);
    res.status(500).json({ 
      error: "Failed to start game",
      message: err.message,
      details: err.stack 
    });
  }
});

gameRouter.post("/game/:sessionId/stop", validateGameTokenWithParticipant(sessionManager), validatePlayableParticipant(sessionManager), (req, res) => {
  const gameSession = req.gameSession;
  const result = kubicModules.game.handleGameStop(gameSession);
  res.json(result);
});

// Used to get current turn (=> current player id)
gameRouter.post("/game/:sessionId/get-current-player", validateGameTokenWithParticipantReadOnly(sessionManager), (req, res) => {
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();

  const currentPlayerIds = kubicModules.player.getCurrentPlayerIds(gameInstance);
  
  // Format player IDs based on returnSinglePlayerId option
  const formatResult = kubicModules.player.formatPlayerIds(gameInstance, currentPlayerIds);
  if (formatResult.error) {
    return res.status(400).json(formatResult);
  }
  
  if (formatResult.returnSinglePlayerId) {
    res.json({
      current_player_id: formatResult.playerId,
    });
  } else {
    res.json({
      current_player_ids: formatResult.playerIds,
    });
  }
});

gameRouter.post("/game/:sessionId/is-active", validateGameTokenWithParticipantReadOnly(sessionManager), (req, res) => {
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();

  res.json({
    is_active: kubicModules.game.isGameActive(gameInstance),
  });
});

gameRouter.post("/game/:sessionId/get-tilemap", validateGameTokenWithParticipantReadOnly(sessionManager), (req, res) => {
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();

  const tileMap = gameInstance.getGameEngine().getTileMap();
  const response = kubicModules.tilemap.processTileMapData(tileMap);
  
  res.json(response);
});

// Get player mappings (participantId -> playerId)
gameRouter.post("/game/:sessionId/get-player-mappings", validateGameTokenWithParticipantReadOnly(sessionManager), (req, res) => {
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();

  const playerMappings = gameInstance.getPlayerMappings();
  
  res.json({
    player_mappings: playerMappings
  });
});

// Generic play turn endpoint for all games
gameRouter.post("/game/:sessionId/play-turn", validateGameTokenWithParticipant(sessionManager), validatePlayableParticipant(sessionManager), (req, res) => {
  const { participantId, ...moveData } = req.body;
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();
  
  // Validate that the participant is the current player
  const validation = kubicModules.turn.validatePlayerTurn(gameInstance, participantId);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }
  
  // Execute the turn
  const turnResult = kubicModules.turn.executeTurn(gameInstance, validation.playerId, moveData);
  if (!turnResult.success) {
    return res.status(400).json({ 
      error: turnResult.error, 
      details: turnResult.details 
    });
  }
  
  const playStatus = turnResult.playStatus;
  
  // Handle win and tie conditions
  kubicModules.turn.handleWinCondition(gameSession, playStatus, moveData);
  kubicModules.turn.handleTieCondition(gameSession, playStatus);
  
  // Send response immediately
  const responseData = kubicModules.turn.toResponseData(playStatus);
  res.json(responseData);
  
  // Handle computer players asynchronously
  kubicModules.computer.processComputerTurns(
    gameSession, 
    playStatus, 
    kubicModules.tilemap.processTileMapData
  );
  
  // Broadcast the turn event to all connected clients
  // Game implementations can set includeFullTilemap: false in customData to send delta-only updates
  const includeFullTilemap = playStatus.access("customData")?.includeFullTilemap !== false;
  const serializedTileMap = includeFullTilemap
    ? kubicModules.tilemap.processTileMapData(gameInstance.getGameEngine().getTileMap())
    : null;
  kubicModules.turn.broadcastTurnEvents(gameSession, playStatus, serializedTileMap);
});

// Get game options information
gameRouter.post("/game/:sessionId/options", validateGameTokenWithParticipantReadOnly(sessionManager), (req, res) => {
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();

  const result = kubicModules.game.getGameOptions(gameInstance);
  res.json(result);
});

export default gameRouter;
