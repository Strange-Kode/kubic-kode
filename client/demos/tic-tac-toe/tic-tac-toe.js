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

  addPlayer(name) {
    let markType = this.consumeMarkTypes.shift();
    const player = new PlayerEntity(name, markType);
    this.engine.registerEntity(player);
  }

  startGame() {
    if (this.engine.getEntities().length < 2) {
      throw new Error("At least two players are required to start the game.");
    }
    this.engine.resetTileMap();
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
