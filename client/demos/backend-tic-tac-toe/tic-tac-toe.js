// tic-tac-toe.js

import { GameEngine } from "../../../game-engine/game-engine.js";
import { PlayStatus } from "../../../game-engine/play-status.js";
import PlayerEntity from "./game-entity/player-entity.js";
import ticTacToeRouter from "./route/tic-tac-toe-routes.js";
import { minimaxTicTacToe } from "../../../game-utility/ai-utility/minimax.js";

// TicTacToeGame implements methods as defined in GameContract (game-contract.js)
class TicTacToeGame {
  constructor() {
    // Don't store options as instance properties
    // this.gridSize = 3; // WRONG!
    // this.winCondition = 3; // WRONG!

    // Create engine with default values (will be updated via options)
    this._engine = new GameEngine(3, 3, { playStyle: "single-set" });
    this._consumeMarkTypes = ["X", "O"];
    this._winner = null;
  }

  getGameEngine() {
    return this._engine;
  }
  
  getGameStats() {
    return {
      gridSize: this.getOptionValue("gridSize"),
      winCondition: this.getOptionValue("winCondition"),
      difficulty: this.getOptionValue("difficulty"),
      winner: this._winner,
      isActive: this.isGameActive(),
      playerCount: this._engine.getPlayerEntities().length,
    };
  }

  requiredPlayers() {
    return 2; // TicTacToe (classic) always requires 2 players
  }

  initializeGameOptions() {
    // System options are automatically available via systemspace namespace
    // To discover available system options, use:
    // console.log(this.getGameOptions().getSystemOptions());
    // To read a system option: this.getGameOptions().readSystemOption('participantPlaysFirst')
    // Available system options include:
    // - participantPlaysFirst: Which participant goes first (pre-start)
    // - turnOrderType: How turn order is determined (pre-start) 
    // - allowSpectatorVoting: Whether spectators can vote (runtime)
    // - inactivityTimeout: Player inactivity timeout in ms (runtime)
    // - returnSinglePlayerId: Return player ID as a single value instead of array (frozen)
    //   (e.g. if true then [1] => 1, if false then [1] => [1])
    //   (true only allowed if game play style is set to single-set)

    // Example: Read a system option
    // const firstParticipant = this.getGameOptions().readSystemOption('participantPlaysFirst');

    // Game-specific options (userspace namespace - default)
    this.getGameOptions().addOption("gridSize", 3, 'frozen'); // TicTacToe (classic) is always 3x3
    this.getGameOptions().addOption("winCondition", 3, 'frozen'); // TicTacToe (classic) always requires 3 in a row
    
    // Add difficulty configuration for AI behavior
    this.getGameOptions().addOption("difficulty", "medium", 'runtime', (value) => {
      const validDifficulties = ["easy", "medium", "hard"];
      if (!validDifficulties.includes(value)) {
        return `Difficulty must be one of: ${validDifficulties.join(", ")}`;
      }
      return true;
    });

    // Set returnSinglePlayerId option to true for TicTacToe
    // This allows the game routes to return player ID as a single int value instead of array of ints
    // TicTacToe uses single-set play style and always has exactly one current player
    this.getGameOptions().setSystemOption("returnSinglePlayerId", true);
  }

  addPlayer(name, isComputer = false) {
    let markType = this._consumeMarkTypes.shift();
    const player = new PlayerEntity(name, markType, isComputer);
    this._engine.registerPlayerEntity(player);
    return player;
  }

