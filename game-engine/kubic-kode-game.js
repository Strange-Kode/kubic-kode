import { GameInterface } from "./game-interface.js";
import { GameOptions } from "./game-options.js";
import { gameContract } from "./game-contract.js";
import { PlayStatus } from "./play-status.js";
import { shuffleArray } from "../game-utility/game-utility.js";

import { kubicLog } from "../kubic-log.js";
import { 
  KubicSystemError, 
  KubicGameError, 
  ErrorFactory,
  ErrorCodes 
} from "./kubic-kode-error.js";

// KubicKodeGame is a class that acts as a proxy for the game instance and game session.
// It delegates method calls to the game instance and records the game history.
class KubicKodeGame extends GameInterface {
  constructor(gameInstance, gameSession) {
    super();
    this.__gameInstance = gameInstance; // Game instance
    this.__gameSession = gameSession; // GameSession instance
    this.__gameOptions = new GameOptions();
    this.__playerMappings = {}; // Store participantId -> playerId mappings

    // Register system options that KubicKodeGame handles automatically
    this._registerSystemOptions();

    // Validate that the game instance implements the required contract
    const validation = gameContract.validateGameInstance(gameInstance, gameInstance.constructor.name);
    if (!validation.valid) {
      throw ErrorFactory.system(
        `Game instance validation failed: ${validation.error}`,
        "GameContract",
        { context: { gameInstanceType: gameInstance.constructor.name, validationDetails: validation } }
      );
    }

    // Bind wrapper methods to the game instance so they can be called from within the game
    gameInstance.getOptionValue = this.getOptionValue.bind(this);
    gameInstance.getGameOptions = this.getGameOptions.bind(this);

    // Create a proxy that forwards unknown methods
    const proxy = new Proxy(this, {
      get(target, prop) {
        // Special handling for getOptionValue - always use the wrapper's implementation
        if (prop === "getOptionValue") {
          return target.getOptionValue.bind(target);
        }
        
        // If method exists on wrapper, use it
        if (prop in target) {
          return target[prop];
        }

        // If method exists on game instance, forward it
        if (prop in target.__gameInstance) {
          return target.__gameInstance[prop];
        }

        // Otherwise, throw error
        throw ErrorFactory.system(
          `Method ${prop} not found`,
          "KubicKodeGame",
          { context: { requestedMethod: prop, availableMethods: Object.getOwnPropertyNames(target) } }
        );
      },
    });

    // Initialize game options after the proxy is created
    if (typeof this.__gameInstance.initializeGameOptions === "function") {
      // Call initializeGameOptions on the proxy so getGameOptions() is available
      proxy.initializeGameOptions();
    }

    return proxy;
  }

  get gameInstance() {
    throw ErrorFactory.system(
      "Attempting to access gameInstance property on KubicKodeGame. Not allowed, gameInstance is a private property.",
      "KubicKodeGame",
      { context: { suggestion: "Use getGameInstance() method instead" } }
    );
  }

  get gameSession() {
    throw ErrorFactory.system(
      "Attempting to access gameSession property on KubicKodeGame. Not allowed, gameSession is a private property.",
      "KubicKodeGame",
      { context: { suggestion: "Use getGameSession() method instead" } }
    );
  }

  get gameOptions() {
    throw ErrorFactory.system(
      "Attempting to access gameOptions property on KubicKodeGame. Not allowed, gameOptions is a private property.",
      "KubicKodeGame",
      { context: { suggestion: "Use getGameOptions() method instead" } }
    );
  }

  get playerMappings() {
    throw ErrorFactory.system(
      "Attempting to access playerMappings property on KubicKodeGame. Not allowed, playerMappings is a private property.",
      "KubicKodeGame",
      { context: { suggestion: "Use getPlayerMappings() method instead" } }
    );
  }

  // Proxy methods
  // -------------

