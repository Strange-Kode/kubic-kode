import { GameEventService } from "../game-server/game-event-service.js";

export class InactivityManager {
  constructor(gameSession, gameInstance) {
    this._gameSession = gameSession;
    this._gameInstance = gameInstance;
    this._timeoutMs = gameInstance.getInactivityTimeout();
    this._timer = null;
    this._broadcastInterval = null;
    this._startTime = null;
    this._actedPlayers = new Set(); // Track which players have acted in current turn
  }

  startTimer() {
    this.clearTimer();
    this._startTime = Date.now();
    this._actedPlayers.clear(); // Reset acted players for new turn

    this._timer = setTimeout(() => {
      this._onTimeout();
    }, this._timeoutMs);

    this._startBroadcastInterval();
  }

  resetTimer() {
    this.startTimer();
  }

  // Clear acted players (called when a new turn starts)
  clearActedPlayers() {
    this._actedPlayers.clear();
  }

  // Mark a player as having acted (called when a player makes a move)
  markPlayerActed(playerId) {
    this._actedPlayers.add(playerId);
  }

  // Check if all current players have acted
  haveAllPlayersActed(currentPlayers) {
    const playersArray = Array.isArray(currentPlayers) ? currentPlayers : [currentPlayers];
    return playersArray.every(player => 
      player && this._actedPlayers.has(player.getPlayerId())
    );
  }

  clearTimer() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._stopBroadcastInterval();
  }

  getTimeRemaining() {
    if (!this._startTime) {
      return Math.floor(this._timeoutMs / 1000);
    }
    const elapsed = Date.now() - this._startTime;
    return Math.max(0, Math.floor((this._timeoutMs - elapsed) / 1000));
  }

  _onTimeout() {
    this._stopBroadcastInterval();
    
    // Get all current players that should be acting
    const currentPlayers = this._gameInstance.getGameEngine().getCurrentTurnPlayers();
    const playersArray = Array.isArray(currentPlayers) ? currentPlayers : [currentPlayers];
    
    // Identify which players haven't acted (are inactive)
    const inactivePlayers = playersArray.filter(player => 
      player && !this._actedPlayers.has(player.getPlayerId())
    );
    
    if (inactivePlayers.length === 0) {
      // All players acted, no inactivity to handle
      return;
    }
    
    // Handle inactivity for each inactive player
    const inactivityResults = [];
    for (const inactivePlayer of inactivePlayers) {
      const playerId = inactivePlayer.getPlayerId();
      const inactivityStatus = this._gameInstance.handleInactivity(playerId, inactivePlayer);
      inactivityResults.push({
        playerId,
        inactivityStatus
      });
    }

    // Broadcast inactivity event with all inactive players
    GameEventService.broadcastToSession(this._gameSession, {
      type: "playerInactive",
      payload: { 
        sessionId: this._gameSession.getSessionId(), 
        inactivePlayers: inactivityResults 
      }
    });
  }

  _startBroadcastInterval(interval=5000) {
    this._stopBroadcastInterval();

    this._broadcastInterval = setInterval(() => {
      GameEventService.broadcastToSession(this._gameSession, {
        type: "timeLeft",
        payload: { secondsLeft: this.getTimeRemaining() }
      });
    }, interval);
  }

  _stopBroadcastInterval() {
    if (this._broadcastInterval) {
      clearInterval(this._broadcastInterval);
      this._broadcastInterval = null;
    }
  }
}
