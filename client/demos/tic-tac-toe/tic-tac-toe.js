// tic-tac-toe.js

import { GameEngine } from "../../../game-engine/game-engine.js";
import PlayerEntity from "./game-entity/player-entity.js";
import MarkEntity from "./game-entity/mark-entity.js";
import { TileMap } from "../../../game-engine/tile-map.js";
import ticTacToeRouter from "./route/tic-tac-toe-routes.js";

class TicTacToeGame {
  constructor({ gridSize = 3, winCondition = 3 } = {}) {
    this.engine = new GameEngine(gridSize, gridSize);

    this.gridSize = gridSize;
    this.winCondition = winCondition;
    this.consumeMarkTypes = ["X", "O"];
  }

  addPlayer(name, isComputer) {
    let markType = this.consumeMarkTypes.shift();
    const player = new PlayerEntity(name, markType, isComputer);
    this.engine.registerEntity(player);
  }

  startGame() {
    if (this.engine.getEntities().length < 2) {
      throw new Error("At least two players are required to start the game.");
    }
    this.engine.startGame();
  }

  getGameEngine() {
    return this.engine;
  }

  playTurn(x, y) {
    const currentPlayer = this.engine.getCurrentPlayer();
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
    this.engine.getTileMap().setTile(x, y, mark);

    if (this.checkWinCondition(mark)) {
      console.log(`${currentPlayer.getPlayerName()} wins!`);
      // this.engine.stopGame();
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
      player_id: currentPlayer.getPlayerId(), // TODO: bug, refers to player with next turn, not current player that just played! (#30)
    };
  }
  
  calculateComputerMove() {
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
    const bestMove = this.findBlockingMove(tileMap, opponentMark);
    if (bestMove) {
      return bestMove;
    }

    // Otherwise, fallback to random
    return emptyTiles[Math.floor(Math.random() * emptyTiles.length)];
  }

  findBlockingMove(tileMap, opponentMark) {
    const lines = this.getAllLines(tileMap);

    for (const line of lines) {
      const opponentMarks = line.filter(tile => tile.tile && tile.tile.type === opponentMark);
      const emptyTiles = line.filter(tile => tile.tile === null);

      if (opponentMarks.length === 2 && emptyTiles.length === 1) {
        return emptyTiles[0].position;
      }
    }

    return null;
  }

  getAllLines(tileMap) {
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

  checkWinCondition(lastMark) {
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
      count += this.countInDirection(x, y, dx, dy, targetType);
      count += this.countInDirection(x, y, -dx, -dy, targetType);

      if (count >= this.winCondition) {
        return true;
      }
    }

    return false;
  }

  countInDirection(startX, startY, dx, dy, type) {
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
}

export { TicTacToeGame, ticTacToeRouter };