  playTurn(playerId, turnData, metadata = {}) {
    console.log(`[KubicKodeGame] playTurn called with playerId: ${playerId}, turnData:`, turnData);
    
    // Delegate to the actual game with consistent turnData format
    let playStatus = this.__gameInstance.playTurn(playerId, turnData, metadata);

    // Ensure result is a PlayStatus instance
    if (!(playStatus instanceof PlayStatus)) {
      // Convert plain object to PlayStatus for backward compatibility
      playStatus = new PlayStatus(playStatus);
    }

    // Add the playerId to the result
    playStatus.set('playerId', playerId);

    // Only record history if the turn was valid
    if (playStatus.access("status") === "ok" || playStatus.access("status") === "valid") {
      // Mark player as having acted and reset inactivity timer
      const inactivityManager = this.__gameSession.getInactivityManager();
      if (inactivityManager) {
        inactivityManager.markPlayerActed(playerId);
        inactivityManager.resetTimer();
        playStatus.set("timeLeft", inactivityManager.getTimeRemaining());
      }

      // Check if turn should be advanced based on play style
      const engine = this.__gameInstance.getGameEngine();
      const playStyle = engine.getPlayStyle();
      
      if (playStyle === "single-set") {
        // For single-set, advance turn and clear acted players for next turn
        engine.nextTurn(playerId);
        if (inactivityManager) {
          inactivityManager.clearActedPlayers();
        }
      } else if (playStyle === "multi-set" || playStyle === "multi-subset") {
        // For multi-set/multi-subset, check if all players have acted
        engine.nextTurn(playerId);
        const currentPlayers = engine.getCurrentTurnPlayers();
        
        if (inactivityManager && inactivityManager.haveAllPlayersActed(currentPlayers)) {
          // All players acted, clear for next turn
          inactivityManager.clearActedPlayers();
        }
      } else if (playStyle === "non-blocking") {
        // For non-blocking, advance turn number but don't clear acted players
        // Let the game implementation manage player action tracking
        engine.nextTurn(playerId);
        // Note: inactivityManager.clearActedPlayers() is not called for non-blocking
        // as players can act at any time and the game manages action tracking
      }

      // Record the turn in history - extract position data for history
      const { xPos: x, yPos: y } = turnData;
      
      // Get the player entity to save player information
      const player = this.__gameInstance.getGameEngine().getPlayerById(playerId);
      
      this.__gameSession.getGameHistory().addTurnPlayedEvent(
        playStatus.access("playerId"),
        this.getParticipantIdForPlayer(playerId),
        {
          x,
          y,
          turnData, // Include full turn data for future extensibility
          player: player ? player.toJSON() : null, // Save player object
          status: playStatus.access("status"),
        }
      );

      // Debug: Log the playStatus object to see what it contains
      console.log(`[KubicKodeGame] playStatus object:`, playStatus);
      console.log(`[KubicKodeGame] playStatus.access("playerHasWon"):`, playStatus.access("playerHasWon"));
      console.log(`[KubicKodeGame] playStatus.access("playerId"):`, playStatus.access("playerId"));
      
      // Record win if it occurred and stop the game
      if (playStatus.access("playerHasWon")) {
        console.log(`[KubicKodeGame] Win detected for player ${playStatus.access("playerId")}`);
        
        // Stop the game and clear inactivity timer when someone wins
        this.__gameOptions.setGameState("ended");
        this.__gameSession.markEnded();
      }

      // Record tie if it occurred and stop the game
      if (playStatus.access("gameIsTied")) {
        this.__gameSession.getGameHistory().addGameTiedEvent({
          finalPosition: { x, y },
          gameState: "tied",
        });

        // Stop the game and clear inactivity timer when game is tied
        this.__gameOptions.setGameState("ended");
        this.__gameSession.markEnded();
      }
    } else {
      // Record invalid turn attempt - extract position data for history
      const { xPos: x, yPos: y } = turnData;
      this.__gameSession.getGameHistory().addInvalidTurnAttemptedEvent(
        playerId,
        this.getParticipantIdForPlayer(playerId),
        {
          x,
          y,
          turnData, // Include full turn data for future extensibility
          reason: playStatus.access("type") || "invalid_move",
          status: playStatus.access("status"),
        }
      );
    }

    return playStatus;
  }
  
