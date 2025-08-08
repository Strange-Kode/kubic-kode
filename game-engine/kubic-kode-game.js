// KubicKodeGame is a class that acts as a proxy for the game instance and game session.
// It delegates method calls to the game instance and records the game history.
import { GameInterface } from "./game-interface.js";
import { GameOptions } from "./game-options.js";
import { gameContract } from "./game-contract.js";
import { PlayStatus } from "./play-status.js";
import { shuffleArray } from "../game-utility/game-utility.js";

import { kubicLog } from "../kubic-log.js";

class KubicKodeGame extends GameInterface {
  constructor(gameInstance, gameSession) {
    super();
    this.gameInstance = gameInstance; // Game instance
    this.gameSession = gameSession; // GameSession instance
    this.gameOptions = new GameOptions();
    this.playerMappings = {}; // Store participantId -> playerId mappings

    // Register system options that KubicKodeGame handles automatically
    this._registerSystemOptions();

    // Validate that the game instance implements the required contract
    const validation = gameContract.validateGameInstance(gameInstance, gameInstance.constructor.name);
    if (!validation.valid) {
      throw new Error(`Game instance validation failed: ${validation.error}`);
    }

    // Bind wrapper methods to the game instance so they can be called from within the game
    gameInstance.getOptionValue = this.getOptionValue.bind(this);
    gameInstance.getGameOptions = this.getGameOptions.bind(this);

    // Create a proxy that forwards unknown methods
    const proxy = new Proxy(this, {
      get(target, prop) {
        // Special handling for getOptionValue - always use the wrapper's implementation
        if (prop === 'getOptionValue') {
          return target.getOptionValue.bind(target);
        }
        
        // If method exists on wrapper, use it
        if (prop in target) {
          return target[prop];
        }

        // If method exists on game instance, forward it
        if (prop in target.gameInstance) {
          return target.gameInstance[prop];
        }

        // Otherwise, throw error
        throw new Error(`Method ${prop} not found`);
      },
    });

    // Initialize game options after the proxy is created
    if (typeof this.gameInstance.initializeGameOptions === 'function') {
      // Call initializeGameOptions on the proxy so getGameOptions() is available
      proxy.initializeGameOptions();
    }

    return proxy;
  }

  // Proxy methods
  // -------------

  playTurn(playerId, turnData, metadata = {}) {
    // Delegate to the actual game with consistent turnData format
    let playStatus = this.gameInstance.playTurn(playerId, turnData, metadata);

    // Ensure result is a PlayStatus instance
    if (!(playStatus instanceof PlayStatus)) {
      // Convert plain object to PlayStatus for backward compatibility
      playStatus = new PlayStatus(playStatus);
    }

    // Add the playerId to the result
    playStatus.playerId = playerId;

    // Only record history if the turn was valid
    if (playStatus.status === "ok" || playStatus.status === "valid") {
      // Reset inactivity timer back to the game's timeout value
      const inactivityManager = this.gameSession.getInactivityManager();
      if (inactivityManager) {
        inactivityManager.resetTimer();
        playStatus.timeLeft = inactivityManager.getTimeRemaining();
      }

      // Record the turn in history - extract position data for history
      const { xPos: x, yPos: y } = turnData;
      this.gameSession.gameHistory.addTurnPlayedEvent(
        playStatus.playerId,
        this.getParticipantIdForPlayer(playerId),
        {
          x,
          y,
          turnData, // Include full turn data for future extensibility
          mark: playStatus.mark || this.getCurrentPlayerMark(),
          status: playStatus.status,
        }
      );

      // Record win if it occurred and stop the game
      if (playStatus.access('playerHasWon')) {
        this.gameSession.gameHistory.addPlayerWonEvent(
          playStatus.access('playerId'),
          this.getParticipantIdForPlayer(playerId),
          {
            winCondition:
              playStatus.access('winCondition') || this.getWinConditionDescription(x, y),
            finalPosition: { x, y },
            gameState: "completed",
          }
        );

        // Stop the game and clear inactivity timer when someone wins
        this.gameOptions.setGameState('ended');
        this.gameSession.markEnded();
      }

      // Record tie if it occurred and stop the game
      if (playStatus.access('gameIsTied')) {
        this.gameSession.gameHistory.addGameTiedEvent({
          finalPosition: { x, y },
          gameState: "tied",
        });

        // Stop the game and clear inactivity timer when game is tied
        this.gameOptions.setGameState('ended');
        this.gameSession.markEnded();
      }
    } else {
      // Record invalid turn attempt - extract position data for history
      const { xPos: x, yPos: y } = turnData;
      this.gameSession.gameHistory.addInvalidTurnAttemptedEvent(
        playerId,
        this.getParticipantIdForPlayer(playerId),
        {
          x,
          y,
          turnData, // Include full turn data for future extensibility
          reason: playStatus.type || "invalid_move",
          status: playStatus.status,
        }
      );
    }

    return playStatus;
  }
  
