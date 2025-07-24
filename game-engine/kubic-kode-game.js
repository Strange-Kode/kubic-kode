// KubicKodeGame is a class that acts as a proxy for the game instance and game session.
// It delegates method calls to the game instance and records the game history.
import { GameInterface } from './game-interface.js';

class KubicKodeGame extends GameInterface {
  constructor(gameInstance, gameSession) {
    super();
    this.gameInstance = gameInstance;  // Game instance
    this.gameSession = gameSession;    // GameSession instance

    // Create a proxy that forwards unknown methods
    return new Proxy(this, {
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
      }
    });
  }

  // Proxy method - delegates to game instance and records history
  playTurn(playerId, x, y) {
    // Delegate to the actual game
    const result = this.gameInstance.playTurn(playerId, x, y);

    // Only record history if the turn was valid
    if (result.status === 'ok' || result.status === 'valid') {
      // Record the turn in history
      this.gameSession.gameHistory.addTurnPlayedEvent(
        result.player_id,
        this.getParticipantIdForPlayer(playerId),
        { 
          x, 
          y, 
          mark: result.mark || this.getCurrentPlayerMark(),
          status: result.status
        }
      );

      // Record win if it occurred
      if (result.player_has_won) {
        this.gameSession.gameHistory.addPlayerWonEvent(
          result.player_id,
          this.getParticipantIdForPlayer(playerId),
          {
            winCondition: result.winCondition || this.getWinConditionDescription(x, y),
            finalPosition: { x, y },
            gameState: 'completed'
          }
        );
      }
    }
    else {
      // Record invalid turn attempt
      this.gameSession.gameHistory.addEvent({
        type: 'invalidTurnAttempted',
        playerId: playerId,
        participantId: this.getParticipantIdForPlayer(playerId),
        payload: {
          x, y,
          reason: result.type || 'invalid_move',
          status: result.status
        }
      });
    }

    return result;
  }

  // Proxy other methods with history recording
  addPlayer(name) {
    const player = this.gameInstance.addPlayer(name);
    
    // Record player addition event
    if (this.gameSession) {
      this.gameSession.gameHistory.addEvent({
        type: 'playerAdded',
        playerId: player.getPlayerId(),
        participantId: this.getParticipantIdForPlayer(player.getPlayerId()),
        payload: { 
          playerName: name,
          playerId: player.getPlayerId()
        }
      });
    }
    
    return player;
  }

  startGame() {
    if (this.gameInstance.getGameEngine().getPlayerEntities().length < 2) {
      throw new Error("At least two players are required to start the game.");
    }
    const result = this.gameInstance.startGame();
    
    // Record game start event
    if (this.gameSession) {
      this.gameSession.gameHistory.addGameStateEvent('gameInstanceStarted', {
        playerCount: this.gameInstance.getGameEngine().getPlayerEntities().length,
        gameType: this.gameInstance.constructor.name
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
          winCondition: 'inactivity',
          inactivePlayerId: result.inactivePlayerId,
          gameState: 'completed'
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
      this.gameSession.gameHistory.addGameStateEvent('gameInstanceReset', {
        gameType: this.gameInstance.constructor.name,
        resetReason: 'restart'
      });
    }
    
    return result;
  }

  // Helper method for participant mapping
  getParticipantIdForPlayer(playerId) {
    if (!this.gameSession) return null;
    
    // Find the participant that corresponds to this player
    // This assumes the player name matches the participant name
    const participant = this.gameSession.getParticipants().find(
      p => p.name === this.getPlayerNameById(playerId)
    );
    
    return participant ? participant.id : null;
  }

  // Helper method to get player name by ID
  getPlayerNameById(playerId) {
    const players = this.gameInstance.getGameEngine().getPlayerEntities();
    const player = players.find(p => p.getPlayerId() === playerId);
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
        { dx: 1, dy: -1, name: "diagonal" }
      ];
      
      // For now, return a generic description
      return "line_completion";
    }
    return "unknown";
  }

  // Expose game instance methods that don't need history
  getGameEngine() {
    return this.gameInstance.getGameEngine();
  }

  getTileMap() {
    return this.gameInstance.getTileMap();
  }

  getCurrentPlayer() {
    return this.gameInstance.getCurrentPlayer();
  }

  getWinner() {
    return this.gameInstance.getWinner();
  }

  getInactivityTimeout() {
    if (this.gameInstance.getInactivityTimeout) {
      return this.gameInstance.getInactivityTimeout();
    }
    return null;
  }

  stopGame() {
    const result = this.gameInstance.stopGame();
    this.gameSession.gameHistory.addGameStateEvent('gameStopped', {
      reason: 'manual',
      timestamp: new Date().toISOString()
    });
    return result;
  }

  isGameActive() {
    return this.gameInstance.isGameActive();
  }

  getGameStats() {
    return this.gameInstance.getGameStats();
  }

  // Method to record custom events
  recordCustomEvent(eventType, playerId, payload = {}) {
    if (this.gameSession) {
      this.gameSession.gameHistory.addEvent({
        type: eventType,
        playerId: playerId,
        participantId: this.getParticipantIdForPlayer(playerId),
        payload: payload
      });
    }
  }
}

export { KubicKodeGame };