  addPlayer(name, isComputer = false) {
    const player = this.__gameInstance.addPlayer(name, isComputer);

    // Record player addition event
    if (this.__gameSession) {
      this.__gameSession.getGameHistory().addPlayerAddedEvent(
        player.getPlayerId(),
        this.getParticipantIdForPlayer(player.getPlayerId()),
        {
          playerName: name,
          playerId: player.getPlayerId(),
        }
      );
    }

    return player;
  }

  startGame() {
    let requiredPlayers = this.requiredPlayers();
    if (this.__gameInstance.getGameEngine().getPlayerEntities().length < requiredPlayers) {
      throw ErrorFactory.game(
        `At least ${requiredPlayers} players are required to start the game.`,
        this.__gameInstance.constructor.name,
        null,
        { context: { currentPlayers: this.__gameInstance.getGameEngine().getPlayerEntities().length, requiredPlayers } }
      );
    }

    // Transition game options to "started" state - this locks pre-start options
    this.__gameOptions.setGameState("started");

    const result = this.__gameInstance.startGame
      ? this.__gameInstance.startGame()
      : this.__gameInstance.getGameEngine().startGame();

    // Record game start event
    if (this.__gameSession) {
      this.__gameSession.getGameHistory().addGameInstanceStartedEvent({
        playerCount: this.__gameInstance.getGameEngine().getPlayerEntities()
          .length,
        gameType: this.__gameInstance.constructor.name,
        requiredPlayers: requiredPlayers
      });
    }

    return result;
  }

  // Handle inactivity with history recording
  handleInactivity(playerId = null, player = null) {
    // Only handle inactivity if the game is still running
    if (!this.__gameInstance.getGameEngine().isGameStarted()) {
      return {
        inactivePlayerId: null,
        winnerPlayerId: null,
      };
    }
    
    if (!this.__gameInstance.handleInactivity) {
      return null;
    }
    const inactivityResult = this.__gameInstance.handleInactivity(playerId, player);

    // Record inactivity win event
    if (this.__gameSession && inactivityResult.winnerPlayerId) {
      this.__gameSession.getGameHistory().addPlayerWonEvent(
        inactivityResult.winnerPlayerId,
        this.getParticipantIdForPlayer(inactivityResult.winnerPlayerId),
        {
          winCondition: "inactivity",
          inactivePlayerId: inactivityResult.inactivePlayerId,
          gameState: "completed",
        }
      );
    }

    return inactivityResult;
  }

  // Handle game stop with history recording
  resetForRestart() {
    // Clear all player entities to prevent duplicates during restart
    const gameEngine = this.__gameInstance.getGameEngine();
    if (gameEngine && typeof gameEngine.clearPlayerEntities === "function") {
      gameEngine.clearPlayerEntities();
    }

    const result = this.__gameInstance.resetForRestart();

    // Record game reset event
    if (this.__gameSession) {
      this.__gameSession.getGameHistory().addGameInstanceResetEvent({
        gameType: this.__gameInstance.constructor.name,
        resetReason: "restart",
      });
    }

    return result;
  }

  // Helper method for participant mapping
  getParticipantIdForPlayer(playerId) {
    if (!this.__gameSession) return null;

    // First try to use the player mappings (most reliable)
    if (this.__playerMappings) {
      // Find the participant ID that maps to this player ID
      for (const [participantId, mappedPlayerId] of Object.entries(this.__playerMappings)) {
        if (mappedPlayerId === playerId) {
          return participantId;
        }
      }
    }

    // Fallback: Find the participant that corresponds to this player by name
    // This assumes the player name matches the participant name
    const participant = this.__gameSession
      .getParticipants()
      .find((p) => p.name === this.getPlayerNameById(playerId));

    return participant ? participant.id : null;
  }

  // Set player mappings (participantId -> playerId)
  setPlayerMappings(mappings) {
    this.__playerMappings = mappings;
  }

  // Get player mappings (participantId -> playerId)
  getPlayerMappings() {
    return this.__playerMappings;
  }

  // Helper method to get player name by ID
  getPlayerNameById(playerId) {
    const players = this.__gameInstance.getGameEngine().getPlayerEntities();
    const player = players.find((p) => p.getPlayerId() === playerId);
    return player ? player.getPlayerName() : null;
  }

