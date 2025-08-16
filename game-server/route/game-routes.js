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
import { sessionManager } from "../session-manager.js"; // Holds all active GameSession instances
import { GameEventService } from "../game-event-service.js";
import { PlayStatus } from "../../game-engine/play-status.js";
import { kubicLog } from "../../kubic-log.js";

const gameRouter = express.Router();

import { serializeRecursively, checkPlayableAccess, validateSession, validatePlayableParticipant } from "../../game-utility/game-utility.js";
import { validateGameTokenWithParticipant } from "../game-token-middleware.js";

// Create middleware instances with session manager
const checkPlayableAccessMiddleware = checkPlayableAccess(sessionManager);
const validateSessionMiddleware = validateSession(sessionManager);

// Function to process tilemap data and generate debug information
const processTileMapData = (tileMap) => {
  const MAX_SIZE = 5;
  const isLargeTileMap = tileMap.getWidth() > MAX_SIZE || tileMap.getHeight() > MAX_SIZE;
  
  // Always return the full tilemap to the client
  const responseTileMap = serializeRecursively(tileMap);
  
  let debugInfo = {
    total_tiles: tileMap.getTotalTiles(),
    occupied_tiles: tileMap.getOccupiedCount(),
    free_tiles: tileMap.getTotalTiles() - tileMap.getOccupiedCount(),
    dimensions: { width: tileMap.getWidth(), height: tileMap.getHeight() },
    is_large_tilemap: isLargeTileMap
  };
  
  if (isLargeTileMap) {
    // For large tilemaps, log only a subsection (center area of the tilemap)
    const startX = Math.max(0, Math.floor((tileMap.getWidth() - MAX_SIZE) / 2));
    const startY = Math.max(0, Math.floor((tileMap.getHeight() - MAX_SIZE) / 2));
    const endX = Math.min(tileMap.getWidth(), startX + MAX_SIZE);
    const endY = Math.min(tileMap.getHeight(), startY + MAX_SIZE);

    const subSectionTiles = tileMap.getArea(startX, startY, endX, endY);
    
    const loggedTileMap = {
      width: endX - startX,
      height: endY - startY,
      tiles: subSectionTiles,
      is_subsection: true,
      subsection_bounds: {
        start_x: startX,
        start_y: startY,
        end_x: endX,
        end_y: endY
      }
    };
    
    debugInfo.subsection_info = {
      subsection_bounds: loggedTileMap.subsection_bounds,
      subsection_dimensions: { width: loggedTileMap.width, height: loggedTileMap.height }
    };
    
    kubicLog.debug(`game-routes.js::[processTileMapData] Large tilemap detected (${tileMap.getWidth()}x${tileMap.getHeight()}). Logging subsection: ${startX},${startY} to ${endX},${endY}`);
    kubicLog.debug(`game-routes.js::[processTileMapData] Logged subsection:`, loggedTileMap.tiles);
  } else {
    // For small tilemaps, log the full tilemap
    kubicLog.debug(`game-routes.js::[processTileMapData] Small tilemap (${tileMap.getWidth()}x${tileMap.getHeight()}). Logging full tilemap.`);
    kubicLog.debug(`game-routes.js::[processTileMapData] Full tilemap:`, tileMap);
  }
  
  // Log debug information
  kubicLog.debug(`game-routes.js::[processTileMapData] Debug info:`, debugInfo);
  
  return responseTileMap;
};

// Helper function to format player IDs based on returnSinglePlayerId option
const formatPlayerIds = (gameInstance, currentPlayerIds) => {
  const returnSinglePlayerId = gameInstance.getGameOptions()?.getCurrentSystemValue("returnSinglePlayerId") || false;
  
  if (returnSinglePlayerId) {
    // Validate requirements for returnSinglePlayerId
    const playStyle = gameInstance.getGameEngine().getPlayStyle();
    if (playStyle !== "single-set") {
      return {
        error: true,
        message: "returnSinglePlayerId option requires single-set play style",
        details: `Current play style: ${playStyle}, required: single-set`
      };
    }
    
    if (currentPlayerIds.length !== 1) {
      return {
        error: true,
        message: "returnSinglePlayerId option requires exactly one current player",
        details: `Current players: ${currentPlayerIds.length}, required: 1`
      };
    }
    
    return {
      success: true,
      returnSinglePlayerId: true,
      playerId: currentPlayerIds[0]
    };
  }
  
  return {
    success: true,
    returnSinglePlayerId: false,
    playerIds: currentPlayerIds
  };
};