  establishFirstPlayers(sessionContext = null) {
    const players = this._engine.getPlayerEntities();
    
    // If we have session context, alternate first player based on restart count
    if (sessionContext && typeof sessionContext.restartCount === 'number') {
      const restartCount = sessionContext.restartCount;
      const xPlayer = players.find(player => player.getMarkType() === 'X');
      const oPlayer = players.find(player => player.getMarkType() === 'O');
      
      if (xPlayer && oPlayer) {
        // Alternate first player: odd restart count = X first, even = O first
        // Game 1 (count=1): X first, Game 2 (count=2): O first, Game 3 (count=3): X first
        const firstPlayer = (restartCount % 2 === 1) ? xPlayer : oPlayer;
        return firstPlayer.getPlayerId();
      }
    }
    
    // Fallback to traditional behavior: X always goes first
    const xPlayer = players.find(player => player.getMarkType() === 'X');
    if (xPlayer) {
      return xPlayer.getPlayerId();
    }
    
    // Final fallback: return first player if X player not found
    return players.length > 0 ? players[0].getPlayerId() : null;
  }

  resetForRestart() {
    // Reset winner state
    this._winner = null;

    // Restore mark types for player re-addition
    this._consumeMarkTypes = ["X", "O"];

    // Clear player mark histories
    this._engine.getPlayerEntities().forEach((player) => {
      if (typeof player.clearMarks === "function") {
        player.clearMarks();
      }
    });
  }

  startGame() {
    // Reset restart-specific state before starting
    this.resetForRestart();

    this._engine.resetTileMap();
    this._engine.startGame();
  }

  playTurn(playerId, turnData, metadata = {}) {
    // Extract position data from turnData
    const { xPos: x, yPos: y } = turnData;
    
    // Get the player by ID
    const currentPlayer = this._engine.getPlayerById(playerId);

    console.log(
      `[TicTacToeGame] playTurn called - playerId: ${playerId}, turnData:`, turnData
    );
    console.log(`[TicTacToeGame] Current player:`, currentPlayer);

    if (this._engine.getTileMap().getTile(x, y)) {
      console.log("Tile already occupied.");
      return PlayStatus.invalid(playerId, "Tile already occupied", {
        type: "occupied_tile"
      });
    }

    const mark = currentPlayer.placeMark({ x, y });
    console.log(`[TicTacToeGame] Created mark:`, mark);

    this._engine.getTileMap().setTile(x, y, mark);
    console.log(`[TicTacToeGame] Set tile at (${x}, ${y}) to:`, mark);

    // Debug: Check if tile was actually set
    const retrievedTile = this._engine.getTileMap().getTile(x, y);
    console.log(
      `[TicTacToeGame] Retrieved tile at (${x}, ${y}):`,
      retrievedTile
    );

    if (this.__checkWinCondition(mark)) {
      this._winner = currentPlayer;
      this._engine.stopGame();
      console.log(`${currentPlayer.getPlayerName()} wins!`);
      return PlayStatus.win(playerId, {
        mark: mark
      });
    }

    // Check for tie condition - all tiles filled but no winner
    if (this.__checkTieCondition()) {
      this._engine.stopGame();
      console.log('Game is tied!');
      return PlayStatus.tie(playerId, {
        mark: mark
      });
    }

    this._engine.nextTurn();
    return PlayStatus.success(playerId, {
      mark: mark
    });
  }

  __checkWinCondition(lastMark) {
    const directions = [
      { dx: 1, dy: 0 }, // horizontal
      { dx: 0, dy: 1 }, // vertical
      { dx: 1, dy: 1 }, // diagonal \
      { dx: 1, dy: -1 }, // diagonal /
    ];

    const { x, y } = lastMark.getEntityPosition();
    const targetType = lastMark.getMarkType();

    for (const { dx, dy } of directions) {
      let count = 1;
      count += this.__countInDirection(x, y, dx, dy, targetType);
      count += this.__countInDirection(x, y, -dx, -dy, targetType);

      if (count >= this.getOptionValue("winCondition")) {
        return true;
      }
    }

    return false;
  }

  __checkTieCondition() {
    const tileMap = this._engine.getTileMap();
    
    // Use built-in TileMap methods: tie occurs when all tiles are occupied
    return tileMap.getOccupiedCount() === tileMap.getTotalTiles();
  }