  // Helper method to get win condition description
  getWinConditionDescription(x, y) {
    // This is a simplified version - game instances can override this
    // For tic-tac-toe, we could check the specific win condition
    if (this.__gameInstance.checkWinCondition) {
      // Try to determine win condition based on position
      const directions = [
        { dx: 1, dy: 0, name: "horizontal" },
        { dx: 0, dy: 1, name: "vertical" },
        { dx: 1, dy: 1, name: "diagonal" },
        { dx: 1, dy: -1, name: "diagonal" },
      ];

      // For now, return a generic description
      return "line_completion";
    }
    return "unknown";
  }

  stopGame() {
    const result = this.__gameInstance.stopGame
      ? this.__gameInstance.stopGame()
      : this.__gameInstance.getGameEngine().stopGame();

    this.__gameSession.getGameHistory().addGameStoppedEvent({
      reason: "manual",
      timestamp: new Date().toISOString(),
    });

    // Clear inactivity timer when game stops
    this.__gameOptions.setGameState("ended");
    this.__gameSession.markEnded();

    return result;
  }

  // Expose game instance methods that don't need history
  getGameEngine() {
    return this.__gameInstance.getGameEngine();
  }

  getTileMap() {
    // Default implementation if game instance doesn't provide it
    if (typeof this.__gameInstance.getTileMap === "function") {
      return this.__gameInstance.getTileMap();
    }
    return this.__gameInstance.getGameEngine().getTileMap();
  }

  getCurrentTurnPlayers() {
    // Default implementation if game instance doesn't provide it
    if (typeof this.__gameInstance.getCurrentTurnPlayers === "function") {
      return this.__gameInstance.getCurrentTurnPlayers();
    }
    return this.__gameInstance.getGameEngine().getCurrentTurnPlayers();
  }

  getWinner() {
    // Default implementation if game instance doesn't provide it
    if (typeof this.__gameInstance.getWinner === "function") {
      return this.__gameInstance.getWinner();
    }
    return null; // Default: no winner
  }

  getInactivityTimeout() {
    // Only provide inactivity timeout if game instance implements handleInactivity
    if (typeof this.__gameInstance.handleInactivity !== "function") {
      return null; // No inactivity timeout if game doesn't handle inactivity
    }

    // Check system option first
    const systemTimeout = this.__gameOptions.getCurrentSystemValue("inactivityTimeout");
    if (systemTimeout !== null && systemTimeout !== undefined) {
      return systemTimeout;
    }

    // Fall back to game instance implementation
    if (typeof this.__gameInstance.getInactivityTimeout === "function") {
      return this.__gameInstance.getInactivityTimeout();
    }
    
    return null; // Default: no inactivity timeout
  }

  requiredPlayers() {
    // Delegate to the game instance to determine required players
    if (typeof this.__gameInstance.requiredPlayers === "function") {
      return this.__gameInstance.requiredPlayers();
    }
    
    // Default: require at least 2 players for most games
    return 2;
  }

  calculateComputerMove(playerId, computerPlayer) {
    // Default implementation if game instance doesn't provide it
    if (typeof this.__gameInstance.calculateComputerMove === "function") {
      return this.__gameInstance.calculateComputerMove(playerId, computerPlayer);
    }
    return null; // Default: no computer move calculation
  }

  isGameActive() {
    // Default implementation if game instance doesn't provide it
    if (typeof this.__gameInstance.isGameActive === "function") {
      return this.__gameInstance.isGameActive();
    }
    return this.__gameInstance.getGameEngine().isGameStarted();
  }

  getGameStats() {
    // Default implementation if game instance doesn't provide it
    if (typeof this.__gameInstance.getGameStats === "function") {
      return this.__gameInstance.getGameStats();
    }
    return {
      isActive: this.isGameActive(),
      playerCount: this.__gameInstance.getGameEngine().getPlayerEntities().length
    };
  }

  getGameOptions() {
    return this.__gameOptions;
  }

