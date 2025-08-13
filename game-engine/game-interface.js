// Game Interface - defines the contract that KubicKodeGame must follow
export class GameInterface {
  // Core game lifecycle methods
  addPlayer(name) {
    throw new Error('addPlayer must be implemented');
  }

  startGame() {
    throw new Error('startGame must be implemented');
  }

  playTurn(playerId, turnData) {
    throw new Error('playTurn must be implemented');
  }

  stopGame() {
    throw new Error('stopGame must be implemented');
  }

  resetForRestart() {
    throw new Error('resetForRestart must be implemented');
  }

  handleInactivity() {
    throw new Error('handleInactivity must be implemented');
  }

  // Game state accessors
  getGameEngine() {
    throw new Error('getGameEngine must be implemented');
  }

  getTileMap() {
    throw new Error('getTileMap must be implemented');
  }

  getCurrentTurnPlayers() {
    throw new Error('getCurrentTurnPlayers must be implemented');
  }

  getWinner() {
    throw new Error('getWinner must be implemented');
  }

  getInactivityTimeout() {
    throw new Error('getInactivityTimeout must be implemented');
  }

  // Game state queries
  isGameActive() {
    throw new Error('isGameActive must be implemented');
  }

  getGameStats() {
    throw new Error('getGameStats must be implemented');
  }

  // Game options methods
  getGameOptions() {
    // Default implementation returns null - games should override this
    return null;
  }

  applyGameOptions(options) {
    // Default implementation does nothing - games should override this
    return { valid: true, applied: {}, errors: [], ignored: [] };
  }

  resetGameOptions() {
    throw new Error('resetGameOptions must be implemented');
  }
}

// Game Interface Type - for documentation and type checking
export const GAME_INTERFACE_METHODS = [
  'addPlayer',
  'startGame', 
  'playTurn',
  'stopGame',
  'resetForRestart',
  'handleInactivity',
  'getGameEngine',
  'getTileMap',
  'getCurrentTurnPlayers',
  'getWinner',
  'getInactivityTimeout',
  'isGameActive',
  'getGameStats',
  'getGameOptions',
  'applyGameOptions',
  'resetGameOptions'
];
