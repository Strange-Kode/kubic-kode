// tic-tac-toe.js

import { GameEngine } from "../../../game-engine/game-engine.js";
import PlayerEntity from "./game-entity/player-entity.js";
import ticTacToeRouter from "./route/tic-tac-toe-routes.js";

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

  getCurrentPlayer() {
    const currentPlayerList = this._engine.getCurrentTurnPlayers();
    return currentPlayerList.pop();
  }

  getGameStats() {
    return {
      gridSize: this.getOptionValue("gridSize"),
      winCondition: this.getOptionValue("winCondition"),
      winner: this._winner,
      isActive: this.isGameActive(),
      playerCount: this._engine.getPlayerEntities().length,
    };
  }

  initializeGameOptions() {
    this.getGameOptions().addFrozen("gridSize", 3); // TicTacToe (classic) is always 3x3
    this.getGameOptions().addFrozen("winCondition", 3); // TicTacToe (classic) always requires 3 in a row
  }

  addPlayer(name, isComputer = false) {
    let markType = this._consumeMarkTypes.shift();
    const player = new PlayerEntity(name, markType, isComputer);
    this._engine.registerPlayerEntity(player);
    return player;
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

  playTurn(playerId, x, y, metadata = {}) {
    // Get the player by ID
    const currentPlayer = this._engine.getPlayerById(playerId);

    console.log(
      `[TicTacToeGame] playTurn called - playerId: ${playerId}, x: ${x}, y: ${y}`
    );
    console.log(`[TicTacToeGame] Current player:`, currentPlayer);

    if (this._engine.getTileMap().getTile(x, y)) {
      console.log("Tile already occupied.");
      return {
        status: "invalid",
        type: "occupied_tile",
        player_has_won: false,
        player_id: currentPlayer.getPlayerId(),
      };
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
      return {
        status: "ok",
        player_has_won: true,
        player_id: currentPlayer.getPlayerId(),
      };
    }
    this._engine.nextTurn();
    return {
      status: "ok",
      player_has_won: false,
      player_id: currentPlayer.getPlayerId(),
    };
  }

  __checkWinCondition(lastMark) {
    const directions = [
      { dx: 1, dy: 0 }, // horizontal
      { dx: 0, dy: 1 }, // vertical
      { dx: 1, dy: 1 }, // diagonal \
      { dx: 1, dy: -1 }, // diagonal /
    ];

    const { x, y } = lastMark.position;
    const targetType = lastMark.type;

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

  __countInDirection(startX, startY, dx, dy, type) {
    let count = 0;
    let x = startX + dx;
    let y = startY + dy;

    while (this._engine.getTileMap().inBounds(x, y)) {
      const tile = this._engine.getTileMap().getTile(x, y);
      if (!tile || tile.type !== type) {
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

  handleInactivity() {
    const players = this._engine.getPlayerEntities();
    const currentPlayerId = this._engine.getCurrentPlayer().getPlayerId();

    const winner = players.find(
      (player) => player.getPlayerId() !== currentPlayerId
    );
    this._winner = winner || null;

    // Stop the game engine, same as normal wins
    this._engine.stopGame();

    return {
      inactivePlayerId: currentPlayerId,
      winnerPlayerId: this._winner?.getPlayerId(),
    };
  }

  calculateComputerMove() {
    const currentPlayer = this._engine.getCurrentPlayer();
    const tileMap = this._engine.getTileMap();
    const opponentMark = currentPlayer.getMarkType() === "X" ? "O" : "X";

    // Collect all empty tiles
    const emptyTiles = [];
    for (let y = 0; y < tileMap.height; y++) {
      for (let x = 0; x < tileMap.width; x++) {
        if (tileMap.getTile(x, y) === null) {
          emptyTiles.push({ x, y });
        }
      }
    }

    // 20% random move
    if (Math.random() < 0.2 || emptyTiles.length === 0) {
      return emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
    }

    // 80% "best move"
    // Look for a blocking move first
    const bestMove = this._findBlockingMove(tileMap, opponentMark);
    if (bestMove) {
      return bestMove;
    }

    // Otherwise, fallback to random
    return emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
  }

  _findBlockingMove(tileMap, opponentMark) {
    const lines = this._getAllLines(tileMap);

    for (const line of lines) {
      const opponentMarks = line.filter(
        (tile) => tile.tile && tile.tile.type === opponentMark
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
    for (let y = 0; y < tileMap.height; y++) {
      const row = [];
      for (let x = 0; x < tileMap.width; x++) {
        row.push({
          tile: tileMap.getTile(x, y),
          position: { x, y },
        });
      }
      lines.push(row);
    }

    // Columns
    for (let x = 0; x < tileMap.width; x++) {
      const column = [];
      for (let y = 0; y < tileMap.height; y++) {
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
