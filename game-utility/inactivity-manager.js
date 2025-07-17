import { GameEventService } from '../game-server/game-event-service.js';

export class InactivityManager {
    constructor(sessionId, gameInstance) {
        this.sessionId = sessionId;
        this.gameInstance = gameInstance;
        this.timeoutMs = gameInstance.getInactivityTimeout();
        this.timer = null;
        this.broadcastInterval = null;
        this.startTime = null;
    }

    startTimer() {
        this.clearTimer();
        this.startTime = Date.now();

        this.timer = setTimeout(() => {
            this._onTimeout();
        }, this.timeoutMs);

        this._startBroadcastInterval();
    }

    resetTimer() {
        this.startTimer();
    }

    clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this._stopBroadcastInterval();
    }

    getTimeRemaining() {
        if (!this.startTime) {
            return Math.floor(this.timeoutMs / 1000);
        }
        const elapsed = Date.now() - this.startTime;
        return Math.max(0, Math.floor((this.timeoutMs - elapsed) / 1000));
    }

    _onTimeout() {
        this._stopBroadcastInterval();
        this.gameInstance.handleInactivity();

        GameEventService.broadcastToSession(this.sessionId, {
            type: 'playerInactive',
            payload: { sessionId: this.sessionId }
        });
    }

    _startBroadcastInterval() {
        this._stopBroadcastInterval();

        this.broadcastInterval = setInterval(() => {
            GameEventService.broadcastToSession(this.sessionId, {
                type: 'timeLeft',
                payload: { secondsLeft: this.getTimeRemaining() }
            });
        }, 5000);
    }

    _stopBroadcastInterval() {
        if (this.broadcastInterval) {
            clearInterval(this.broadcastInterval);
            this.broadcastInterval = null;
        }
    }
}