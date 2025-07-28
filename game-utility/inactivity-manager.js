import { GameEventService } from '../game-server/game-event-service.js';

export class InactivityManager {
  constructor(gameSession, gameInstance) {
    this._gameSession = gameSession;
    this._gameInstance = gameInstance;
    this._timeoutMs = gameInstance.getInactivityTimeout();
    this._timer = null;
    this._broadcastInterval = null;
    this._startTime = null;
  }

  startTimer() {
    this.clearTimer();
    this._startTime = Date.now();

    this._timer = setTimeout(() => {
      this._onTimeout();
    }, this._timeoutMs);

    this._startBroadcastInterval();
  }

  resetTimer() {
    this.startTimer();
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
    const inactivityStatus = this._gameInstance.handleInactivity();

    GameEventService.broadcastToSession(this._gameSession, {
      type: 'playerInactive',
      payload: { sessionId: this._gameSession.getSessionId(), inactivityStatus: inactivityStatus }
    });
  }

  _startBroadcastInterval(interval=5000) {
    this._stopBroadcastInterval();

    this._broadcastInterval = setInterval(() => {
      GameEventService.broadcastToSession(this._gameSession, {
        type: 'timeLeft',
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