// Shared function to handle game start logic
const handleGameStart = (gameSession, options = {}, requestingParticipantId = null) => {
  const gameInstance = gameSession.getGameInstance();
  const sessionParticipants = gameSession.getParticipants();

  const result = {};

  // Check if game is already started
  if (gameInstance.getGameEngine().isGameStarted()) {
    const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
    // Always return an array of player IDs to support all play styles
    const currentPlayerIds = Array.isArray(currentPlayers) 
      ? currentPlayers.map(p => p.getPlayerId()) 
      : [currentPlayers?.getPlayerId()].filter(Boolean);
    
    // Format player IDs based on returnSinglePlayerId option
    const formatResult = formatPlayerIds(gameInstance, currentPlayerIds);
    if (formatResult.error) {
      return formatResult;
    }
            
    const result = {
      game_started: true,
      status: "Game already previously started",
    };
            
    if (formatResult.returnSinglePlayerId) {
      result.current_player_id = formatResult.playerId;
    } else {
      result.current_player_ids = formatResult.playerIds;
    }
    
    return result;
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
      let player = gameInstance.addPlayer(participant.name, participant.type === "computer");
      playerMappings[participant.id] = player.getPlayerId();
    }
  }

  // Store the player mappings in the game instance for later use
  if (typeof gameInstance.setPlayerMappings === "function") {
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
        if (key === "gridSize") {
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
      if (typeof gameInstance.applyGameOptions === "function") {
        gameInstance.applyGameOptions(validation.applied);
      }
    }
  }

  // Step 5: Establish first player(s) and return as current player(s)
  const sessionContext = {
    restartCount: gameSession.getRestartCounter(),
    winCount: gameSession.getWinCounter()
  };
  const firstPlayerIds = gameInstance.establishFirstPlayers(sessionContext);
  const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
  // Always return an array of player IDs to support all play styles
  const currentPlayerIds = Array.isArray(currentPlayers) 
    ? currentPlayers.map(p => p.getPlayerId()) 
    : [currentPlayers?.getPlayerId()].filter(Boolean);
  
  // Format player IDs based on returnSinglePlayerId option
  const formatResult = formatPlayerIds(gameInstance, currentPlayerIds);
  if (formatResult.error) {
    return formatResult;
  }
  
  if (formatResult.returnSinglePlayerId) {
    result.current_player_id = formatResult.playerId;
    result.first_player_id = firstPlayerIds;
  } else {
    result.current_player_ids = formatResult.playerIds;
    // Always return an array of first player IDs to support all play styles
    result.first_player_ids = firstPlayerIds ? [firstPlayerIds] : [];
  }
  result.game_started = true;
  result.status = "New game created";

  // Broadcast the event after sending the response to avoid blocking the request
  try {
    GameEventService.broadcastToSession(gameSession, {
      type: "gameStarted",
      payload: { playerMappings: serializeRecursively(playerMappings) },
    });
      } catch (broadcastError) {
    kubicLog.error("game-routes.js::Broadcast error (non-blocking):", broadcastError);
      // don't throw here - the game was started successfully, just the broadcast failed
    }

  // After game start, check if any current players are computers and handle computer turns
  // This is crucial for cases where computers are first players (alternating first player)
  const playersArray = Array.isArray(currentPlayers) ? currentPlayers : [currentPlayers];
  const computerPlayers = playersArray.filter(player => player?.getPlayerType() === "computer");
  
  if (computerPlayers.length > 0) {
    // Process computer turns asynchronously to avoid blocking the game start response
    // This handles the case where computers are first players or multiple computers in sequence
    setImmediate(() => {
      processComputerTurns(gameSession, null).catch(error => {
        kubicLog.error("game-routes.js::Error processing initial computer turns after game start:", error);
      });
    });
  }

  return result;
};



