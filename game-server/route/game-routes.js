import express from "express";
import { sessionManager } from "../session-manager.js"; // Holds all active GameSession instances
import { GameEventService } from "../game-event-service.js";

const gameRouter = express.Router();

import { serializeRecursively } from "../../game-utility/game-utility.js";

// Shared function to handle game start logic
const handleGameStart = (sessionId, options = {}) => {
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();
  const sessionParticipants = gameSession.getParticipants();

  // Apply gridSize option if provided and game hasn't started yet
  if (options.gridSize && !gameInstance.getGameEngine().isGameStarted()) {
    const tileMap = gameInstance.getGameEngine().getTileMap();
    tileMap.resize(options.gridSize, options.gridSize);
  }

  if (gameInstance.getGameEngine().isGameStarted()) {
    const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();
    return {
      current_player_id: currentPlayer.getPlayerId(),
      game_started: true,
      status: "Game already previously started",
    };
  }

  // Step 1: Add participants as players to your game
  const playerMappings = {}
  for (let i = 0; i < sessionParticipants.length; i++) {
    let participant = sessionParticipants[i];
    let player = gameInstance.addPlayer(participant.name, participant.type === 'computer');
    playerMappings[participant.id] = player;
  }

  // Step 2: Start the game session (if not already started)
  gameSession.markStarted();

  // Step 3: Start the game instance
  gameInstance.startGame();

  // Step 4: Return the current player
  const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();
  const result = {
    current_player_id: currentPlayer.getPlayerId(),
    game_started: true,
    status: "New game created",
  };

  // Broadcast the event after sending the response to avoid blocking the request
  try {
    GameEventService.broadcastToSession(gameSession, {
      type: "gameStarted",
      payload: { playerMappings: serializeRecursively(playerMappings) },
    });
  } catch (broadcastError) {
    console.error('Broadcast error (non-blocking):', broadcastError);
    // Don't throw here - the game was started successfully, just the broadcast failed
  }

  return result;
};

// Use the GET method if you want to start the game with default options, otherwise use POST.
gameRouter.get("/game/start/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const result = handleGameStart(sessionId);
  res.json(result);
});


// Use the POST method if you want to start the game with custom options (such as gridSize), otherwise use GET.
gameRouter.post("/game/start/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const options = req.body || {}; // Extract options from request body (e.g., { gridSize: 5 })
  // Options like gridSize will be applied to the tile map if the game hasn't started yet
  const result = handleGameStart(sessionId, options);
  res.json(result);
});

gameRouter.get("/game/stop/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  if (!gameInstance.getGameEngine().isGameStarted()) {
    return res.status(200).json({
      game_stopped: true,
      message: "Game was already stopped",
    });
  }

  gameInstance.getGameEngine().stopGame();

  res.json({
    game_stopped: true,
  });

  // Broadcast the event after sending the response to avoid blocking the request
  try {
    GameEventService.broadcastToSession(gameSession, {
      type: "gameStopped",
    });
  } catch (broadcastError) {
    console.error('Broadcast error (non-blocking):', broadcastError);
    // Don't throw here - the game was stopped successfully, just the broadcast failed
  }
});

// Used to get current turn (=> current player id)
gameRouter.get("/game/get-current-player/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  res.json({
    current_player_id: gameInstance
      .getGameEngine()
      .getCurrentPlayer()
      .getPlayerId(),
  });
});

gameRouter.get("/game/is-active/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  res.json({
    is_active: gameInstance.getGameEngine().isGameStarted(),
  });
});

gameRouter.get("/game/get-tilemap/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  const tileMap = gameInstance.getGameEngine().getTileMap();
  console.log(`[get-tilemap] Raw tileMap:`, tileMap);
  console.log(`[get-tilemap] Raw tileMap.tiles:`, tileMap.tiles);
  
  const serializedTileMap = serializeRecursively(tileMap);
  console.log(`[get-tilemap] Serialized tileMap:`, serializedTileMap);
  
  res.json(serializedTileMap);
});

export default gameRouter;