  // Helper method to get the current value of a game option
  getOptionValue(key) {
    return this.__gameOptions.getCurrentValue(key);
  }

  establishFirstPlayers(sessionContext = null) {
    // Check system option for specific participant preference
    const participantId = this.__gameOptions.getCurrentSystemValue("participantPlaysFirst");
    
    // If a specific participant is configured via system options
    if (participantId) {
      const playerId = this.__playerMappings[participantId];
      if (playerId) {
        // Set this player as first in turn order
        this._setFirstPlayer(playerId);
        return playerId;
      } else {
        kubicLog.warn(`[KubicKodeGame]::establishFirstPlayers: Participant ${participantId} not found in player mappings`);
      }
    }

    // Check if game instance has its own implementation
    if (typeof this.__gameInstance.establishFirstPlayers === "function") {
      const result = this.__gameInstance.establishFirstPlayers(sessionContext);
      if (result) {
        // If game returned a player ID, set it as first
        this._setFirstPlayer(result);
        return result;
      }
    }

    // No specific first player requested - randomize based on play style
    return this._randomizeFirstPlayers();
  }

  // Helper method to set a specific player as first in turn order
  _setFirstPlayer(playerId) {
    const engine = this.__gameInstance.getGameEngine();
    const playStyle = engine.getPlayStyle();
    
    if (playStyle === "single-set" || playStyle === "multi-set") {
      const currentOrder = engine.getTurnOrder();
      const playerIndex = currentOrder.indexOf(playerId);
      
      if (playerIndex !== -1) {
        // Move the player to the front
        const reorderedPlayers = [playerId, ...currentOrder.filter(id => id !== playerId)];
        engine.setTurnOrder(reorderedPlayers);
        engine.setCurrentTurnIndex(0); // Reset to first position
      }
    } else if (playStyle === "multi-subset") {
      // For multi-subset, ensure the player's subset goes first
      const currentOrder = engine.getTurnOrder();
      let targetSubsetIndex = -1;
      
      for (let i = 0; i < currentOrder.length; i++) {
        if (currentOrder[i].includes(playerId)) {
          targetSubsetIndex = i;
          break;
        }
      }
      
      if (targetSubsetIndex !== -1 && targetSubsetIndex !== 0) {
        // Move the target subset to the front
        const modifiedOrder = [...currentOrder];
        const targetSubset = modifiedOrder.splice(targetSubsetIndex, 1)[0];
        modifiedOrder.unshift(targetSubset);
        engine.setTurnOrder(modifiedOrder);
        engine.setCurrentTurnIndex(0);
      }
    }
    // For non-blocking, order doesn't matter
  }

  // Helper method to randomize first players based on play style
  _randomizeFirstPlayers() {
    const engine = this.__gameInstance.getGameEngine();
    const playStyle = engine.getPlayStyle();
    const players = engine.getPlayerEntities();
    
    if (players.length === 0) {
      return null;
    }

    if (playStyle === "single-set") {
      // Randomize the order of all players
      const shuffledIds = shuffleArray(players.map(p => p.getPlayerId()));
      engine.setTurnOrder(shuffledIds);
      engine.setCurrentTurnIndex(0);
      return shuffledIds[0];
    } else if (playStyle === "multi-set") {
      // All players act simultaneously, but randomize for consistency
      const shuffledIds = shuffleArray(players.map(p => p.getPlayerId()));
      engine.setTurnOrder(shuffledIds);
      return shuffledIds[0]; // Return first for consistency
    } else if (playStyle === "multi-subset") {
      // Randomize the order of subsets
      const currentOrder = engine.getTurnOrder();
      const shuffledOrder = shuffleArray(currentOrder);
      engine.setTurnOrder(shuffledOrder);
      engine.setCurrentTurnIndex(0);
      // Return first player from first subset
      return shuffledOrder[0] && shuffledOrder[0][0];
    } else if (playStyle === "non-blocking") {
      // Return a random player but don't change turn order
      const randomPlayer = players[Math.floor(Math.random() * players.length)];
      return randomPlayer.getPlayerId();
    }
    
    return null;
  }

