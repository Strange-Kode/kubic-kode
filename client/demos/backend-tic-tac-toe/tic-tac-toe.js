// tic-tac-toe.js

import { GameEngine } from "../../../game-engine/game-engine.js";
import PlayerEntity from "./game-entity/player-entity.js";
import ticTacToeRouter from "./route/tic-tac-toe-routes.js";

// TicTacToeGame implements methods as defined in GameContract (game-contract.js)
class TicTacToeGame {
  constructor() {
    // Always use single-set play style for TicTacToe
    const turnConfig = { playStyle: "single-set" };
    
    // Default values for TicTacToe
    this.gridSize = 3;
    this.winCondition = 3;
    
    this.engine = new GameEngine(this.gridSize, this.gridSize, turnConfig);
    this.consumeMarkTypes = ["X", "O"];
    this.winner = null;
  }

  getGameEngine() {
    return this.engine;
  }

  getCurrentPlayer() {
    const currentPlayerList = this.engine.getCurrentTurnPlayers();
    return currentPlayerList.pop();
  }

  getGameStats() {
    return {
      gridSize: this.gridSize,
      winCondition: this.winCondition,
      winner: this.winner,
      isActive: this.isGameActive(),
      playerCount: this.engine.getPlayerEntities().length
    };
  }
  
  initializeGameOptions() {
    this.getGameOptions().addFrozen('gridSize', this.gridSize); // TicTacToe is always 3x3
    this.getGameOptions().addFrozen('winCondition', this.winCondition); // TicTacToe always requires 3 in a row
  }

  addPlayer(name, isComputer = false) {
    let markType = this.consumeMarkTypes.shift();
    const player = new PlayerEntity(name, markType, isComputer);
    this.engine.registerPlayerEntity(player);
    return player;
  }

  resetForRestart() {
    // Reset winner state
    this.winner = null;

    // Restore mark types for player re-addition
    this.consumeMarkTypes = ["X", "O"];

    // Clear player mark histories
    this.engine.getPlayerEntities().forEach((player) => {
      if (typeof player.clearMarks === "function") {
        player.clearMarks();
      }
    });
  }

  startGame() {
    // Reset restart-specific state before starting
    this.resetForRestart();

    this.engine.resetTileMap();
    this.engine.startGame();
  }

  playTurn(playerId, x, y, metadata = {}) {
    // TODO: get currentPlayer by id rather than using currentPlayer()
    const currentPlayer = this.engine.getCurrentTurnPlayers();
    // const currentPlayer = this.engine.getPlayerById(playerId);

    console.log(`[TicTacToeGame] playTurn called - playerId: ${playerId}, x: ${x}, y: ${y}`);
    console.log(`[TicTacToeGame] Current player:`, currentPlayer);

    if (this.engine.getTileMap().getTile(x, y)) {
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
    
    this.engine.getTileMap().setTile(x, y, mark);
    console.log(`[TicTacToeGame] Set tile at (${x}, ${y}) to:`, mark);
    
    // Debug: Check if tile was actually set
    const retrievedTile = this.engine.getTileMap().getTile(x, y);
    console.log(`[TicTacToeGame] Retrieved tile at (${x}, ${y}):`, retrievedTile);

    if (this.__checkWinCondition(mark)) {
      this.winner = currentPlayer;
      this.engine.stopGame();
      console.log(`${currentPlayer.getPlayerName()} wins!`);
      return {
        status: "ok",
        player_has_won: true,
        player_id: currentPlayer.getPlayerId(),
      };
    }
    this.engine.nextTurn();
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

      if (count >= this.winCondition) {
        return true;
      }
    }

    return false;
  }

  __countInDirection(startX, startY, dx, dy, type) {
    let count = 0;
    let x = startX + dx;
    let y = startY + dy;

    while (this.engine.getTileMap().inBounds(x, y)) {
      const tile = this.engine.getTileMap().getTile(x, y);
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
    return 120_000; // 120 seconds
  }

  getWinner() {
    return this.winner;
  }

  handleInactivity() {
    const players = this.engine.getPlayerEntities();
    const currentPlayerId = this.engine.getCurrentPlayer().getPlayerId();

    const winner = players.find(
      (player) => player.getPlayerId() !== currentPlayerId
    );
    this.winner = winner || null;
    return {
      inactivePlayerId: currentPlayerId,
      winnerPlayerId: this.winner?.getPlayerId(),
    };
  }

  calculateComputerMove() {
    const currentPlayer = this.engine.getCurrentPlayer();
    const tileMap = this.engine.getTileMap();
    const opponentMark = currentPlayer.getMarkType() === 'X' ? 'O' : 'X';

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
      const opponentMarks = line.filter(tile => tile.tile && tile.tile.type === opponentMark);
      const emptyTiles = line.filter(tile => tile.tile === null);

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
          position: { x, y } 
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
          position: { x, y } 
        });
      }
      lines.push(column);
    }

    // Diagonal top-left to bottom-right
    lines.push([
      { tile: tileMap.getTile(0, 0), position: { x: 0, y: 0 } },
      { tile: tileMap.getTile(1, 1), position: { x: 1, y: 1 } },
      { tile: tileMap.getTile(2, 2), position: { x: 2, y: 2 } }
    ]);

    // Diagonal top-right to bottom-left
    lines.push([
      { tile: tileMap.getTile(2, 0), position: { x: 2, y: 0 } },
      { tile: tileMap.getTile(1, 1), position: { x: 1, y: 1 } },
      { tile: tileMap.getTile(0, 2), position: { x: 0, y: 2 } }
    ]);

    return lines;
  }
}

export { TicTacToeGame, ticTacToeRouter };