  addPlayer(name, isComputer = false) {
    const player = this.gameInstance.addPlayer(name, isComputer);

    // Record player addition event
    if (this.gameSession) {
      this.gameSession.gameHistory.addPlayerAddedEvent(
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
    if (this.gameInstance.getGameEngine().getPlayerEntities().length < requiredPlayers) {
      throw new Error(`At least ${requiredPlayers} players are required to start the game.`);
    }

    // Transition game options to 'started' state - this locks pre-start options
    this.gameOptions.setGameState('started');

    const result = this.gameInstance.startGame
      ? this.gameInstance.startGame()
      : this.gameInstance.getGameEngine().startGame();

    // Record game start event
    if (this.gameSession) {
      this.gameSession.gameHistory.addGameInstanceStartedEvent({
        playerCount: this.gameInstance.getGameEngine().getPlayerEntities()
          .length,
        gameType: this.gameInstance.constructor.name,
        requiredPlayers: requiredPlayers
      });
    }

    return result;
  }

  // Handle inactivity with history recording
  handleInactivity() {
    // Only handle inactivity if the game is still running
    if (!this.gameInstance.getGameEngine().isGameStarted()) {
      return {
        inactivePlayerId: null,
        winnerPlayerId: null,
      };
    }
    
    if (!this.gameInstance.handleInactivity) {
      return null;
    }
    const result = this.gameInstance.handleInactivity();

    // Record inactivity win event
    if (this.gameSession && result.winnerPlayerId) {
      this.gameSession.gameHistory.addPlayerWonEvent(
        result.winnerPlayerId,
        this.getParticipantIdForPlayer(result.winnerPlayerId),
        {
          winCondition: "inactivity",
          inactivePlayerId: result.inactivePlayerId,
          gameState: "completed",
        }
      );
    }

    return result;
  }

  // Handle game stop with history recording
  resetForRestart() {
    // Clear all player entities to prevent duplicates during restart
    const gameEngine = this.gameInstance.getGameEngine();
    if (gameEngine && typeof gameEngine.clearPlayerEntities === 'function') {
      gameEngine.clearPlayerEntities();
    }

    const result = this.gameInstance.resetForRestart();

    // Record game reset event
    if (this.gameSession) {
      this.gameSession.gameHistory.addGameInstanceResetEvent({
        gameType: this.gameInstance.constructor.name,
        resetReason: "restart",
      });
    }

    return result;
  }

  // Helper method for participant mapping
  getParticipantIdForPlayer(playerId) {
    if (!this.gameSession) return null;

    // Find the participant that corresponds to this player
    // This assumes the player name matches the participant name
    const participant = this.gameSession
      .getParticipants()
      .find((p) => p.name === this.getPlayerNameById(playerId));

    return participant ? participant.id : null;
  }

  // Set player mappings (participantId -> playerId)
  setPlayerMappings(mappings) {
    this.playerMappings = mappings;
  }

  // Get player mappings (participantId -> playerId)
  getPlayerMappings() {
    return this.playerMappings;
  }

  // Helper method to get player name by ID
  getPlayerNameById(playerId) {
    const players = this.gameInstance.getGameEngine().getPlayerEntities();
    const player = players.find((p) => p.getPlayerId() === playerId);
    return player ? player.getPlayerName() : null;
  }

  // Helper method to get current player's mark
  getCurrentPlayerMark() {
    const currentPlayer = this.gameInstance.getGameEngine().getCurrentPlayer();
    return currentPlayer ? currentPlayer.markType : null;
  }

  // Helper method to get win condition description
  getWinConditionDescription(x, y) {
    // This is a simplified version - game instances can override this
    // For tic-tac-toe, we could check the specific win condition
    if (this.gameInstance.checkWinCondition) {
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
    const result = this.gameInstance.stopGame
      ? this.gameInstance.stopGame()
      : this.gameInstance.getGameEngine().stopGame();

    this.gameSession.gameHistory.addGameStoppedEvent({
      reason: "manual",
      timestamp: new Date().toISOString(),
    });

    // Clear inactivity timer when game stops
    this.gameOptions.setGameState('ended');
    this.gameSession.markEnded();

    return result;
  }

  // Expose game instance methods that don't need history
  getGameEngine() {
    return this.gameInstance.getGameEngine();
  }

  getTileMap() {
    // Default implementation if game instance doesn't provide it
    if (typeof this.gameInstance.getTileMap === 'function') {
      return this.gameInstance.getTileMap();
    }
    return this.gameInstance.getGameEngine().getTileMap();
  }

  getCurrentTurnPlayers() {
    // Default implementation if game instance doesn't provide it
    if (typeof this.gameInstance.getCurrentTurnPlayers === 'function') {
      return this.gameInstance.getCurrentTurnPlayers();
    }
    return this.gameInstance.getGameEngine().getCurrentTurnPlayers();
  }

  getWinner() {
    // Default implementation if game instance doesn't provide it
    if (typeof this.gameInstance.getWinner === 'function') {
      return this.gameInstance.getWinner();
    }
    return null; // Default: no winner
  }

  getInactivityTimeout() {
    // Only provide inactivity timeout if game instance implements handleInactivity
    if (typeof this.gameInstance.handleInactivity !== 'function') {
      return null; // No inactivity timeout if game doesn't handle inactivity
    }

    // Check system option first
    const systemTimeout = this.gameOptions.getCurrentSystemValue('inactivityTimeout');
    if (systemTimeout !== null && systemTimeout !== undefined) {
      return systemTimeout;
    }

    // Fall back to game instance implementation
    if (typeof this.gameInstance.getInactivityTimeout === 'function') {
      return this.gameInstance.getInactivityTimeout();
    }
    
    return null; // Default: no inactivity timeout
  }

  requiredPlayers() {
    // Delegate to the game instance to determine required players
    if (typeof this.gameInstance.requiredPlayers === 'function') {
      return this.gameInstance.requiredPlayers();
    }
    
    // Default: require at least 2 players for most games
    return 2;
  }

  calculateComputerMove(playerId) {
    // Default implementation if game instance doesn't provide it
    if (typeof this.gameInstance.calculateComputerMove === 'function') {
      return this.gameInstance.calculateComputerMove(playerId);
    }
    return null; // Default: no computer move calculation
  }

  isGameActive() {
    // Default implementation if game instance doesn't provide it
    if (typeof this.gameInstance.isGameActive === 'function') {
      return this.gameInstance.isGameActive();
    }
    return this.gameInstance.getGameEngine().isGameStarted();
  }

  getGameStats() {
    // Default implementation if game instance doesn't provide it
    if (typeof this.gameInstance.getGameStats === 'function') {
      return this.gameInstance.getGameStats();
    }
    return {
      isActive: this.isGameActive(),
      playerCount: this.gameInstance.getGameEngine().getPlayerEntities().length
    };
  }

  getGameOptions() {
    return this.gameOptions;
  }

  // Helper method to get the current value of a game option
  getOptionValue(key) {
    return this.gameOptions.getCurrentValue(key);
  }

  establishFirstPlayers(sessionContext = null) {
    // Check system option for specific participant preference
    const participantId = this.gameOptions.getCurrentSystemValue('participantPlaysFirst');
    
    // If a specific participant is configured via system options
    if (participantId) {
      const playerId = this.playerMappings[participantId];
      if (playerId) {
        // Set this player as first in turn order
        this._setFirstPlayer(playerId);
        return playerId;
      } else {
        kubicLog.warn(`[KubicKodeGame]::establishFirstPlayers: Participant ${participantId} not found in player mappings`);
      }
    }

    // Check if game instance has its own implementation
    if (typeof this.gameInstance.establishFirstPlayers === 'function') {
      const result = this.gameInstance.establishFirstPlayers(sessionContext);
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
    const engine = this.gameInstance.getGameEngine();
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
    const engine = this.gameInstance.getGameEngine();
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
   *    this.getGameOptions().addConfigurable('gridSize', 5, (value) => {
   *      if (value < 3 || value > 10) return 'Grid size must be 3-10';
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
   *    const currentGridSize = this.getOptionValue('gridSize');
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
   * Always use this.getOptionValue('gridSize') to access current values.
   * 
   * Example - Simple Configurable Game:
   * 
   * class SimpleGame {
   *   constructor() {
   *     this._engine = new GameEngine(5, 5, { playStyle: "single-set" });
   *   }
   * 
   *   initializeGameOptions() {
   *     this.getGameOptions().addConfigurable('gridSize', 5, (value) => {
   *       if (value < 3 || value > 10) return 'Grid size must be 3-10';
   *       return true;
   *     });
   *   }
   *   
   *   // No applyGameOptions() needed! KubicKodeGame handles gridSize automatically.
   *   
   *   getGameStats() {
   *     return {
   *       gridSize: this.getOptionValue('gridSize'), // Use GameOptions
   *       // ... other stats
   *     };
   *   }
   * }
   */

  resetGameOptions() {
    this.gameOptions = new GameOptions();
    // Game options start in pre-start state
    this.gameOptions.setGameState('pre-start');
  }

  applyGameOptions(options) {
    // First validate the options
    const validation = this.gameOptions.validateAndApply(options);
    
    if (validation.valid) {
      // Automatically handle common game option updates
      this._handleCommonGameOptions(validation.applied);
      
      // Call the game instance's applyGameOptions method if it exists
      // This allows games to handle custom option logic that can't be automated
      if (typeof this.gameInstance.applyGameOptions === 'function') {
        this.gameInstance.applyGameOptions(validation.applied);
      }
    }
    
    return validation;
  }

  _handleCommonGameOptions(appliedOptions) {
    // Handle gridSize changes automatically
    if (appliedOptions.gridSize) {
      const gameEngine = this.gameInstance.getGameEngine();
      if (gameEngine && typeof gameEngine.updateTileMapDimensions === 'function') {
        gameEngine.updateTileMapDimensions(appliedOptions.gridSize, appliedOptions.gridSize);
      }
    }

    // Handle system options automatically
    this._handleSystemOptions(appliedOptions);
  }

  _handleSystemOptions(appliedOptions) {
    // Handle participantPlaysFirst: Set up turn order with specified participant first
    if ('system::participantPlaysFirst' in appliedOptions) {
      this._applyParticipantPlaysFirst(appliedOptions['system::participantPlaysFirst']);
    }

    // Handle turnOrderType: Control how turn order is determined
    if ('system::turnOrderType' in appliedOptions) {
      this._applyTurnOrderType(appliedOptions['system::turnOrderType']);
    }

    // Handle allowSpectatorVoting: Configure spectator voting behavior
    if ('system::allowSpectatorVoting' in appliedOptions) {
      // This would be implemented in session management
      // For now, just log that it's been set
      kubicLog.debug(`[KubicKodeGame] Spectator voting ${appliedOptions['system::allowSpectatorVoting'] ? 'enabled' : 'disabled'}`);
    }

    // Handle inactivityTimeout: Player inactivity timeout is automatically handled via getInactivityTimeout()
    if ('system::inactivityTimeout' in appliedOptions) {
      kubicLog.debug(`[KubicKodeGame] Player inactivity timeout set to: ${appliedOptions['system::inactivityTimeout']}ms`);
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
  getAvailableSystemOptions() {
    return this.gameOptions.getSystemOptions();
  }

  // Developer convenience method to read a system option
  readSystemOption(key) {
    return this.gameOptions.readSystemOption(key);
  }

  // Developer convenience method to get current system option value
  getCurrentSystemValue(key) {
    return this.gameOptions.getCurrentSystemValue(key);
  }

  // Register system options that KubicKodeGame handles automatically
  _registerSystemOptions() {
    // participantPlaysFirst: Allows specifying which participant should go first
    this.gameOptions.addSystemOption(
      'participantPlaysFirst', 
      null, 
      'pre-start',
      (value) => {
        if (value === null || value === undefined) {
          return true; // Allow null/undefined (no preference)
        }
        if (typeof value !== 'string') {
          return 'participantPlaysFirst must be a participant ID string or null';
        }
        return true;
      },
      'Specifies which participant should go first. Use participant ID or null for default order.'
    );

    // turnOrderType: Controls how turn order is determined
    this.gameOptions.addSystemOption(
      'turnOrderType',
      'join-order',
      'pre-start',
      (value) => {
        const validTypes = ['join-order', 'random', 'participant-order'];
        if (!validTypes.includes(value)) {
          return `turnOrderType must be one of: ${validTypes.join(', ')}`;
        }
        return true;
      },
      'Controls how turn order is determined: join-order (default), random, or participant-order'
    );

    // allowSpectatorVoting: Whether spectators can participate in restart voting
    this.gameOptions.addSystemOption(
      'allowSpectatorVoting',
      false,
      'runtime',
      (value) => {
        if (typeof value !== 'boolean') {
          return 'allowSpectatorVoting must be a boolean';
        }
        return true;
      },
      'Whether spectators can participate in restart voting'
    );

    // inactivityTimeout: Player inactivity timeout in milliseconds
    this.gameOptions.addSystemOption(
      'inactivityTimeout',
      null,
      'runtime',
      (value) => {
        if (value === null || value === undefined) {
          return true; // Allow null (no timeout)
        }
        if (typeof value !== 'number' || value < 1000) {
          return 'inactivityTimeout must be a number >= 1000 (milliseconds) or null';
        }
        return true;
      },
      'Player inactivity timeout in milliseconds (how long a player has to make a move), or null for no timeout'
    );
  }

  // Method to record custom events
  recordCustomEvent(eventType, playerId, payload = {}) {
    if (this.gameSession) {
      this.gameSession.gameHistory.addEvent({
        type: eventType,
        playerId: playerId,
        participantId: this.getParticipantIdForPlayer(playerId),
        payload: payload,
      });
    }
  }
}

export { KubicKodeGame };
