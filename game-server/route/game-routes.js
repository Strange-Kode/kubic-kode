import express from "express";
import { sessionManager } from "../session-manager.js"; // Holds all active GameSession instances
import { GameEventService } from "../game-event-service.js";

const gameRouter = express.Router();

import { serializeRecursively, checkPlayableAccess, validateSession } from "../../game-utility/game-utility.js";

// Create middleware instances with session manager
const checkPlayableAccessMiddleware = checkPlayableAccess(sessionManager);
const validateSessionMiddleware = validateSession(sessionManager);

// Shared function to handle game start logic
const handleGameStart = (gameSession, options = {}) => {
  const gameInstance = gameSession.getGameInstance();
  const sessionParticipants = gameSession.getParticipants();

  const result = {};

  // Check if game is already started
  if (gameInstance.getGameEngine().isGameStarted()) {
    const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();
    return {
      current_player_id: currentPlayer.getPlayerId(),
      game_started: true,
      status: "Game already previously started",
    };
  }

  // Step 1: Add playable participants as players to your game
  const playerMappings = {}
  for (let i = 0; i < sessionParticipants.length; i++) {
    let participant = sessionParticipants[i];
    // Only convert playable participants to players
    if (gameSession.isParticipantPlayable(participant)) {
      let player = gameInstance.addPlayer(participant.name, participant.type === 'computer');
      playerMappings[participant.id] = player.getPlayerId();
    }
  }

  // Store the player mappings in the game instance for later use
  if (typeof gameInstance.setPlayerMappings === 'function') {
    gameInstance.setPlayerMappings(playerMappings);
  }

  // Step 2: Start the game session (if not already started)
  gameSession.markStarted();

  // Step 3: Start the game instance
  gameInstance.startGame();

  // Step 4: Apply game options AFTER the game has started
  if (Object.keys(options).length > 0) {
    const gameOptions = gameInstance.getGameOptions();
    if (gameOptions) {
      result.applied_game_options = [];
      const validation = gameOptions.validateAndApply(options);
      
      if (!validation.valid) {
        return {
          error: true,
          message: "Invalid game options",
          details: validation.errors,
          ignored: validation.ignored,
          locked: validation.locked,
          game_state: gameOptions.getGameState()
        };
      }

      // Apply valid options
      for (const [key, value] of Object.entries(validation.applied)) {
        if (key === 'gridSize') {
          // Don't resize tile map here - let KubicKodeGame handle it in applyGameOptions
          // The tile map will be resized after the game starts
        }
        // Allow all validated options to be applied
        // The applyGameOptions method will handle the implementation
        result.applied_game_options.push({
          key: key,
          value: value
        });
      }

      // Call applyGameOptions on the game instance if it exists
      // This allows the game to update its internal state (like gridSize property)
      if (typeof gameInstance.applyGameOptions === 'function') {
        gameInstance.applyGameOptions(validation.applied);
      }
    }
  }

  // Step 5: Return the current player
  const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();
  result.current_player_id = currentPlayer.getPlayerId();
  result.game_started = true;
  result.status = "New game created";

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
gameRouter.get("/game/start/:sessionId", validateSessionMiddleware, (req, res) => {
  const { participantId } = req.query;
  const gameSession = req.gameSession;

  if (!participantId) {
    return res.status(400).json({ error: "participantId is required" });
  }

  // Check if participant is playable
  const participant = gameSession.getParticipantById(participantId);
  if (!participant) {
    return res.status(404).json({ error: "Participant not found." });
  }

  if (!gameSession.isParticipantPlayable(participant)) {
    return res.status(403).json({ error: "This participant cannot start games." });
  }

  const result = handleGameStart(gameSession);
  res.json(result);
});


// Use the POST method if you want to start the game with custom options (such as gridSize), otherwise use GET.
gameRouter.post("/game/start/:sessionId", validateSessionMiddleware, checkPlayableAccessMiddleware, (req, res) => {
  const { participantId, ...options } = req.body || {}; // Extract participantId and options from request body
  const gameSession = req.gameSession;
  
  // Game options will be validated and applied according to the game's configuration
  const result = handleGameStart(gameSession, options);
  res.json(result);
});

gameRouter.get("/game/stop/:sessionId", validateSessionMiddleware, (req, res) => {
  const { participantId } = req.query;
  const gameSession = req.gameSession;

  if (!participantId) {
    return res.status(400).json({ error: "participantId is required" });
  }

  // Check if participant is playable
  const participant = gameSession.getParticipantById(participantId);
  if (!participant) {
    return res.status(404).json({ error: "Participant not found." });
  }

  if (!gameSession.isParticipantPlayable(participant)) {
    return res.status(403).json({ error: "This participant cannot stop games." });
  }

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
gameRouter.get("/game/get-current-player/:sessionId", validateSessionMiddleware, (req, res) => {
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();

  res.json({
    current_player_id: gameInstance
      .getGameEngine()
      .getCurrentPlayer()
      .getPlayerId(),
  });
});

gameRouter.get("/game/is-active/:sessionId", validateSessionMiddleware, (req, res) => {
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();

  res.json({
    is_active: gameInstance.getGameEngine().isGameStarted(),
  });
});

gameRouter.get("/game/get-tilemap/:sessionId", validateSessionMiddleware, (req, res) => {
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();

  const tileMap = gameInstance.getGameEngine().getTileMap();
  console.log(`[get-tilemap] Raw tileMap:`, tileMap);
  console.log(`[get-tilemap] Raw tileMap.tiles:`, tileMap.tiles);
  
  const serializedTileMap = serializeRecursively(tileMap);
  console.log(`[get-tilemap] Serialized tileMap:`, serializedTileMap);
  
  res.json(serializedTileMap);
});

// Get game options information
gameRouter.get("/game/options/:sessionId", validateSessionMiddleware, (req, res) => {
  const gameSession = req.gameSession;
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
    // Current values of all options
    options: gameOptions.getAllOptions(),
    // Legacy support for backwards compatibility
    configurable: gameOptions.getConfigurableOptions(),
    frozen: gameOptions.getFrozenOptions(),
    // Enhanced metadata with lifecycle information
    metadata: gameOptions.getOptionsMetadata(),
    // New lifecycle-based groupings
    lifecycle: {
      frozen: gameOptions.getOptionsByLifecycle('frozen'),
      'pre-start': gameOptions.getOptionsByLifecycle('pre-start'),
      runtime: gameOptions.getOptionsByLifecycle('runtime'),
      'between-rounds': gameOptions.getOptionsByLifecycle('between-rounds')
    },
    // Current modifiable options based on game state
    modifiable: gameOptions.getModifiableOptions(),
    // Game state context
    game_state: gameOptions.getGameState(),
    // Debug information
    debug: gameOptions.getDebugInfo()
  });
});

export default gameRouter;