  __countInDirection(startX, startY, dx, dy, type) {
    let count = 0;
    let x = startX + dx;
    let y = startY + dy;

    while (this._engine.getTileMap().inBounds(x, y)) {
      const tile = this._engine.getTileMap().getTile(x, y);
      if (!tile || tile.getMarkType() !== type) {
        break;
      }
      count++;
      x += dx;
      y += dy;
    }

    return count;
  }

  getInactivityTimeout() {
    return 30_000; // 30 seconds
  }

  getWinner() {
    return this._winner;
  }

  handleInactivity(playerId = null, player = null) {
    const players = this._engine.getPlayerEntities();

    const winner = players.find(
      (player) => player.getPlayerId() !== playerId
    );
    this._winner = winner || null;

    // Stop the game engine, same as normal wins
    this._engine.stopGame();

    return {
      inactivePlayerId: playerId,
      winnerPlayerId: this._winner?.getPlayerId(),
    };
  }

  calculateComputerMove(playerId, currentPlayer) {
    const tileMap = this._engine.getTileMap();
    const computerMark = currentPlayer.getMarkType();
    const humanMark = computerMark === "X" ? "O" : "X";
    const difficulty = this.getOptionValue("difficulty");
    const emptyTiles = tileMap.getEmptyTiles();

    if (emptyTiles.length === 0) {
      return null; // No moves available
    }

    // Random chances applies to "dumb" heuristic moves (no smart mode)
    const randomChances = {
      easy: 0.35,
      medium: 0.23,
      hard: 0.2,
    }
    // Determine move strategy based on difficulty
    switch (difficulty) {
      case "easy":
        // Easy: Always use heuristics (current blocking logic)
        return this._convertMoveToTurnData(this._getHeuristicMove(tileMap, computerMark, humanMark, emptyTiles, false, randomChances.easy));
        
      case "medium":
        // Medium: 70% minimax, 30% heuristics
        if (Math.random() < 0.7) {
          const minimaxMove = this._getMinimaxMove(tileMap, computerMark, humanMark);
          return this._convertMoveToTurnData(minimaxMove || this._getHeuristicMove(tileMap, computerMark, humanMark, emptyTiles, true));
        } else {
          return this._convertMoveToTurnData(this._getHeuristicMove(tileMap, computerMark, humanMark, emptyTiles, false, randomChances.medium));
        }
        
      case "hard":
        // Hard: 90% minimax, 10% heuristics
        if (Math.random() < 0.9) {
          const minimaxMove = this._getMinimaxMove(tileMap, computerMark, humanMark);
          return this._convertMoveToTurnData(minimaxMove || this._getHeuristicMove(tileMap, computerMark, humanMark, emptyTiles, true));
        } else {
          return this._convertMoveToTurnData(this._getHeuristicMove(tileMap, computerMark, humanMark, emptyTiles, false, randomChances.hard));
        }
        
      default:
        // Fallback to medium
        const minimaxMove = this._getMinimaxMove(tileMap, computerMark, humanMark);
        return this._convertMoveToTurnData(minimaxMove || this._getHeuristicMove(tileMap, computerMark, humanMark, emptyTiles, true, randomChances.medium));
    }
  }

  /**
   * Convert internal move format {x, y} to consistent turnData format {xPos, yPos}
   */
  _convertMoveToTurnData(move) {
    if (!move) return null;
    return {
      xPos: move.x,
      yPos: move.y
    };
  }

  /**
   * Get move using minimax algorithm
   */
  _getMinimaxMove(tileMap, computerMark, humanMark) {
    try {
      return minimaxTicTacToe(tileMap, computerMark, humanMark);
    } catch (error) {
      console.error("Error in minimax calculation:", error);
      return null; // Fallback to heuristics
    }
  }

