import express from "express";
import { sessionManager } from "../session-manager.js"; // Holds all active GameSession instances
import { GameEventService } from "../game-event-service.js";
import { PlayStatus } from "../../game-engine/play-status.js";

const gameRouter = express.Router();

import { serializeRecursively, checkPlayableAccess, validateSession } from "../../game-utility/game-utility.js";

// Create middleware instances with session manager
const checkPlayableAccessMiddleware = checkPlayableAccess(sessionManager);
const validateSessionMiddleware = validateSession(sessionManager);

// Shared function to handle game start logic
const handleGameStart = (gameSession, options = {}, requestingParticipantId = null) => {
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

  // Increment restart counter when starting a game with participants
  // This should happen before establishFirstPlayers so the counter reflects the correct game number
  if (sessionParticipants.length > 0) {
    gameSession.increaseRestartCounter();
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

  // Step 5: Establish first player(s) and return as current player(s)
  const sessionContext = {
    restartCount: gameSession.getRestartCounter(),
    winCount: gameSession.getWinCounter()
  };
  const firstPlayerId = gameInstance.establishFirstPlayers(sessionContext);
  const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();
  result.current_player_id = currentPlayer.getPlayerId();
  result.first_player_id = firstPlayerId;
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

  // After game start, check if the first player is a computer and handle computer turns
  // This is crucial for cases where the computer is the first player (alternating first player)
  if (currentPlayer.getPlayerType() === 'computer') {
    // Process computer turns asynchronously to avoid blocking the game start response
    // This handles the case where computer is first player or multiple computers in sequence
    setImmediate(() => {
      processComputerTurns(gameSession, null).catch(error => {
        console.error('Error processing initial computer turns after game start:', error);
      });
    });
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

  const result = handleGameStart(gameSession, {}, participantId);
  res.json(result);
});


// Use the POST method if you want to start the game with custom options (such as gridSize), otherwise use GET.
gameRouter.post("/game/start/:sessionId", validateSessionMiddleware, checkPlayableAccessMiddleware, (req, res) => {
  const { participantId, ...options } = req.body || {}; // Extract participantId and options from request body
  const gameSession = req.gameSession;
  
  // Game options will be validated and applied according to the game's configuration
  const result = handleGameStart(gameSession, options, participantId);
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

// Generic play turn endpoint for all games
gameRouter.post("/game/play-turn/:sessionId", checkPlayableAccessMiddleware, (req, res) => {
  const { sessionId } = req.params;
  const { participantId, ...moveData } = req.body;

  const gameSession = sessionManager.getSession(sessionId);
  const gameInstance = gameSession.getGameInstance();
  
  // Get the current player from the game engine
  const currentPlayer = gameInstance.getGameEngine().getCurrentPlayer();
  
  // Validate that the participant is the current player
  const participant = gameSession.getParticipantById(participantId);
  if (!participant) {
    return res.status(404).json({ error: "Participant not found." });
  }
  
  // Find the player that corresponds to this participant
  const playerMappings = gameInstance.getPlayerMappings();
  const playerId = playerMappings[participantId];
  
  if (!playerId) {
    return res.status(400).json({ error: "Participant is not a player in this game." });
  }
  
  // Validate that it's this player's turn
  if (playerId !== currentPlayer.getPlayerId()) {
    return res.status(400).json({ error: "It's not your turn." });
  }

  // Play the turn - pass turnData consistently for all games
  let playStatus;
  try {
    // All games receive: playTurn(playerId, turnData)
    // turnData contains all move information (xPos, yPos, action, etc.)
    playStatus = gameInstance.playTurn(playerId, moveData);
  } catch (error) {
    return res.status(400).json({ 
      error: "Invalid move.", 
      details: error.message 
    });
  }
  
  // Handle win condition
  if (playStatus.access('playerHasWon')) {
    gameSession.increaseWinCounter();
    let winCount = gameSession.getWinCounter();
    GameEventService.broadcastToSession(gameSession, {
      type: "winCount",
      payload: { winCount },
    });
  }
  
  // Handle tie condition
  if (playStatus.access('gameIsTied')) {
    let winCount = gameSession.getWinCounter();
    GameEventService.broadcastToSession(gameSession, {
      type: "winCount",
      payload: { winCount },
    });
  }
  
  // Send response immediately - convert PlayStatus to snake_case for HTTP response
  const responseData = playStatus instanceof PlayStatus ? playStatus.toSnakeCase() : playStatus;
  res.json(responseData);
  
  // Handle computer players asynchronously
  processComputerTurns(gameSession, playStatus);
  
  // Broadcast the turn event to all connected clients after sending the response
  try {
    GameEventService.broadcastToSession(gameSession, {
      type: "turnPlayed",
      payload: { roundStatus: responseData }
    });
    
    // If the player won, also broadcast a win event
    if (playStatus.access('playerHasWon')) {
      GameEventService.broadcastToSession(gameSession, {
        type: "playerWon",
        payload: { 
          playerId: playStatus.access('playerId'),
          winCondition: playStatus.access('winCondition') || 'unknown'
        }
      });
    }
    
    // If the game is tied, broadcast a tie event
    if (playStatus.access('gameIsTied')) {
      GameEventService.broadcastToSession(gameSession, {
        type: "gameTied",
        payload: { 
          message: "Game ended in a tie"
        }
      });
    }
  } catch (broadcastError) {
    console.error('Broadcast error (non-blocking):', broadcastError);
    // Don't throw here - the turn was played successfully, just the broadcast failed
  }
});

// Standalone function to handle sequential computer players
// This can be called from both the play-turn endpoint and handleGameStart
const processComputerTurns = async (gameSession, initialPlayStatus = null) => {
  const gameInstance = gameSession.getGameInstance();
  let lastPlayStatus = initialPlayStatus;
  
  console.log(`[processComputerTurns] Starting - Current player:`, gameInstance.getGameEngine().getCurrentPlayer()?.getPlayerId(), 'Type:', gameInstance.getGameEngine().getCurrentPlayer()?.getPlayerType());
  
  // Keep playing computer turns while:
  // 1. No one has won yet and game hasn't tied (or no initial status provided)
  // 2. Current player is a computer
  // 3. Game is still active
  while ((!lastPlayStatus || (!lastPlayStatus.access('playerHasWon') && !lastPlayStatus.access('gameIsTied'))) && 
         gameInstance.getGameEngine().isGameStarted() &&
         gameInstance.getGameEngine().getCurrentPlayer().getPlayerType() === 'computer') {
    
    try {
      // Random delay for computer moves (1-2 seconds)
      const delay = 1000 + Math.floor(Math.random() * 1001);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Get current computer player (may have changed due to turn order)
      const computerPlayer = gameInstance.getGameEngine().getCurrentPlayer();
      
      // Calculate computer move
      const computerMove = gameInstance.calculateComputerMove();
      
      // Play computer turn - consistent format for all games
      let compPlayStatus;
      compPlayStatus = gameInstance.playTurn(computerPlayer.getPlayerId(), computerMove);

      // Handle computer win
      if (compPlayStatus.access('playerHasWon')) {
        gameSession.increaseWinCounter();
        let winCount = gameSession.getWinCounter();
        GameEventService.broadcastToSession(gameSession, {
          type: "winCount",
          payload: { winCount },
        });
      }
      
      // Handle computer tie
      if (compPlayStatus.access('gameIsTied')) {
        let winCount = gameSession.getWinCounter();
        GameEventService.broadcastToSession(gameSession, {
          type: "winCount",
          payload: { winCount },
        });
      }

      // Convert PlayStatus to snake_case for broadcast
      const compResponseData = compPlayStatus instanceof PlayStatus ? compPlayStatus.toSnakeCase() : compPlayStatus;

      // Broadcast computer turn
      GameEventService.broadcastToSession(gameSession, {
        type: "turnPlayed",
        payload: { roundStatus: compResponseData },
      });
      
      // If the computer won, also broadcast a win event
      if (compPlayStatus.access('playerHasWon')) {
        GameEventService.broadcastToSession(gameSession, {
          type: "playerWon",
          payload: { 
            playerId: compPlayStatus.access('playerId'),
            winCondition: compPlayStatus.access('winCondition') || 'unknown'
          }
        });
        
        // Stop the loop if computer won
        break;
      }
      
      // If the game is tied, broadcast a tie event
      if (compPlayStatus.access('gameIsTied')) {
        GameEventService.broadcastToSession(gameSession, {
          type: "gameTied",
          payload: { 
            message: "Game ended in a tie"
          }
        });
        
        // Stop the loop if game tied
        break;
      }
      
      // Update lastRoundStatus for next iteration
      lastPlayStatus = compPlayStatus;
      
    } catch (error) {
      console.error('Error during computer turn:', error);
      break; // Stop processing computer turns on error
    }
  }
  
  return lastPlayStatus;
};

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
