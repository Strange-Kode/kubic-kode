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

  // Apply game options if provided and game hasn't started yet
  if (Object.keys(options).length > 0 && !gameInstance.getGameEngine().isGameStarted()) {
    const gameOptions = gameInstance.getGameOptions();
    if (gameOptions) {
      const validation = gameOptions.validateAndApply(options);
      
      if (!validation.valid) {
        return {
          error: true,
          message: "Invalid game options",
          details: validation.errors,
          ignored: validation.ignored
        };
      }

      // Apply valid options
      for (const [key, value] of Object.entries(validation.applied)) {
        if (key === 'gridSize') {
          const tileMap = gameInstance.getGameEngine().getTileMap();
          tileMap.resize(value, value);
        }
        else {
          throw new Error(`Invalid or not implemented game option: ${key}`);
        }
      }
    }
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
  // Game options will be validated and applied according to the game's configuration
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

// Get game options information
gameRouter.get("/game/options/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();

  const gameOptions = gameInstance.getGameOptions();
  if (!gameOptions) {
    return res.json({
      available: false,
      message: "This game does not support options"
    });
  }

  res.json({
    available: true,
    configurable: gameOptions.getConfigurableOptions(),
    frozen: gameOptions.getFrozenOptions(),
    metadata: gameOptions.getOptionsMetadata()
  });
});

export default gameRouter;
