// KubicKodeGame is a class that acts as a proxy for the game instance and game session.
// It delegates method calls to the game instance and records the game history.
import { GameInterface } from "./game-interface.js";
import { GameOptions } from "./game-options.js";
import { gameContract } from "./game-contract.js";

class KubicKodeGame extends GameInterface {
  constructor(gameInstance, gameSession) {
    super();
    this.gameInstance = gameInstance; // Game instance
    this.gameSession = gameSession; // GameSession instance
    this.gameOptions = new GameOptions();

    // Validate that the game instance implements the required contract
    const validation = gameContract.validateGameInstance(gameInstance, gameInstance.constructor.name);
    if (!validation.valid) {
      throw new Error(`Game instance validation failed: ${validation.error}`);
    }

    // Create a proxy that forwards unknown methods
    const proxy = new Proxy(this, {
      get(target, prop) {
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

  playTurn(playerId, x, y, metadata = {}) {
    // Delegate to the actual game
    const result = this.gameInstance.playTurn(playerId, x, y, metadata);

    // Only record history if the turn was valid
    if (result.status === "ok" || result.status === "valid") {
      // Record the turn in history
      this.gameSession.gameHistory.addTurnPlayedEvent(
        result.player_id,
        this.getParticipantIdForPlayer(playerId),
        {
          x,
          y,
          mark: result.mark || this.getCurrentPlayerMark(),
          status: result.status,
        }
      );

      // Record win if it occurred and stop the game
      if (result.player_has_won) {
        this.gameSession.gameHistory.addPlayerWonEvent(
          result.player_id,
          this.getParticipantIdForPlayer(playerId),
          {
            winCondition:
              result.winCondition || this.getWinConditionDescription(x, y),
            finalPosition: { x, y },
            gameState: "completed",
          }
        );

        // Stop the game and clear inactivity timer when someone wins
        this.gameSession.markEnded();
      }
    } else {
      // Record invalid turn attempt
      this.gameSession.gameHistory.addEvent({
        type: "invalidTurnAttempted",
        playerId: playerId,
        participantId: this.getParticipantIdForPlayer(playerId),
        payload: {
          x,
          y,
          reason: result.type || "invalid_move",
          status: result.status,
        },
      });
    }

    return result;
  }
  
  addPlayer(name) {
    const player = this.gameInstance.addPlayer(name);

    // Record player addition event
    if (this.gameSession) {
      this.gameSession.gameHistory.addEvent({
        type: "playerAdded",
        playerId: player.getPlayerId(),
        participantId: this.getParticipantIdForPlayer(player.getPlayerId()),
        payload: {
          playerName: name,
          playerId: player.getPlayerId(),
        },
      });
    }

    return player;
  }

  startGame() {
    if (this.gameInstance.getGameEngine().getPlayerEntities().length < 2) {
      throw new Error("At least two players are required to start the game.");
    }

    const result = this.gameInstance.startGame
      ? this.gameInstance.startGame()
      : this.gameInstance.getGameEngine().startGame();

    // Record game start event
    if (this.gameSession) {
      this.gameSession.gameHistory.addGameStateEvent("gameInstanceStarted", {
        playerCount: this.gameInstance.getGameEngine().getPlayerEntities()
          .length,
        gameType: this.gameInstance.constructor.name,
      });
    }

    return result;
  }

  // Handle inactivity with history recording
  handleInactivity() {
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
    const result = this.gameInstance.resetForRestart();

    // Record game reset event
    if (this.gameSession) {
      this.gameSession.gameHistory.addGameStateEvent("gameInstanceReset", {
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

    this.gameSession.gameHistory.addGameStateEvent("gameStopped", {
      reason: "manual",
      timestamp: new Date().toISOString(),
    });

    // Clear inactivity timer when game stops
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
    // Default implementation if game instance doesn't provide it
    if (typeof this.gameInstance.getInactivityTimeout === 'function') {
      return this.gameInstance.getInactivityTimeout();
    }
    return null; // Default: no inactivity timeout
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
