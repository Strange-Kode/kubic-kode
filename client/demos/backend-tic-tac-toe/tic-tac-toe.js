// tic-tac-toe.js

import { GameEngine } from "../../../game-engine/game-engine.js";
import PlayerEntity from "./game-entity/player-entity.js";
import ticTacToeRouter from "./route/tic-tac-toe-routes.js";

// TicTacToeGame implements the GameInterface contract
class TicTacToeGame {
  constructor({ gridSize = 3, winCondition = 3 } = {}) {
    this.engine = new GameEngine(gridSize, gridSize);

    this.gridSize = gridSize;
    this.winCondition = winCondition;
    this.consumeMarkTypes = ["X", "O"];
    this.winner = null;
  }

  getGameEngine() {
    return this.engine;
  }

  getTileMap() {
    return this.engine.getTileMap();
  }

  getCurrentPlayer() {
    return this.engine.getCurrentPlayer();
  }

  stopGame() {
    this.engine.stopGame();
  }

  isGameActive() {
    return this.engine.isGameActive();
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

  addPlayer(name) {
    let markType = this.consumeMarkTypes.shift();
    const player = new PlayerEntity(name, markType);
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

  playTurn(playerId, x, y) {
    // const currentPlayer = this.engine.getCurrentPlayer();
    const currentPlayer = this.engine.getPlayerById(playerId);

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
    return 30_000; // 30 seconds
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
}

export { TicTacToeGame, ticTacToeRouter };