  /**
   * Game Options Pattern for Game Implementations:
   * 
   * 1. In initializeGameOptions(), register your options:
   *    this.getGameOptions().addOption("gridSize", 5, "runtime", (value) => {
   *      if (value < 3 || value > 10) return "Grid size must be 3-10";
   *      return true;
   *    });
   * 
   * 2. KubicKodeGame automatically handles common game options:
   *    - gridSize: Automatically resizes tile map via updateTileMapDimensions()
   *    - No need to implement applyGameOptions() for common operations!
   * 
   * 3. For custom logic, implement applyGameOptions() (optional):
   *    applyGameOptions(options) {
   *      // Handle custom option logic that can't be automated
   *      if (options.customOption) {
   *        // Custom handling
   *      }
   *    }
   * 
   * 4. Access current values via getOptionValue():
   *    const currentGridSize = this.getOptionValue("gridSize");
   * 
   * 5. The GameOptions system automatically:
   *    - Validates options when applied
   *    - Stores applied values
   *    - Returns correct values via /game/options
   *    - Handles frozen vs configurable options
   *    - Updates common game properties automatically
   * 
   * IMPORTANT: Game options are stored exclusively in this.getGameOptions().
   * Do NOT store option values as instance properties (this.gridSize, etc.).
   * Always use this.getOptionValue("gridSize") to access current values.
   * 
   * Example - Simple Configurable Game:
   * 
   * class SimpleGame {
   *   constructor() {
   *     this._engine = new GameEngine(5, 5, { playStyle: "single-set" });
   *   }
   * 
   *   initializeGameOptions() {
   *     this.getGameOptions().addOption("gridSize", 5, "runtime", (value) => {
   *       if (value < 3 || value > 10) return "Grid size must be 3-10";
   *       return true;
   *     });
   *   }
   *   
   *   // No applyGameOptions() needed! KubicKodeGame handles gridSize automatically.
   *   
   *   getGameStats() {
   *     return {
   *       gridSize: this.getOptionValue("gridSize"), // Use GameOptions
   *       // ... other stats
   *     };
   *   }
   * }
   */

  resetGameOptions() {
    this.__gameOptions = new GameOptions();
    // Game options start in pre-start state
    this.__gameOptions.setGameState("pre-start");
  }

  applyGameOptions(options) {
    // First validate the options
    const validation = this.__gameOptions.validateAndApply(options);
    
    if (validation.valid) {
      // Automatically handle common game option updates
      this._handleCommonGameOptions(validation.applied);
      
      // Call the game instance's applyGameOptions method if it exists
      // This allows games to handle custom option logic that can't be automated
      if (typeof this.__gameInstance.applyGameOptions === "function") {
        this.__gameInstance.applyGameOptions(validation.applied);
      }
    }
    
    return validation;
  }

  _handleCommonGameOptions(appliedOptions) {
    // Handle gridSize changes automatically
    if (appliedOptions.gridSize) {
      const gameEngine = this.__gameInstance.getGameEngine();
      if (gameEngine && typeof gameEngine.updateTileMapDimensions === "function") {
        gameEngine.updateTileMapDimensions(appliedOptions.gridSize, appliedOptions.gridSize);
      }
    }

    // Handle system options automatically
    this._handleSystemOptions(appliedOptions);
  }

  _handleSystemOptions(appliedOptions) {
    // Handle participantPlaysFirst: Set up turn order with specified participant first
    if ("system::participantPlaysFirst" in appliedOptions) {
      this._applyParticipantPlaysFirst(appliedOptions["system::participantPlaysFirst"]);
    }

    // Handle turnOrderType: Control how turn order is determined
    if ("system::turnOrderType" in appliedOptions) {
      this._applyTurnOrderType(appliedOptions["system::turnOrderType"]);
    }

    // Handle allowSpectatorVoting: Configure spectator voting behavior
    if ("system::allowSpectatorVoting" in appliedOptions) {
      // This would be implemented in session management
      // For now, just log that it's been set
      kubicLog.debug(`[KubicKodeGame] Spectator voting ${appliedOptions["system::allowSpectatorVoting"] ? "enabled" : "disabled"}`);
    }

    // Handle inactivityTimeout: Player inactivity timeout is automatically handled via getInactivityTimeout()
    if ("system::inactivityTimeout" in appliedOptions) {
      kubicLog.debug(`[KubicKodeGame] Player inactivity timeout set to: ${appliedOptions["system::inactivityTimeout"]}ms`);
    }
  }