  /**
   * Get move using original heuristic logic
   * @param {Object} tileMap - The game tile map
   * @param {string} computerMark - Computer's mark type
   * @param {string} humanMark - Human's mark type  
   * @param {Array} emptyTiles - Array of empty tile positions
   * @param {boolean} smartMode - If true, removes extra randomness for consistent play
   * @param {number} randomChance - Chance of returning a random move (0.2 = 20%) (ignored if in smartMode)
   */
  _getHeuristicMove(tileMap, computerMark, humanMark, emptyTiles, smartMode = false, randomChance = 0.2) {
    // In smart mode (medium/hard), skip the random chance
    if (!smartMode && Math.random() < randomChance) {
      return emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
    }

    // Look for winning moves first (for computer)
    const winningMove = this._findWinningMove(tileMap, computerMark);
    if (winningMove) {
      return winningMove;
    }

    // Then look for blocking moves (against human)
    const blockingMove = this._findBlockingMove(tileMap, humanMark);
    if (blockingMove) {
      return blockingMove;
    }

    // In smart mode, try center and corners before random
    if (smartMode) {
      // Prefer center if available
      if (tileMap.getTile(1, 1) === null) {
        return { x: 1, y: 1 };
      }
      
      // Then prefer corners
      const corners = [
        { x: 0, y: 0 }, { x: 2, y: 0 },
        { x: 0, y: 2 }, { x: 2, y: 2 }
      ];
      const availableCorners = corners.filter(corner => 
        tileMap.getTile(corner.x, corner.y) === null
      );
      if (availableCorners.length > 0) {
        return availableCorners[Math.floor(Math.random() * availableCorners.length)];
      }
    }

    // Otherwise, fallback to random
    return emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
  }

  /**
   * Find a winning move for the specified mark
   */
  _findWinningMove(tileMap, mark) {
    const lines = this._getAllLines(tileMap);

    for (const line of lines) {
      const ownMarks = line.filter(
        (tile) => tile.tile && tile.tile.getMarkType() === mark
      );
      const emptyTiles = line.filter((tile) => tile.tile === null);

      if (ownMarks.length === 2 && emptyTiles.length === 1) {
        return emptyTiles[0].position;
      }
    }

    return null;
  }

  /**
   * Find a blocking move against the opponent's mark
   */
  _findBlockingMove(tileMap, opponentMark) {
    const lines = this._getAllLines(tileMap);

    for (const line of lines) {
      const opponentMarks = line.filter(
        (tile) => tile.tile && tile.tile.getMarkType() === opponentMark
      );
      const emptyTiles = line.filter((tile) => tile.tile === null);

      if (opponentMarks.length === 2 && emptyTiles.length === 1) {
        return emptyTiles[0].position;
      }
    }

    return null;
  }

  _getAllLines(tileMap) {
    const lines = [];

    // Rows
    for (let y = 0; y < tileMap.getHeight(); y++) {
      const row = [];
      for (let x = 0; x < tileMap.getWidth(); x++) {
        row.push({
          tile: tileMap.getTile(x, y),
          position: { x, y },
        });
      }
      lines.push(row);
    }

    // Columns
    for (let x = 0; x < tileMap.getWidth(); x++) {
      const column = [];
      for (let y = 0; y < tileMap.getHeight(); y++) {
        column.push({
          tile: tileMap.getTile(x, y),
          position: { x, y },
        });
      }
      lines.push(column);
    }

    // Diagonal top-left to bottom-right
    lines.push([
      { tile: tileMap.getTile(0, 0), position: { x: 0, y: 0 } },
      { tile: tileMap.getTile(1, 1), position: { x: 1, y: 1 } },
      { tile: tileMap.getTile(2, 2), position: { x: 2, y: 2 } },
    ]);

    // Diagonal top-right to bottom-left
    lines.push([
      { tile: tileMap.getTile(2, 0), position: { x: 2, y: 0 } },
      { tile: tileMap.getTile(1, 1), position: { x: 1, y: 1 } },
      { tile: tileMap.getTile(0, 2), position: { x: 0, y: 2 } },
    ]);

    return lines;
  }
}

export { TicTacToeGame, ticTacToeRouter };
