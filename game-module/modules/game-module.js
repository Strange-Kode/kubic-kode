import { GameEventService } from "../../game-server/game-event-service.js";
import { kubicLog } from "../../kubic-log.js";
import { serializeRecursively } from "../../game-utility/game-utility.js";

export default {
  async init() {
    kubicLog.info('[game] Module initialized');
  },

  /**
   * Handle game start logic
   * @param {Object} gameSession - The game session
   * @param {Object} options - Game options to apply
   * @param {string} requestingParticipantId - ID of the participant requesting the start (optional)
   * @param {Function} formatPlayerIdsCallback - Callback to format player IDs
   * @param {Function} processComputerTurnsCallback - Callback to process computer turns
   * @returns {Object} Result of game start operation
   */
  handleGameStart(gameSession, options = {}, requestingParticipantId = null, formatPlayerIdsCallback, processComputerTurnsCallback) {
    const gameInstance = gameSession.getGameInstance();
    const sessionParticipants = gameSession.getParticipants();

    const result = {};

    // Only merge lobby config on FIRST start (restartCounter === 0)
    // Lobby config contains pre-start options like difficulty that can't be applied after first start
    // On restart, only use explicitly passed options
    const isFirstStart = gameSession.getRestartCounter() === 0;
    const lobbyConfig = isFirstStart ? gameSession.getLobbyManager().getAllLobbyConfig() : {};
    const mergedOptions = { ...lobbyConfig, ...options };

    // Check if game is already started
    if (gameInstance.getGameEngine().isGameStarted()) {
      const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
      const currentPlayerIds = Array.isArray(currentPlayers) 
        ? currentPlayers.map(p => p.getPlayerId()) 
        : [currentPlayers?.getPlayerId()].filter(Boolean);
      
      // Format player IDs based on returnSinglePlayerId option
      const formatResult = formatPlayerIdsCallback(gameInstance, currentPlayerIds);
      if (formatResult.error) {
        return formatResult;
      }
              
      const result = {
        success: true,
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

    // Step 2: Apply game options BEFORE starting the game (for pre-start options like difficulty)
    if (Object.keys(mergedOptions).length > 0) {
      const gameOptions = gameInstance.getGameOptions();
      if (gameOptions) {
        result.applied_game_options = [];
        const validation = gameOptions.validateAndApply(mergedOptions);
        
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
          }
          result.applied_game_options.push({
            key: key,
            value: value
          });
        }

        // Call applyGameOptions on the game instance if it exists
        if (typeof gameInstance.applyGameOptions === "function") {
          gameInstance.applyGameOptions(validation.applied);
        }
      }
    }

    // Step 3: Start the game session (if not already started)
    gameSession.markStarted();
  
    // Step 4: Start the game instance
    gameInstance.startGame();

    // Step 5: Establish first player(s) and return as current player(s)
    const sessionContext = {
      restartCount: gameSession.getRestartCounter(),
      winCount: gameSession.getWinCounter()
    };
    const firstPlayerIds = gameInstance.establishFirstPlayers(sessionContext);
    const currentPlayers = gameInstance.getGameEngine().getCurrentTurnPlayers();
    const currentPlayerIds = Array.isArray(currentPlayers) 
      ? currentPlayers.map(p => p.getPlayerId()) 
      : [currentPlayers?.getPlayerId()].filter(Boolean);
    
    // Format player IDs based on returnSinglePlayerId option
    const formatResult = formatPlayerIdsCallback(gameInstance, currentPlayerIds);
    if (formatResult.error) {
      return formatResult;
    }
    
    if (formatResult.returnSinglePlayerId) {
      result.current_player_id = formatResult.playerId;
      result.first_player_id = firstPlayerIds;
    } else {
      result.current_player_ids = formatResult.playerIds;
      result.first_player_ids = firstPlayerIds ? [firstPlayerIds] : [];
    }
    result.success = true;
    result.game_started = true;
    result.status = "New game created";

    // Broadcast the event after sending the response to avoid blocking the request
    try {
      const inactivityTimeoutMs = gameInstance.getInactivityTimeout();
      const inactivityTimeoutSeconds = Math.floor(inactivityTimeoutMs / 1000);

      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::gameStarted",
        payload: {
          playerMappings: serializeRecursively(playerMappings),
          inactivityTimeout: inactivityTimeoutSeconds
        },
      });
    } catch (broadcastError) {
      kubicLog.error("[game] Broadcast error (non-blocking):", broadcastError);
    }

    // After game start, check if any current players are computers and handle computer turns
    const playersArray = Array.isArray(currentPlayers) ? currentPlayers : [currentPlayers];
    const computerPlayers = playersArray.filter(player => {
      if (!player) return false;
      // Try getPlayerType() first if it exists
      if (typeof player.getPlayerType === "function") {
        return player.getPlayerType() === "computer";
      }
      // Fall back to isComputer() if it exists
      if (typeof player.isComputer === "function") {
        return player.isComputer() === true;
      }
      // If neither method exists, assume not a computer
      return false;
    });
    
    if (computerPlayers.length > 0) {
      // Process computer turns asynchronously to avoid blocking the game start response
      setImmediate(() => {
        processComputerTurnsCallback(gameSession, null).catch(error => {
          kubicLog.error("[game] Error processing initial computer turns after game start:", error);
        });
      });
    }

    return result;
  },

  /**
   * Handle game stop logic
   * @param {Object} gameSession - The game session
   * @returns {Object} Result of game stop operation
   */
  handleGameStop(gameSession) {
    const gameInstance = gameSession.getGameInstance();

    if (!gameInstance.getGameEngine().isGameStarted()) {
      return {
        game_stopped: true,
        message: "Game was already stopped",
      };
    }

    gameInstance.getGameEngine().stopGame();

    // Broadcast the event after responding
    try {
      GameEventService.broadcastToSession(gameSession, {
        type: "kubic::gameStopped",
      });
    } catch (broadcastError) {
      kubicLog.error("[game] Broadcast error (non-blocking):", broadcastError);
    }

    return {
      game_stopped: true,
    };
  },

  /**
   * Get game options information
   * @param {Object} gameInstance - The game instance
   * @returns {Object} Game options information
   */
  getGameOptions(gameInstance) {
    const gameOptions = gameInstance.getGameOptions();
    if (!gameOptions) {
      return {
        available: false,
        message: "This game does not support options"
      };
    }

    return {
      available: true,
      options: gameOptions.getAllOptions(),
      configurable: gameOptions.getConfigurableOptions(),
      frozen: gameOptions.getFrozenOptions(),
      metadata: gameOptions.getOptionsMetadata(),
      lifecycle: {
        frozen: gameOptions.getOptionsByLifecycle("frozen"),
        "pre-start": gameOptions.getOptionsByLifecycle("pre-start"),
        runtime: gameOptions.getOptionsByLifecycle("runtime"),
        "between-rounds": gameOptions.getOptionsByLifecycle("between-rounds")
      },
      modifiable: gameOptions.getModifiableOptions(),
      game_state: gameOptions.getGameState(),
      debug: gameOptions.getDebugInfo()
    };
  },

  /**
   * Check if game is active
   * @param {Object} gameInstance - The game instance
   * @returns {boolean} True if game is started
   */
  isGameActive(gameInstance) {
    return gameInstance.getGameEngine().isGameStarted();
  }
};