  _applyParticipantPlaysFirst(participantId) {
    if (!participantId) return; // null/undefined means no preference

    kubicLog.debug(`[KubicKodeGame] Setting participant ${participantId} to play first`);
    
    // Store this preference to apply when game starts
    // The actual turn order will be set up in the game start logic
    this._preferredFirstParticipant = participantId;
  }

  _applyTurnOrderType(orderType) {
    kubicLog.debug(`[KubicKodeGame] Turn order type set to: ${orderType}`);
    this._turnOrderType = orderType;
  }

  // Developer convenience method to get all available system options
  _getAvailableSystemOptions() {
    return this.__gameOptions.getSystemOptions();
  }

  // Developer convenience method to read a system option
  _readSystemOption(key) {
    return this.__gameOptions.readSystemOption(key);
  }

  // Developer convenience method to get current system option value
  _getCurrentSystemValue(key) {
    return this.__gameOptions.getCurrentSystemValue(key);
  }

  // Register system options that KubicKodeGame handles automatically
  _registerSystemOptions() {
    // participantPlaysFirst: Allows specifying which participant should go first
    this.__gameOptions.addSystemOption(
      "participantPlaysFirst", 
      null, 
      "pre-start",
      (value) => {
        if (value === null || value === undefined) {
          return true; // Allow null/undefined (no preference)
        }
        if (typeof value !== "string") {
          return "participantPlaysFirst must be a participant ID string or null";
        }
        return true;
      },
      "Specifies which participant should go first. Use participant ID or null for default order."
    );

    // turnOrderType: Controls how turn order is determined
    this.__gameOptions.addSystemOption(
      "turnOrderType",
      "join-order",
      "pre-start",
      (value) => {
        const validTypes = ["join-order", "random", "participant-order"];
        if (!validTypes.includes(value)) {
          return `turnOrderType must be one of: ${validTypes.join(", ")}`;
        }
        return true;
      },
      "Controls how turn order is determined: join-order (default), random, or participant-order"
    );

    // allowSpectatorVoting: Whether spectators can participate in restart voting
    this.__gameOptions.addSystemOption(
      "allowSpectatorVoting",
      false,
      "runtime",
      (value) => {
        if (typeof value !== "boolean") {
          return "allowSpectatorVoting must be a boolean";
        }
        return true;
      },
      "Whether spectators can participate in restart voting"
    );

    // inactivityTimeout: Player inactivity timeout in milliseconds
    this.__gameOptions.addSystemOption(
      "inactivityTimeout",
      null,
      "runtime",
      (value) => {
        if (value === null || value === undefined) {
          return true; // Allow null (no timeout)
        }
        if (typeof value !== "number" || value < 1000) {
          return "inactivityTimeout must be a number >= 1000 (milliseconds) or null";
        }
        return true;
      },
      "Player inactivity timeout in milliseconds (how long a player has to make a move), or null for no timeout"
    );

    // returnSinglePlayerId: Allows game routes to send player IDs as a single int value
    this.__gameOptions.addSystemOption(
      "returnSinglePlayerId",
      false,
      "frozen",
      (value) => {
        if (typeof value !== "boolean") {
          return "returnSinglePlayerId must be a boolean";
        }
        return true;
      },
      "When true, game routes return player IDs as a single int value instead of arrays of ints (requires single-set play style)"
    );
  }

  // Method to record custom events
  recordCustomEvent(eventType, playerId, payload = {}) {
    if (this.__gameSession) {
      this.__gameSession.getGameHistory().addEvent({
        type: eventType,
        playerId: playerId,
        participantId: this.getParticipantIdForPlayer(playerId),
        payload: payload,
      });
    }
  }
}

export { KubicKodeGame };