// Use the POST method if you want to start the game with custom options (such as gridSize), otherwise use GET.
gameRouter.post("/game/:sessionId/start", validateGameTokenWithParticipant(sessionManager), (req, res) => {
  const { participantId, ...options } = req.body || {}; // Extract participantId and options from request body
  const gameSession = req.gameSession;
  
  // Game options will be validated and applied according to the game's configuration
  const result = handleGameStart(gameSession, options, participantId);
  res.json(result);
});

gameRouter.post("/game/:sessionId/stop", validateGameTokenWithParticipant(sessionManager), validatePlayableParticipant(sessionManager), (req, res) => {
  const { participantId } = req.query;
  const gameSession = req.gameSession;
  const participant = req.participant;

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
    kubicLog.error("game-routes.js::Broadcast error (non-blocking):", broadcastError);
    // don't throw here - the game was stopped successfully, just the broadcast failed
  }
});

// Used to get current turn (=> current player id)
gameRouter.post("/game/:sessionId/get-current-player", validateGameTokenWithParticipant(sessionManager), (req, res) => {
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();

  const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
  // Always return an array of player IDs to support all play styles
  const currentPlayerIds = Array.isArray(currentPlayers) 
    ? currentPlayers.map(p => p.getPlayerId()) 
    : [currentPlayers?.getPlayerId()].filter(Boolean);
  
  // Format player IDs based on returnSinglePlayerId option
  const formatResult = formatPlayerIds(gameInstance, currentPlayerIds);
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

gameRouter.post("/game/:sessionId/is-active", validateGameTokenWithParticipant(sessionManager), (req, res) => {
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();

  res.json({
    is_active: gameInstance.getGameEngine().isGameStarted(),
  });
});

gameRouter.post("/game/:sessionId/get-tilemap", validateGameTokenWithParticipant(sessionManager), (req, res) => {
  const gameSession = req.gameSession;
  const gameInstance = gameSession.getGameInstance();

  const tileMap = gameInstance.getGameEngine().getTileMap();
  //kubicLog.debug(`game-routes.js::[get-tilemap] Raw tileMap:`, tileMap);
  //kubicLog.debug(`game-routes.js::[get-tilemap] Raw tileMap.tiles:`, tileMap.getTiles());
  
  // Process tilemap data using the dedicated function
  const response = processTileMapData(tileMap);
  
  res.json(response);
});

// Generic play turn endpoint for all games
gameRouter.post("/game/:sessionId/play-turn", validateGameTokenWithParticipant(sessionManager), validatePlayableParticipant(sessionManager), (req, res) => {
  const { sessionId } = req.params;
  const { participantId, ...moveData } = req.body;

  const gameSession = req.gameSession; // Now available from middleware
  const gameInstance = gameSession.getGameInstance();
  
  // Get the current players from the game engine
  const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
  
  // Validate that the participant is the current player
  const participant = req.participant;
  
  // Find the player that corresponds to this participant
  const playerMappings = gameInstance.getPlayerMappings();
  const playerId = playerMappings[participantId];
  
  if (!playerId) {
    return res.status(400).json({ error: "Participant is not a player in this game." });
  }
  
  // Validate that it's this player's turn
  const currentPlayerIds = Array.isArray(currentPlayers) 
    ? currentPlayers.map(p => p.getPlayerId()) 
    : [currentPlayers?.getPlayerId()];
  
  if (!currentPlayerIds.includes(playerId)) {
    return res.status(400).json({ error: `It's not your turn (playerId: ${playerId}). Current player ids: ` + currentPlayerIds.join(", ") });
  }

  // Play the turn - pass turnData consistently for all games
  let playStatus;
  try {
    // Debug: Log the game instance type and method call
    kubicLog.debug(`[game-routes] Game instance type:`, gameInstance.constructor.name);
    kubicLog.debug(`[game-routes] Calling playTurn on game instance with playerId: ${playerId}, moveData:`, moveData);
    
    // All games receive: playTurn(playerId, turnData)
    // turnData contains all move information (xPos, yPos, action, etc.)
    playStatus = gameInstance.playTurn(playerId, moveData);
    
    kubicLog.debug(`[game-routes] playTurn returned:`, playStatus);
    kubicLog.debug(`[game-routes] playStatus.playerHasWon:`, playStatus.access("playerHasWon"));
  } catch (error) {
    kubicLog.error(`[game-routes] Error in playTurn:`, error);
    return res.status(400).json({ 
      error: "Invalid move.", 
      details: error.message 
    });
  }
  
  // Handle win condition
  if (playStatus.access("playerHasWon")) {
    kubicLog.debug(`[game-routes] Win condition detected! Player ${playStatus.access("playerId")} won`);
    
    // Record the win in game history
    try {
      const playerMappings = gameInstance.getPlayerMappings();
      let participantId = null;
      
      for (const [pid, playerId] of Object.entries(playerMappings)) {
        if (playerId === playStatus.access("playerId")) {
          participantId = pid;
          break;
        }
      }
      
      kubicLog.debug(`[game-routes] Recording human win for player ${playStatus.access("playerId")} -> participant ${participantId}`);
      
      gameSession.getGameHistory().addPlayerWonEvent(
        playStatus.access("playerId"),
        participantId,
        {
          winCondition: playStatus.access("winCondition") || "unknown",
          finalPosition: { x: moveData.xPos, y: moveData.yPos },
          gameState: "completed",
        }
      );
      kubicLog.debug(`[game-routes] Successfully recorded human win event in history`);
    } catch (error) {
      kubicLog.error(`[game-routes] Error recording human win event:`, error);
    }
    
    gameSession.increaseWinCounter();
    let winCount = gameSession.getWinCounter();
    kubicLog.debug(`[game-routes] Win counter increased to: ${winCount}`);
    GameEventService.broadcastToSession(gameSession, {
      type: "winCount",
      payload: { winCount },
    });
  }
  
  // Handle tie condition
  if (playStatus.access("gameIsTied")) {
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
    if (playStatus.access("playerHasWon")) {
      GameEventService.broadcastToSession(gameSession, {
        type: "playerWon",
        payload: { 
          playerId: playStatus.access("playerId"),
          winCondition: playStatus.access("winCondition") || "unknown"
        }
      });
    }
    
    // If the game is tied, broadcast a tie event
    if (playStatus.access("gameIsTied")) {
      GameEventService.broadcastToSession(gameSession, {
        type: "gameTied",
        payload: { 
          message: "Game ended in a tie"
        }
      });
    }
  } catch (broadcastError) {
    kubicLog.error("game-routes.js::Broadcast error (non-blocking):", broadcastError);
    // Don't throw here - the turn was played successfully, just the broadcast failed
  }
});

// Handle sequential computer players
const processComputerTurns = async (gameSession, initialPlayStatus = null) => {
  const gameInstance = gameSession.getGameInstance();
  let lastPlayStatus = initialPlayStatus;
  
  // Keep processing computer turns while:
  // 1. No one has won yet and game hasn't tied (or no initial status provided)
  // 2. Current players include computers
  // 3. Game is still active
  while ((!lastPlayStatus || (!lastPlayStatus.access("playerHasWon") && !lastPlayStatus.access("gameIsTied"))) && 
         gameInstance.getGameEngine().isGameStarted()) {
    
    // Get current players for this iteration
    const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
    const playersArray = Array.isArray(currentPlayers) ? currentPlayers : [currentPlayers];
    
    // Extract computer players from current players
    const computerPlayers = playersArray.filter(player => player?.getPlayerType() === "computer");
    
    // If no computer players, break the loop
    if (computerPlayers.length === 0) {
      break;
    }
    
    kubicLog.debug(`game-routes.js::[processComputerTurns] Processing ${computerPlayers.length} computer player(s):`, 
      computerPlayers.map(p => `${p.getPlayerId()} (${p.getPlayerType()})`));
    
    // Process each computer player in the current turn
    for (const computerPlayer of computerPlayers) {
      try {
        // Random delay for computer moves (1-2 seconds)
        const delay = 1000 + Math.floor(Math.random() * 1001);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Calculate computer move
        const computerMove = gameInstance.calculateComputerMove(computerPlayer.getPlayerId(), computerPlayer);
        
        // Play computer turn - consistent format for all games
        let compPlayStatus = gameInstance.playTurn(computerPlayer.getPlayerId(), computerMove);

        // Handle computer win
        if (compPlayStatus.access("playerHasWon")) {
          // Record the win in game history
          try {
            const playerMappings = gameInstance.getPlayerMappings();
            let participantId = null;
            
            for (const [pid, playerId] of Object.entries(playerMappings)) {
              if (playerId === compPlayStatus.access("playerId")) {
                participantId = pid;
                break;
              }
            }
            
            kubicLog.debug(`[game-routes] Recording computer win for player ${compPlayStatus.access("playerId")} -> participant ${participantId}`);
            
            gameSession.getGameHistory().addPlayerWonEvent(
              compPlayStatus.access("playerId"),
              participantId,
              {
                winCondition: compPlayStatus.access("winCondition") || "unknown",
                finalPosition: { x: computerMove.xPos, y: computerMove.yPos },
                gameState: "completed",
              }
            );
            kubicLog.debug(`[game-routes] Successfully recorded computer win event in history`);
          } catch (error) {
            kubicLog.error(`[game-routes] Error recording computer win event:`, error);
          }
          
          gameSession.increaseWinCounter();
          let winCount = gameSession.getWinCounter();
          GameEventService.broadcastToSession(gameSession, {
            type: "winCount",
            payload: { winCount },
          });
        }
        
        // Handle computer tie
        if (compPlayStatus.access("gameIsTied")) {
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
        if (compPlayStatus.access("playerHasWon")) {
          GameEventService.broadcastToSession(gameSession, {
            type: "playerWon",
            payload: { 
              playerId: compPlayStatus.access("playerId"),
              winCondition: compPlayStatus.access("winCondition") || "unknown"
            }
          });
          
          // Stop processing if computer won
          return compPlayStatus;
        }
        
        // If the game is tied, broadcast a tie event
        if (compPlayStatus.access("gameIsTied")) {
          GameEventService.broadcastToSession(gameSession, {
            type: "gameTied",
            payload: { 
              message: "Game ended in a tie"
            }
          });
          
          // Stop processing if game tied
          return compPlayStatus;
        }
        
        // Update lastPlayStatus for next iteration
        lastPlayStatus = compPlayStatus;
        
      } catch (error) {
        kubicLog.error(`game-routes.js::[processComputerTurns] Error during computer turn for player ${computerPlayer.getPlayerId()}:`, error);
        // Continue with next computer player instead of breaking completely
        continue;
      }
    }
    
    // After processing all computer players in the current turn, check if the next turn also has computer players
    // The game engine should have advanced to the next turn after each playTurn call
    // If the next turn also has computer players, the while loop will continue
  }
  
  return lastPlayStatus;
};

// Get game options information
gameRouter.post("/game/:sessionId/options", validateGameTokenWithParticipant(sessionManager), (req, res) => {
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
      frozen: gameOptions.getOptionsByLifecycle("frozen"),
      "pre-start": gameOptions.getOptionsByLifecycle("pre-start"),
      runtime: gameOptions.getOptionsByLifecycle("runtime"),
      "between-rounds": gameOptions.getOptionsByLifecycle("between-rounds")
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
